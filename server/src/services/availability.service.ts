import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { bookingInclude, toBookingDto } from '../routes/booking.routes.js';
import { mergeAdjacentIntervals } from '../utils/interval-merge.js';
import { validateAvailabilityWindow } from '../utils/time.validation.js';

export class AvailabilityError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AvailabilityError';
  }
}

function handleTransactionConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  ) {
    throw new AvailabilityError(
      'This availability conflicts with another change. Please try again.',
      409,
    );
  }

  throw error;
}

/**
 * BR-13: Inserts `[startTime, endTime]` for `tutorId` and merges it with any
 * adjacent availability rows (`endTime === startTime` or `startTime === endTime`)
 * inside the active Serializable transaction.
 */
export async function restoreAndMergeAvailability(
  tx: Prisma.TransactionClient,
  tutorId: number,
  startTime: Date,
  endTime: Date,
) {
  const touchingNeighbors = await tx.availability.findMany({
    where: {
      tutorId,
      OR: [{ endTime: startTime }, { startTime: endTime }],
    },
    orderBy: { startTime: 'asc' },
  });

  const mergedIntervals = mergeAdjacentIntervals([
    ...touchingNeighbors.map((row) => ({
      startTime: row.startTime,
      endTime: row.endTime,
    })),
    { startTime, endTime },
  ]);

  const consolidated = mergedIntervals[0] ?? { startTime, endTime };

  if (touchingNeighbors.length > 0) {
    await tx.availability.deleteMany({
      where: {
        id: { in: touchingNeighbors.map((row) => row.id) },
      },
    });
  }

  return tx.availability.create({
    data: {
      tutorId,
      startTime: consolidated.startTime,
      endTime: consolidated.endTime,
    },
  });
}

export async function createAvailability(
  tutorId: number,
  input: {
    startTime: Date;
    endTime: Date;
  },
) {
  const { startTime, endTime } = input;
  const check = validateAvailabilityWindow(startTime, endTime, new Date());
  if (!check.valid) {
    throw new AvailabilityError(check.reason, 400);
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const tutorUser = await tx.user.findUnique({
          where: { id: tutorId },
          select: { id: true, role: true, isApproved: true },
        });

        if (!tutorUser || tutorUser.role !== 'TUTOR' || !tutorUser.isApproved) {
          throw new AvailabilityError(
            'Your tutor account is pending administrator approval.',
            403,
          );
        }

        const overlappingAvailability = await tx.availability.findFirst({
          where: {
            tutorId,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          select: { id: true },
        });

        if (overlappingAvailability) {
          throw new AvailabilityError(
            'This overlaps availability you already offer.',
            400,
          );
        }

        const overlappingBooking = await tx.booking.findFirst({
          where: {
            tutorId,
            status: { not: 'CANCELLED' },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          select: { id: true },
        });

        if (overlappingBooking) {
          throw new AvailabilityError(
            'This overlaps a lesson that is already booked.',
            400,
          );
        }

        return restoreAndMergeAvailability(tx, tutorId, startTime, endTime);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    handleTransactionConflict(error);
  }
}

export async function updateAvailability(
  tutorId: number,
  availabilityId: number,
  input: {
    startTime: Date;
    endTime: Date;
  },
) {
  const { startTime, endTime } = input;
  const check = validateAvailabilityWindow(startTime, endTime, new Date());
  if (!check.valid) {
    throw new AvailabilityError(check.reason, 400);
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const tutorUser = await tx.user.findUnique({
          where: { id: tutorId },
          select: { id: true, role: true, isApproved: true },
        });

        if (!tutorUser || tutorUser.role !== 'TUTOR' || !tutorUser.isApproved) {
          throw new AvailabilityError(
            'Your tutor account is pending administrator approval.',
            403,
          );
        }

        const existing = await tx.availability.findUnique({
          where: { id: availabilityId },
        });

        if (!existing) {
          throw new AvailabilityError('Availability not found.', 404);
        }

        if (existing.tutorId !== tutorId) {
          throw new AvailabilityError(
            'You can only edit your own availability.',
            403,
          );
        }

        const overlappingAvailability = await tx.availability.findFirst({
          where: {
            tutorId,
            id: { not: availabilityId },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          select: { id: true },
        });

        if (overlappingAvailability) {
          throw new AvailabilityError(
            'This overlaps availability you already offer.',
            400,
          );
        }

        const overlappingBooking = await tx.booking.findFirst({
          where: {
            tutorId,
            status: { not: 'CANCELLED' },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          select: { id: true },
        });

        if (overlappingBooking) {
          throw new AvailabilityError(
            'This overlaps a lesson that is already booked.',
            400,
          );
        }

        await tx.availability.delete({
          where: { id: availabilityId },
        });

        return restoreAndMergeAvailability(tx, tutorId, startTime, endTime);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    handleTransactionConflict(error);
  }
}

export async function deleteAvailability(
  tutorId: number,
  availabilityId: number,
) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const availability = await tx.availability.findUnique({
          where: { id: availabilityId },
        });

        if (!availability) {
          throw new AvailabilityError('Availability not found.', 404);
        }

        if (availability.tutorId !== tutorId) {
          throw new AvailabilityError(
            'You can only remove your own availability.',
            403,
          );
        }

        const overlappingBooking = await tx.booking.findFirst({
          where: {
            tutorId,
            status: { not: 'CANCELLED' },
            startTime: { lt: availability.endTime },
            endTime: { gt: availability.startTime },
          },
          select: { id: true },
        });

        if (overlappingBooking) {
          throw new AvailabilityError(
            'You cannot remove availability that overlaps a booked lesson.',
            400,
          );
        }

        await tx.availability.delete({
          where: { id: availabilityId },
        });

        return {
          message: 'Availability removed successfully.',
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    handleTransactionConflict(error);
  }
}

export async function getTutorAvailability(tutorId: number) {
  const now = new Date();

  const [availabilities, bookings] = await Promise.all([
    prisma.availability.findMany({
      where: {
        tutorId,
        endTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
    }),

    prisma.booking.findMany({
      where: {
        tutorId,
        endTime: { gt: now },
        status: { not: 'CANCELLED' },
      },
      orderBy: { startTime: 'asc' },
      include: bookingInclude,
    }),
  ]);

  return {
    availabilities,
    bookings: bookings.map(toBookingDto),
  };
}
