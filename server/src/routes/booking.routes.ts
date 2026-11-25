import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, type AuthenticatedUser } from '../middleware/auth.js';
import {
  BookingError,
  cancelBooking,
  completeBooking,
  createBooking,
} from '../services/booking.service.js';

const router = Router();

export const bookingInclude = {
  student: { select: { id: true, name: true } },
  tutor: {
    select: {
      id: true,
      name: true,
      tutorProfile: {
        select: {
          subjects: {
            select: { subjectId: true, hourlyPrice: true },
          },
        },
      },
    },
  },
  subject: { select: { id: true, name: true } },
  attachments: {
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

// Populate res.locals.user before every booking handler runs.
router.use(authenticate);

function getAuthenticatedUser(res: Response): AuthenticatedUser | null {
  const user = res.locals.user as Partial<AuthenticatedUser> | undefined;
  if (
    !user ||
    !Number.isInteger(user.id) ||
    !['STUDENT', 'TUTOR', 'ADMIN'].includes(String(user.role))
  ) {
    return null;
  }
  return user as AuthenticatedUser;
}

export function toBookingDto(booking: BookingWithRelations) {
  const currentRate = booking.tutor.tutorProfile?.subjects.find(
    (item) => item.subjectId === booking.subjectId,
  );

  return {
    id: booking.id,
    studentId: booking.studentId,
    tutorId: booking.tutorId,
    subjectId: booking.subjectId,
    student: booking.student,
    tutor: { id: booking.tutor.id, name: booking.tutor.name },
    subject: booking.subject,
    startTime: booking.startTime,
    endTime: booking.endTime,
    durationHours: booking.durationHours,
    hourlyPriceSnapshot: Number(booking.hourlyPriceSnapshot),
    totalPrice: Number(booking.totalPrice),
    currentHourlyPrice: currentRate ? Number(currentRate.hourlyPrice) : null,
    notes: booking.notes,
    attachments: booking.attachments.map((file) => ({
      id: file.id,
      name: file.fileName,
      size: file.sizeBytes,
      type: file.mimeType,
    })),
    lessonSummary: booking.lessonSummary,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    cancelledBy: booking.cancelledBy,
    cancelledAt: booking.cancelledAt,
    refundPercentage: booking.refundPercentage,
    refundAmount:
      booking.refundAmount === null ? null : Number(booking.refundAmount),
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

function isValidInlineAttachmentArray(
  value: unknown,
): value is { name: string; size: number; type: string }[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { name?: unknown }).name === 'string' &&
      typeof (item as { size?: unknown }).size === 'number' &&
      typeof (item as { type?: unknown }).type === 'string',
  );
}

// GET /api/bookings
// Student: own bookings. Tutor: own assigned bookings. Admin: all bookings.
router.get('/', async (_req: Request, res: Response) => {
  const user = getAuthenticatedUser(res);
  if (!user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const where =
      user.role === 'STUDENT'
        ? { studentId: user.id }
        : user.role === 'TUTOR'
          ? { tutorId: user.id }
          : {};

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: bookingInclude,
    });

    res.status(200).json(bookings.map(toBookingDto));
  } catch {
    res.status(500).json({ message: 'Unable to retrieve bookings.' });
  }
});

// GET /api/bookings/:id
// Check existence first: missing bookings return 404; existing non-owned bookings return 403.
router.get('/:id', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(res);
  if (!user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    res.status(404).json({ message: 'Booking not found.' });
    return;
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingInclude,
    });

    if (!booking) {
      res.status(404).json({ message: 'Booking not found.' });
      return;
    }

    const isOwner =
      (user.role === 'STUDENT' && booking.studentId === user.id) ||
      (user.role === 'TUTOR' && booking.tutorId === user.id) ||
      user.role === 'ADMIN';

    if (!isOwner) {
      res.status(403).json({ message: 'You are not allowed to view this booking.' });
      return;
    }

    res.status(200).json(toBookingDto(booking));
  } catch {
    res.status(500).json({ message: 'Unable to retrieve booking.' });
  }
});

// POST /api/bookings
// Requires authenticated STUDENT role. Never accept studentId from the request body.
router.post('/', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(res);
  if (!user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }
  if (user.role !== 'STUDENT') {
    res.status(403).json({ message: 'Only students can book lessons.' });
    return;
  }

  const {
    tutorId,
    subjectId,
    startTime,
    durationHours,
    notes,
    attachmentIds,
    attachments,
  } = req.body ?? {};

  if (
    !Number.isInteger(tutorId) ||
    tutorId <= 0 ||
    !Number.isInteger(subjectId) ||
    subjectId <= 0 ||
    typeof startTime !== 'string' ||
    typeof durationHours !== 'number' ||
    (notes !== undefined && notes !== null && typeof notes !== 'string') ||
    (attachmentIds !== undefined && !Array.isArray(attachmentIds)) ||
    (attachments !== undefined && !isValidInlineAttachmentArray(attachments))
  ) {
    res.status(400).json({ message: 'Invalid booking request.' });
    return;
  }

  try {
    const created = await createBooking({
      studentId: user.id,
      tutorId,
      subjectId,
      startTime,
      durationHours,
      notes: notes ?? null,
      attachmentIds,
      attachments,
    });

    // Reload with the same DTO relations used by GET endpoints, including current subject rate.
    const booking = await prisma.booking.findUnique({
      where: { id: created.id },
      include: bookingInclude,
    });

    if (!booking) {
      res.status(500).json({ message: 'Unable to retrieve created booking.' });
      return;
    }

    res.status(201).json(toBookingDto(booking));
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Unable to create booking.' });
  }
});

// PATCH /api/bookings/:id/cancel
// Student owner: 3-tier refund + restore & merge availability (BR-11, BR-13).
// Tutor owner: 100% refund + keep time slot permanently blocked (BR-12).
router.patch('/:id/cancel', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(res);
  if (!user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    res.status(404).json({ message: 'Booking not found.' });
    return;
  }

  const { reason } = req.body ?? {};
  if (
    reason !== undefined &&
    reason !== null &&
    (typeof reason !== 'string' || reason.trim().length > 300)
  ) {
    res.status(400).json({ message: 'Invalid cancellation reason.' });
    return;
  }

  try {
    const result = await cancelBooking({
      bookingId,
      actorId: user.id,
      actorRole: user.role,
      reason: reason ?? null,
    });

    const booking = await prisma.booking.findUnique({
      where: { id: result.bookingId },
      include: bookingInclude,
    });

    if (!booking) {
      res.status(500).json({ message: 'Unable to retrieve cancelled booking.' });
      return;
    }

    res.status(200).json({
      message: 'Booking cancelled successfully.',
      refundPercentage: result.refundPercentage,
      refundAmount: result.refundAmount,
      booking: toBookingDto(booking),
    });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Unable to cancel booking.' });
  }
});

// PATCH /api/bookings/:id/complete
// Assigned Tutor marks a confirmed booking as COMPLETED and records lessonSummary (F-16).
router.patch('/:id/complete', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(res);
  if (!user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    res.status(404).json({ message: 'Booking not found.' });
    return;
  }

  const { lessonSummary } = req.body ?? {};

  try {
    const updated = await completeBooking({
      bookingId,
      actorId: user.id,
      actorRole: user.role,
      lessonSummary,
    });

    const booking = await prisma.booking.findUnique({
      where: { id: updated.id },
      include: bookingInclude,
    });

    if (!booking) {
      res.status(500).json({ message: 'Unable to retrieve completed booking.' });
      return;
    }

    res.status(200).json({
      message: 'Lesson marked as completed.',
      booking: toBookingDto(booking),
    });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Unable to mark lesson as completed.' });
  }
});

// PUT or PATCH /api/bookings/:id (BR-10: Confirmed booking schedule fields are immutable)
router.put('/:id', (_req: Request, res: Response) => {
  res.status(404).json({
    message:
      'Confirmed bookings cannot be modified directly. Cancel and book a new lesson instead.',
  });
});

router.patch('/:id', (_req: Request, res: Response) => {
  res.status(404).json({
    message:
      'Confirmed bookings cannot be modified directly. Cancel and book a new lesson instead.',
  });
});

export default router;
