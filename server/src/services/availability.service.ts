import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { bookingInclude, toBookingDto } from '../routes/booking.routes.js';
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
        const overlappingAvailability =
          await tx.availability.findFirst({
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

        return tx.availability.create({
          data: {
            tutorId,
            startTime,
            endTime,
          },
        });
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
          throw new AvailabilityError(
            'Availability not found.',
            404,
          );
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

export async function restoreAndMergeAvailability(
  _tx: Prisma.TransactionClient,
  _tutorId: number,
  _startTime: Date,
  _endTime: Date,
) {
  throw new AvailabilityError('Not implemented: restoreAndMergeAvailability', 500);
}

export async function updateAvailability(
  _tutorId: number,
  _availabilityId: number,
  _input: {
    startTime: Date;
    endTime: Date;
  },
) {
  throw new AvailabilityError('Not implemented: updateAvailability', 500);
}
