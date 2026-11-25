
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { isSlotInBangkokTimeWindow } from '../utils/discovery-time.js';

const HOUR_MS = 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export type TeachingLevel =
  | 'HIGH_SCHOOL'
  | 'UNDERGRADUATE'
  | 'GRADUATE';

export interface TutorDirectoryFilter {
  subjectId?: number;
  tutorId?: number;
  date?: string;
  level?: TeachingLevel;
  startHour?: string;
  endHour?: string;
}

function getBangkokDayRange(date: string) {
  const [year, month, day] = date.split('-').map(Number);

  const start = Date.UTC(year!, month! - 1, day!) - BANGKOK_OFFSET_MS;

  return {
    start: new Date(start),
    end: new Date(start + 24 * HOUR_MS),
  };
}

function hasFutureBookableSlot(
  startTime: Date,
  endTime: Date,
  now: Date,
  dateRange?: { start: Date; end: Date },
  startHour?: string,
  endHour?: string,
): boolean {
  const start = startTime.getTime();
  const end = endTime.getTime();

  const slotCount = Math.floor((end - start) / HOUR_MS);

  for (let i = 0; i < slotCount; i++) {
    const slotStart = start + i * HOUR_MS;
    const slotEnd = slotStart + HOUR_MS;

    if (slotStart <= now.getTime()) {
      continue;
    }

    if (
      dateRange &&
      (slotStart < dateRange.start.getTime() ||
        slotEnd > dateRange.end.getTime())
    ) {
      continue;
    }

    if (
      (startHour !== undefined || endHour !== undefined) &&
      !isSlotInBangkokTimeWindow(
        new Date(slotStart),
        new Date(slotEnd),
        startHour,
        endHour,
      )
    ) {
      continue;
    }

    return true;
  }

  return false;
}

export async function getSubjects() {
  return prisma.subject.findMany({
    orderBy: { id: 'asc' },
  });
}

export async function getApprovedTutors() {
  return prisma.user.findMany({
    where: {
      role: 'TUTOR',
      isApproved: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function listTutorDirectory(
  filters: TutorDirectoryFilter,
) {
  const now = new Date();

  const dateRange =
    filters.date !== undefined
      ? getBangkokDayRange(filters.date)
      : undefined;

  const where: Prisma.UserWhereInput = {
    role: 'TUTOR',
    isApproved: true,
    tutorProfile: {
      is: {},
    },
  };

  if (filters.tutorId !== undefined) {
    where.id = filters.tutorId;
  }

  if (
    filters.subjectId !== undefined ||
    filters.level !== undefined
  ) {
    const subjectFilter: Prisma.TutorSubjectWhereInput = {};

    if (filters.subjectId !== undefined) {
      subjectFilter.subjectId = filters.subjectId;
    }

    if (filters.level !== undefined) {
      subjectFilter.levels = { has: filters.level };
    }

    where.tutorProfile = {
      is: {
        subjects: {
          some: subjectFilter,
        },
      },
    };
  }

  const availabilityDateFilter = dateRange
    ? {
        startTime: { lt: dateRange.end },
        endTime: { gt: dateRange.start },
      }
    : {};

  const tutors = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      role: true,
      isApproved: true,

      tutorProfile: {
        include: {
          subjects: {
            include: {
              subject: true,
            },
            orderBy: {
              subjectId: 'asc',
            },
          },
        },
      },

      availabilities: {
        where: {
          endTime: { gt: now },
          ...availabilityDateFilter,
        },
        orderBy: {
          startTime: 'asc',
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return tutors
    .map((tutor) => {
      const profile = tutor.tutorProfile;

      if (!profile) {
        return null;
      }

      const availabilities = tutor.availabilities.filter(
        (availability) =>
          hasFutureBookableSlot(
            availability.startTime,
            availability.endTime,
            now,
            dateRange,
            filters.startHour,
            filters.endHour,
          ),
      );

      return {
        user: {
          id: tutor.id,
          name: tutor.name,
          role: tutor.role,
          isApproved: tutor.isApproved,
        },

        profile: {
          id: profile.id,
          userId: profile.userId,
          bio: profile.bio,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },

        subjects: profile.subjects.map((link) => ({
          ...link.subject,
          hourlyPrice: Number(link.hourlyPrice),
          levels: link.levels,
          topics: link.topics,
        })),

        availabilities,
      };
    })
    .filter((tutor) => tutor !== null)
    .filter(
      (tutor) =>
        (filters.date === undefined &&
          filters.startHour === undefined &&
          filters.endHour === undefined) ||
        tutor.availabilities.length > 0,
    );
}
