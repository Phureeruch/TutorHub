import { prisma } from '../lib/prisma.js';
import { calculateRetainedRevenue } from '../utils/admin-metrics.js';

export async function getAdminSummary() {
  const [
    totalBookings,
    bookings,
    activeTutors,
    verifiedStudents,
    totalStudents,
  ] = await Promise.all([
    // Count all bookings, including cancelled bookings.
    prisma.booking.count(),

    // Fetch booking price and refund data to calculate retained revenue (DEF-08).
    prisma.booking.findMany({
      select: {
        status: true,
        totalPrice: true,
        refundAmount: true,
      },
    }),

    // Only approved tutors are considered active.
    prisma.user.count({
      where: {
        role: 'TUTOR',
        isApproved: true,
      },
    }),

    // Count verified student accounts.
    prisma.user.count({
      where: {
        role: 'STUDENT',
        isEmailVerified: true,
      },
    }),

    // Count all student accounts.
    prisma.user.count({
      where: {
        role: 'STUDENT',
      },
    }),
  ]);

  return {
    totalBookings,
    mockRevenue: calculateRetainedRevenue(bookings),
    activeTutors,
    verifiedStudents,
    totalStudents,
  };
}

export async function getPendingTutors() {
  const tutors = await prisma.user.findMany({
    where: {
      role: 'TUTOR',
      isApproved: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isApproved: true,
      createdAt: true,
      tutorProfile: {
        select: {
          bio: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return tutors.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    role: t.role,
    isApproved: t.isApproved,
    createdAt: t.createdAt,
    bio: t.tutorProfile?.bio ?? null,
  }));
}

export async function approveTutor(tutorId: number) {
  const user = await prisma.user.findUnique({
    where: { id: tutorId },
    select: { id: true, name: true, email: true, role: true, isApproved: true },
  });

  if (!user || user.role !== 'TUTOR') {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: tutorId },
      data: { isApproved: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
      },
    });

    await tx.tutorProfile.upsert({
      where: { userId: tutorId },
      update: {},
      create: {
        userId: tutorId,
        bio: '',
      },
    });

    return updatedUser;
  });
}

export async function createSubject(data: { name: string; description: string | null }) {
  const duplicate = await prisma.subject.findFirst({
    where: {
      name: {
        equals: data.name,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  if (duplicate) {
    return { duplicate: true as const, subject: null };
  }

  const subject = await prisma.subject.create({
    data: {
      name: data.name,
      description: data.description,
    },
  });

  return { duplicate: false as const, subject };
}

export async function updateSubject(
  subjectId: number,
  data: { name: string; description: string | null },
) {
  const existing = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true },
  });

  if (!existing) {
    return { notFound: true as const, duplicate: false as const, subject: null };
  }

  const duplicate = await prisma.subject.findFirst({
    where: {
      id: { not: subjectId },
      name: {
        equals: data.name,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  if (duplicate) {
    return { notFound: false as const, duplicate: true as const, subject: null };
  }

  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data: {
      name: data.name,
      description: data.description,
    },
  });

  return { notFound: false as const, duplicate: false as const, subject };
}
