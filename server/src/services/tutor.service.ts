import { prisma } from '../lib/prisma.js';

const VALID_LEVELS = [
  'HIGH_SCHOOL',
  'UNDERGRADUATE',
  'GRADUATE',
] as const;

type TeachingLevelValue = (typeof VALID_LEVELS)[number];

export class TutorError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'TutorError';
  }
}

interface TutorSubjectInput {
  subjectId: number;
  hourlyPrice: number;
  levels: string[];
  topics?: string | null;
}

interface UpdateTutorProfileInput {
  bio?: string;
  subjects: TutorSubjectInput[];
}

function isValidLevel(level: string): level is TeachingLevelValue {
  return VALID_LEVELS.includes(level as TeachingLevelValue);
}

const profileInclude = {
  user: {
    select: {
      id: true,
      name: true,
      role: true,
      isApproved: true,
    },
  },
  subjects: {
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      subjectId: 'asc' as const,
    },
  },
} as const;

function buildProfileResponse(profile: {
  id: number;
  userId: number;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    name: string;
    role: string;
    isApproved: boolean;
  };
  subjects: {
    subjectId: number;
    hourlyPrice: { toNumber(): number };
    levels: string[];
    topics: string | null;
    subject: {
      id: number;
      name: string;
      description: string | null;
      createdAt: Date;
    };
  }[];
}) {
  return {
    user: profile.user,
    profile: {
      id: profile.id,
      userId: profile.userId,
      bio: profile.bio,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
    subjects: profile.subjects.map((item) => ({
      id: item.subject.id,
      name: item.subject.name,
      description: item.subject.description,
      createdAt: item.subject.createdAt,
      hourlyPrice: item.hourlyPrice.toNumber(),
      levels: item.levels,
      topics: item.topics,
    })),
  };
}

export async function getTutorProfile(userId: number) {
  const profile = await prisma.tutorProfile.findUnique({
    where: { userId },
    include: profileInclude,
  });

  if (!profile) {
    throw new TutorError('Tutor profile not found.', 404);
  }

  return buildProfileResponse(profile);
}

export async function updateTutorProfile(
  userId: number,
  input: UpdateTutorProfileInput,
) {
  // Keep the last entry when the same subject appears more than once.
  const uniqueSubjects = new Map<number, TutorSubjectInput>();

  for (const item of input.subjects) {
    uniqueSubjects.set(item.subjectId, item);
  }

  const requestedSubjects = [...uniqueSubjects.values()];

  const subjectRecords = await prisma.subject.findMany({
    where: {
      id: {
        in: requestedSubjects.map((item) => item.subjectId),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const subjectMap = new Map(
    subjectRecords.map((subject) => [subject.id, subject]),
  );

  // Unknown subject IDs are ignored.
  const validSubjects = requestedSubjects.filter((item) =>
    subjectMap.has(item.subjectId),
  );

  if (validSubjects.length === 0) {
    throw new TutorError('Choose at least one subject you teach.', 400);
  }

  const normalizedSubjects = validSubjects.map((item) => {
    const subject = subjectMap.get(item.subjectId)!;

    if (
      typeof item.hourlyPrice !== 'number' ||
      !Number.isFinite(item.hourlyPrice) ||
      item.hourlyPrice <= 0
    ) {
      throw new TutorError(
        `${subject.name}: hourly rate must be more than 0.`,
        400,
      );
    }

    if (
      !Array.isArray(item.levels) ||
      item.levels.some((level) => !isValidLevel(level))
    ) {
      throw new TutorError(`${subject.name}: unknown level.`, 400);
    }

    const levels = VALID_LEVELS.filter((level) =>
      item.levels.includes(level),
    );

    const topics = item.topics?.trim() || null;

    if (topics && topics.length > 200) {
      throw new TutorError(
        `${subject.name}: keep topics to 200 characters.`,
        400,
      );
    }

    return {
      subjectId: item.subjectId,
      hourlyPrice: item.hourlyPrice,
      levels,
      topics,
    };
  });

  return prisma.$transaction(async (tx) => {
    const existingProfile = await tx.tutorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    const profile = existingProfile
      ? await tx.tutorProfile.update({
          where: { userId },
          data: {
            ...(input.bio !== undefined
              ? { bio: input.bio.trim() || null }
              : {}),
          },
          select: { id: true },
        })
      : await tx.tutorProfile.create({
          data: {
            userId,
            bio: input.bio?.trim() || null,
          },
          select: { id: true },
        });

    await tx.tutorSubject.deleteMany({
      where: { tutorProfileId: profile.id },
    });

    await tx.tutorSubject.createMany({
      data: normalizedSubjects.map((item) => ({
        tutorProfileId: profile.id,
        subjectId: item.subjectId,
        hourlyPrice: item.hourlyPrice,
        levels: item.levels,
        topics: item.topics,
      })),
    });

    const updatedProfile = await tx.tutorProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: profileInclude,
    });

    return buildProfileResponse(updatedProfile);
  });
}
