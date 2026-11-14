
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const HOUR_MS = 60 * 60 * 1000;

export class AvailabilityError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AvailabilityError';
  }
}

function validateAvailabilityInput(
  startTime: Date,
  endTime: Date,
): void {
  if (
    Number.isNaN(startTime.getTime()) ||
    Number.isNaN(endTime.getTime())
  ) {
    throw new AvailabilityError('Invalid availability time.', 400);
  }

  const minutes = startTime.getMinutes();

  if (
    (minutes !== 0 && minutes !== 30) ||
    startTime.getSeconds() !== 0 ||
    startTime.getMilliseconds() !== 0
  ) {
    throw new AvailabilityError(
      'Availability must start on :00 or :30.',
      400,
    );
  }

  const duration = endTime.getTime() - startTime.getTime();

  if (duration < HOUR_MS) {
    throw new AvailabilityError(
      'Availability must be at least 1 hour long.',
      400,
    );
  }

  if (duration % HOUR_MS !== 0) {
    throw new AvailabilityError(
      'Availability must last a whole number of hours.',
      400,
    );
  }

  if (startTime.getTime() <= Date.now()) {
    throw new AvailabilityError(
      'Availability must start in the future.',
      400,
    );
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

  validateAvailabilityInput(startTime, endTime);

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
        startTime: { gte: now },
      },
      orderBy: { startTime: 'asc' },
    }),

    prisma.booking.findMany({
      where: {
        tutorId,
        startTime: { gte: now },
        status: { not: 'CANCELLED' },
      },
      orderBy: { startTime: 'asc' },
    }),
  ]);

  return {
    availabilities,
    bookings: bookings.map((booking) => ({
      ...booking,
      hourlyPriceSnapshot: Number(booking.hourlyPriceSnapshot),
      totalPrice: Number(booking.totalPrice),
      refundAmount:
        booking.refundAmount === null
          ? null
          : Number(booking.refundAmount),
    })),
  };
}
