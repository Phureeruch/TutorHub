import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BookingError, createBooking } from '../services/booking.service.js';

const router = Router();

interface AuthenticatedUser {
  id: number;
  role: 'STUDENT' | 'TUTOR' | 'ADMIN';
}

const bookingInclude = {
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
  },
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

// Auth middleware must populate res.locals.user before these handlers run.
// Never accept studentId or tutorId from the request body.
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

function toBookingDto(booking: BookingWithRelations) {
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
// Requires authenticated STUDENT role.
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

  const { tutorId, subjectId, startTime, durationHours, notes, attachmentIds } =
    req.body ?? {};

  if (
    !Number.isInteger(tutorId) ||
    tutorId <= 0 ||
    !Number.isInteger(subjectId) ||
    subjectId <= 0 ||
    typeof startTime !== 'string' ||
    !Number.isInteger(durationHours) ||
    (notes !== undefined && notes !== null && typeof notes !== 'string') ||
    (attachmentIds !== undefined && !Array.isArray(attachmentIds))
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

export default router;
