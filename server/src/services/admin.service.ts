import { prisma } from '../lib/prisma.js';

export async function getAdminSummary() {
  const [
    totalBookings,
    revenueResult,
    activeTutors,
    verifiedStudents,
    totalStudents,
  ] = await Promise.all([
    // Count all bookings, including cancelled bookings.
    prisma.booking.count(),

    // Revenue excludes cancelled bookings.
    prisma.booking.aggregate({
      where: {
        status: { not: 'CANCELLED' },
      },
      _sum: {
        totalPrice: true,
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
    mockRevenue: Number(revenueResult._sum.totalPrice ?? 0),
    activeTutors,
    verifiedStudents,
    totalStudents,
  };
}
