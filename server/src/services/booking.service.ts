import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export class BookingError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export interface CreateBookingInput {
  studentId: number;
  tutorId: number;
  subjectId: number;
  startTime: Date | string;
  durationHours: number;
  notes?: string | null;
  attachmentIds?: number[];
}

const HOUR_MS = 60 * 60 * 1000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function isExclusionViolation(error: unknown): boolean {
  if (getErrorCode(error) === '23P01') return true;
  if (typeof error !== 'object' || error === null) return false;

  const record = error as {
    cause?: unknown;
    meta?: { code?: unknown; database_error?: unknown; message?: unknown };
    message?: unknown;
  };
  if (record.meta?.code === '23P01') return true;
  if (typeof record.meta?.database_error === 'string' &&
      record.meta.database_error.includes('23P01')) return true;
  if (typeof record.message === 'string' && record.message.includes('23P01')) return true;
  return record.cause !== undefined && isExclusionViolation(record.cause);
}

function validateAttachmentMime(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

async function createBookingAttempt(input: CreateBookingInput) {
  const startTime = new Date(input.startTime);
  const now = new Date();

  // Keep validation order aligned with the frontend mock API.
  const student = await prisma.user.findUnique({
    where: { id: input.studentId },
    select: { id: true, role: true, isEmailVerified: true },
  });

  if (!student || student.role !== 'STUDENT') {
    throw new BookingError(403, 'Only students can book lessons.');
  }
  if (!student.isEmailVerified) {
    throw new BookingError(400, 'Verify your email before booking a lesson.');
  }

  if (!Number.isInteger(input.durationHours) || input.durationHours < 1) {
    throw new BookingError(400, 'Lesson length must be a whole number of hours.');
  }

  if (Number.isNaN(startTime.getTime()) || startTime <= now) {
    throw new BookingError(400, 'Choose a start time in the future.');
  }
  if (
    (startTime.getMinutes() !== 0 && startTime.getMinutes() !== 30) ||
    startTime.getSeconds() !== 0 ||
    startTime.getMilliseconds() !== 0
  ) {
    throw new BookingError(400, 'Choose a valid start time.');
  }

  const tutor = await prisma.user.findUnique({
    where: { id: input.tutorId },
    select: {
      id: true,
      name: true,
      role: true,
      isApproved: true,
      tutorProfile: {
        select: {
          subjects: {
            where: { subjectId: input.subjectId },
            select: { subjectId: true, hourlyPrice: true },
          },
        },
      },
    },
  });

  if (!tutor || tutor.role !== 'TUTOR' || !tutor.isApproved || !tutor.tutorProfile) {
    throw new BookingError(404, 'Tutor not found.');
  }

  const tutorSubject = tutor.tutorProfile.subjects[0];
  if (!tutorSubject) {
    throw new BookingError(400, `${tutor.name} does not teach this subject.`);
  }

  const attachmentIds = input.attachmentIds ?? [];
  if (!Array.isArray(attachmentIds) || attachmentIds.length > MAX_ATTACHMENTS) {
    throw new BookingError(400, 'You can attach up to 5 files.');
  }
  if (new Set(attachmentIds).size !== attachmentIds.length ||
      attachmentIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new BookingError(400, 'Invalid attachments.');
  }

  const endTime = new Date(startTime.getTime() + input.durationHours * HOUR_MS);

  return prisma.$transaction(async (tx) => {
    let attachments: { id: number; fileName: string; mimeType: string; sizeBytes: number; storageKey: string }[] = [];
    if (attachmentIds.length > 0) {
      attachments = await tx.bookingAttachment.findMany({
        where: {
          id: { in: attachmentIds },
          uploadedById: input.studentId,
          bookingId: null,
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          storageKey: true,
        },
      });
      if (attachments.length !== attachmentIds.length) {
        throw new BookingError(400, 'One or more attachments are invalid.');
      }
      if (attachments.some((file) =>
        !file.fileName.trim() ||
        file.sizeBytes <= 0 ||
        file.sizeBytes > MAX_ATTACHMENT_BYTES ||
        !validateAttachmentMime(file.mimeType)
      )) {
        throw new BookingError(400, 'One or more attachments are not allowed.');
      }
    }

    const availability = await tx.availability.findFirst({
      where: {
        tutorId: input.tutorId,
        startTime: { lte: startTime },
        endTime: { gte: endTime },
      },
      orderBy: { startTime: 'asc' },
    });

    if (!availability) {
      throw new BookingError(
        409,
        'This time is no longer available. Your payment was not taken.',
      );
    }

    if ((startTime.getTime() - availability.startTime.getTime()) % HOUR_MS !== 0) {
      throw new BookingError(
        400,
        'Start time must be a whole number of hours after the window opens.',
      );
    }

    const conflict = await tx.booking.findFirst({
      where: {
        status: { not: 'CANCELLED' },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        OR: [
          { tutorId: input.tutorId },
          { studentId: input.studentId },
        ],
      },
      select: { id: true },
    });

    if (conflict) {
      throw new BookingError(409, 'You already have a lesson at this time.');
    }

    // Mock payment succeeds in Sprint 1; no real payment provider is called.
    const hourlyPriceSnapshot = tutorSubject.hourlyPrice;
    const totalPrice = hourlyPriceSnapshot.mul(input.durationHours);

    const booking = await tx.booking.create({
      data: {
        studentId: input.studentId,
        tutorId: input.tutorId,
        subjectId: input.subjectId,
        startTime,
        endTime,
        durationHours: input.durationHours,
        hourlyPriceSnapshot,
        totalPrice,
        notes: input.notes?.trim() || null,
        status: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
        ...(attachmentIds.length > 0
          ? { attachments: { connect: attachmentIds.map((id) => ({ id })) } }
          : {}),
      },
      include: {
        student: { select: { id: true, name: true } },
        tutor: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        attachments: {
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
        },
      },
    });

    // Consume the booked interval and preserve any remaining free intervals.
    await tx.availability.delete({ where: { id: availability.id } });

    const remaining: { tutorId: number; startTime: Date; endTime: Date }[] = [];
    if (availability.startTime < startTime) {
      remaining.push({
        tutorId: availability.tutorId,
        startTime: availability.startTime,
        endTime: startTime,
      });
    }
    if (endTime < availability.endTime) {
      remaining.push({
        tutorId: availability.tutorId,
        startTime: endTime,
        endTime: availability.endTime,
      });
    }
    if (remaining.length > 0) {
      await tx.availability.createMany({ data: remaining });
    }

    return booking;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

export async function createBooking(input: CreateBookingInput) {
  // One retry for serialization conflicts, as specified by the API guide.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await createBookingAttempt(input);
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new BookingError(409, 'You already have a lesson at this time.');
      }
      if (getErrorCode(error) === 'P2034' && attempt === 0) {
        continue;
      }
      if (getErrorCode(error) === 'P2034') {
        throw new BookingError(409, 'This time is no longer available. Your payment was not taken.');
      }
      throw error;
    }
  }
  throw new BookingError(409, 'This time is no longer available. Your payment was not taken.');
}
