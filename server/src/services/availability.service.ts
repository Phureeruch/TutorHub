import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { bookingInclude, toBookingDto } from '../routes/booking.routes.js';
import { mergeAdjacentIntervals } from '../utils/interval-merge.js';
import {
  computeOverlapMs,
  getOverlappedBangkokDaysUtc,
  HOUR_MS,
  MAX_DAILY_TUTOR_HOURS,
  validateAvailabilityWindow,
} from '../utils/time.validation.js';

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

/**
 * BR-04 (CHG-03C): Enforces that a tutor's combined open Availability hours
 * and non-cancelled Booking hours on any overlapped Asia/Bangkok (UTC+7)
 * calendar day do not exceed MAX_DAILY_TUTOR_HOURS (8 hours).
 */
async function assertDailyTutorCapacity(
  tx: Prisma.TransactionClient,
  tutorId: number,
  startTime: Date,
  endTime: Date,
  excludeAvailabilityId?: number,
): Promise<void> {
  const bangkokDays = getOverlappedBangkokDaysUtc(startTime, endTime);

  for (const { dayStartUtc, dayEndUtc } of bangkokDays) {
    const [availabilities, bookings] = await Promise.all([
      tx.availability.findMany({
        where: {
          tutorId,
          ...(excludeAvailabilityId !== undefined
            ? { id: { not: excludeAvailabilityId } }
            : {}),
          startTime: { lt: dayEndUtc },
          endTime: { gt: dayStartUtc },
        },
        select: { startTime: true, endTime: true },
      }),
      tx.booking.findMany({
        where: {
          tutorId,
          status: { not: 'CANCELLED' },
          startTime: { lt: dayEndUtc },
          endTime: { gt: dayStartUtc },
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    let totalDayMs = computeOverlapMs(startTime, endTime, dayStartUtc, dayEndUtc);
    for (const av of availabilities) {
      totalDayMs += computeOverlapMs(av.startTime, av.endTime, dayStartUtc, dayEndUtc);
    }
    for (const bk of bookings) {
      totalDayMs += computeOverlapMs(bk.startTime, bk.endTime, dayStartUtc, dayEndUtc);
    }

    if (totalDayMs > MAX_DAILY_TUTOR_HOURS * HOUR_MS) {
      throw new AvailabilityError(
        'Daily tutor availability and booked lessons cannot exceed 8 hours per day.',
        400,
      );
    }
  }
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

        await assertDailyTutorCapacity(tx, tutorId, startTime, endTime);

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

        await assertDailyTutorCapacity(
          tx,
          tutorId,
          startTime,
          endTime,
          availabilityId,
        );

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
