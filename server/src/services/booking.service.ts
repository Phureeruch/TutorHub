import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { findBookingConflict } from '../utils/booking-overlap.js';
import {
  calculateBookingPrice,
  MAX_BOOKING_DURATION_HOURS,
} from '../utils/price-calculation.js';
import {
  calculateStudentRefund,
  calculateTutorRefund,
} from '../utils/refund-calculation.js';
import {
  MIN_BOOKING_LEAD_MS,
  validateBookingTime,
} from '../utils/time.validation.js';
import { restoreAndMergeAvailability } from './availability.service.js';
import {
  validateLessonSummary,
  assertCanCompleteBooking,
  LessonCompletionError,
} from '../utils/lesson-completion.js';
import {
  AttachmentError,
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  validateAttachmentList,
  type AttachmentMetadataInput,
} from './attachment.service.js';

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
  attachments?: AttachmentMetadataInput[];
}

const HOUR_MS = 60 * 60 * 1000;

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
  if (
    typeof record.meta?.database_error === 'string' &&
    record.meta.database_error.includes('23P01')
  ) {
    return true;
  }
  if (
    typeof record.message === 'string' &&
    record.message.includes('23P01')
  ) {
    return true;
  }
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
  if (input.durationHours > MAX_BOOKING_DURATION_HOURS) {
    throw new BookingError(400, 'A single booking cannot exceed 4 hours.');
  }

  if (Number.isNaN(startTime.getTime()) || startTime <= now) {
    throw new BookingError(400, 'Choose a start time in the future.');
  }
  if (startTime.getTime() - now.getTime() < MIN_BOOKING_LEAD_MS) {
    throw new BookingError(
      400,
      'Bookings must be made at least 2 hours before the lesson starts.',
    );
  }
  if (
    (startTime.getUTCMinutes() !== 0 && startTime.getUTCMinutes() !== 30) ||
    startTime.getUTCSeconds() !== 0 ||
    startTime.getUTCMilliseconds() !== 0
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
  const inlineAttachmentsInput = input.attachments ?? [];

  if (
    !Array.isArray(attachmentIds) ||
    !Array.isArray(inlineAttachmentsInput) ||
    attachmentIds.length + inlineAttachmentsInput.length > MAX_ATTACHMENTS
  ) {
    throw new BookingError(400, `Attach at most ${MAX_ATTACHMENTS} files.`);
  }
  if (
    new Set(attachmentIds).size !== attachmentIds.length ||
    attachmentIds.some((id) => !Number.isInteger(id) || id <= 0)
  ) {
    throw new BookingError(400, 'Invalid attachments.');
  }

  let validatedInlineAttachments: ReturnType<typeof validateAttachmentList> = [];
  if (inlineAttachmentsInput.length > 0) {
    try {
      validatedInlineAttachments = validateAttachmentList(inlineAttachmentsInput);
    } catch (error) {
      if (error instanceof AttachmentError) {
        throw new BookingError(error.statusCode, error.message);
      }
      throw error;
    }
  }

  const endTime = new Date(startTime.getTime() + input.durationHours * HOUR_MS);

  return prisma.$transaction(
    async (tx) => {
      if (attachmentIds.length > 0) {
        const attachments = await tx.bookingAttachment.findMany({
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
        if (
          attachments.some(
            (file) =>
              !file.fileName.trim() ||
              file.sizeBytes <= 0 ||
              file.sizeBytes > MAX_ATTACHMENT_BYTES ||
              !validateAttachmentMime(file.mimeType),
          )
        ) {
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

      const timeCheck = validateBookingTime({
        startTime,
        endTime,
        availabilityStartTime: availability.startTime,
        availabilityEndTime: availability.endTime,
        now,
      });

      if (!timeCheck.valid) {
        if (timeCheck.reason === 'Start time must align with availability start') {
          throw new BookingError(
            400,
            'Start time must be a whole number of hours after the window opens.',
          );
        }
        throw new BookingError(400, timeCheck.reason);
      }

      const candidateConflicts = await tx.booking.findMany({
        where: {
          status: { not: 'CANCELLED' },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          OR: [
            { tutorId: input.tutorId },
            { studentId: input.studentId },
          ],
        },
        select: {
          id: true,
          tutorId: true,
          studentId: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      });

      const conflict = findBookingConflict(
        {
          tutorId: input.tutorId,
          studentId: input.studentId,
          startTime,
          endTime,
        },
        candidateConflicts,
      );

      if (conflict) {
        throw new BookingError(409, 'You already have a lesson at this time.');
      }

      // Mock payment succeeds in Sprint 1; validate & snapshot the subject's rate and apply multi-hour bundle discount (BR-09, CHG-03A).
      const price = calculateBookingPrice({
        hourlyPrice: Number(tutorSubject.hourlyPrice),
        durationHours: input.durationHours,
      });
      const hourlyPriceSnapshot = tutorSubject.hourlyPrice;
      const totalPrice = new Prisma.Decimal(price.totalPrice.toFixed(2));

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
          ...(attachmentIds.length > 0 || validatedInlineAttachments.length > 0
            ? {
                attachments: {
                  ...(attachmentIds.length > 0
                    ? { connect: attachmentIds.map((id) => ({ id })) }
                    : {}),
                  ...(validatedInlineAttachments.length > 0
                    ? {
                        create: validatedInlineAttachments.map((file) => ({
                          uploadedById: input.studentId,
                          fileName: file.fileName,
                          mimeType: file.mimeType,
                          sizeBytes: file.sizeBytes,
                          storageKey: randomUUID(),
                        })),
                      }
                    : {}),
                },
              }
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
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
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
        throw new BookingError(
          409,
          'This time is no longer available. Your payment was not taken.',
        );
      }
      throw error;
    }
  }
  throw new BookingError(
    409,
    'This time is no longer available. Your payment was not taken.',
  );
}

export interface CancelBookingInput {
  bookingId: number;
  actorId: number;
  actorRole: 'STUDENT' | 'TUTOR' | 'ADMIN';
  reason?: string | null;
  now?: Date;
}

async function cancelBookingAttempt(input: CancelBookingInput): Promise<{
  bookingId: number;
  refundPercentage: 100 | 50 | 0;
  refundAmount: number;
}> {
  const now = input.now ?? new Date();

  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
      });

      if (!booking) {
        throw new BookingError(404, 'Booking not found.');
      }

      const isStudentOwner =
        input.actorRole === 'STUDENT' && booking.studentId === input.actorId;
      const isTutorOwner =
        input.actorRole === 'TUTOR' && booking.tutorId === input.actorId;

      if (!isStudentOwner && !isTutorOwner) {
        throw new BookingError(
          403,
          'You are not allowed to cancel this booking.',
        );
      }

      if (booking.status !== 'CONFIRMED') {
        throw new BookingError(
          409,
          'Only confirmed bookings can be cancelled.',
        );
      }

      if (booking.startTime.getTime() <= now.getTime()) {
        throw new BookingError(
          400,
          'You can only cancel a booking before the lesson starts.',
        );
      }

      const totalPrice = Number(booking.totalPrice);
      const refund = isStudentOwner
        ? calculateStudentRefund({
            totalPrice,
            startTime: booking.startTime,
            now,
          })
        : calculateTutorRefund({
            totalPrice,
            startTime: booking.startTime,
            now,
          });

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: refund.paymentStatus,
          cancelledBy: input.actorRole,
          cancelledAt: now,
          refundPercentage: refund.refundPercentage,
          refundAmount: new Prisma.Decimal(refund.refundAmount.toFixed(2)),
        },
      });

      // BR-13: Student cancellation restores and merges availability.
      // BR-12: Tutor cancellation keeps the time slot permanently blocked.
      if (isStudentOwner) {
        await restoreAndMergeAvailability(
          tx,
          booking.tutorId,
          booking.startTime,
          booking.endTime,
        );
      }

      return {
        bookingId: booking.id,
        refundPercentage: refund.refundPercentage,
        refundAmount: refund.refundAmount,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function cancelBooking(input: CancelBookingInput): Promise<{
  bookingId: number;
  refundPercentage: 100 | 50 | 0;
  refundAmount: number;
}> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await cancelBookingAttempt(input);
    } catch (error) {
      if (getErrorCode(error) === 'P2034' && attempt === 0) {
        continue;
      }
      if (getErrorCode(error) === 'P2034') {
        throw new BookingError(
          409,
          'This booking conflicted with another update. Please try again.',
        );
      }
      throw error;
    }
  }
  throw new BookingError(
    409,
    'This booking conflicted with another update. Please try again.',
  );
}

export interface CompleteBookingInput {
  bookingId: number;
  actorId: number;
  actorRole: 'STUDENT' | 'TUTOR' | 'ADMIN';
  lessonSummary: unknown;
}

export async function completeBooking(input: CompleteBookingInput) {
  const summaryValidation = validateLessonSummary(input.lessonSummary);
  if (!summaryValidation.valid) {
    throw new BookingError(400, summaryValidation.reason);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
  });

  if (!booking) {
    throw new BookingError(404, 'Booking not found.');
  }

  try {
    assertCanCompleteBooking(booking, input.actorId, input.actorRole);
  } catch (error) {
    if (error instanceof LessonCompletionError) {
      throw new BookingError(error.statusCode, error.message);
    }
    throw error;
  }

  return prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'COMPLETED',
      lessonSummary: summaryValidation.trimmed,
    },
  });
}

