
import 'dotenv/config';

import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';

const isProduction = process.env.NODE_ENV === 'production';
const seedDemoData = process.env.SEED_DEMO_DATA?.trim().toLowerCase() !== 'false';

// Production passwords must come from environment variables.
const adminPassword = process.env.ADMIN_PASSWORD || (!isProduction ? 'password123' : '');
if (isProduction && !adminPassword) {
  throw new Error('ADMIN_PASSWORD environment variable must be set in production mode.');
}

const demoPassword = process.env.DEMO_USER_PASSWORD || process.env.ADMIN_PASSWORD || 'password123';

const seedAccounts = [
  {
    name: 'Alice',
    email: 'alice@tutorhub.dev',
    role: 'TUTOR' as const,
    isEmailVerified: true,
    isApproved: true,
  },
  {
    name: 'Bob',
    email: 'bob@tutorhub.dev',
    role: 'TUTOR' as const,
    isEmailVerified: true,
    isApproved: true,
  },
  {
    name: 'Charlie',
    email: 'charlie@tutorhub.dev',
    role: 'STUDENT' as const,
    isEmailVerified: true,
    isApproved: false,
  },
  {
    name: 'Diana',
    email: 'diana@tutorhub.dev',
    role: 'STUDENT' as const,
    isEmailVerified: false,
    isApproved: false,
  },
  {
    name: 'Admin User',
    email: 'admin@tutorhub.dev',
    role: 'ADMIN' as const,
    isEmailVerified: true,
    isApproved: true,
  },
];

const subjectData = [
  {
    name: 'Python Basics',
    description: 'Variables, control flow, functions',
  },
  {
    name: 'Data Structures',
    description: 'Lists, stacks, trees, graphs',
  },
  {
    name: 'Calculus I',
    description: 'Limits, derivatives, integrals',
  },
  {
    name: 'Linear Algebra',
    description: 'Vectors, matrices, eigenvalues',
  },
];

const tutorProfileData = [
  {
    email: 'alice@tutorhub.dev',
    bio: 'Fourth-year CompEng. I teach Python by debugging real code with you, not by reading slides.',
  },
  {
    email: 'bob@tutorhub.dev',
    bio: 'Math TA for two years. Bring the problem set you are stuck on and we will work through it.',
  },
];

const tutorSubjectData = [
  {
    tutorEmail: 'alice@tutorhub.dev',
    subjectName: 'Python Basics',
    hourlyPrice: 400,
    levels: ['HIGH_SCHOOL', 'UNDERGRADUATE'],
    topics: 'Variables, loops, functions and debugging your first programs.',
  },
  {
    tutorEmail: 'alice@tutorhub.dev',
    subjectName: 'Data Structures',
    hourlyPrice: 450,
    levels: ['UNDERGRADUATE'],
    topics: 'Linked lists, stacks, trees, hash tables and Big-O for exams.',
  },
  {
    tutorEmail: 'bob@tutorhub.dev',
    subjectName: 'Calculus I',
    hourlyPrice: 350,
    levels: ['HIGH_SCHOOL', 'UNDERGRADUATE'],
    topics: 'Limits, derivatives and integrals, with past-paper practice.',
  },
  {
    tutorEmail: 'bob@tutorhub.dev',
    subjectName: 'Linear Algebra',
    hourlyPrice: 380,
    levels: ['UNDERGRADUATE', 'GRADUATE'],
    topics: 'Matrices, vector spaces, eigenvalues and proofs.',
  },
];

function at(
  now: Date,
  dayOffset: number,
  hours: number,
  minutes = 0,
): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hours,
    minutes,
  );
}

async function main() {
  const now = new Date();
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const demoPasswordHash = seedDemoData
    ? await bcrypt.hash(demoPassword, 12)
    : '';

  const availabilityData = [
    { email: 'alice@tutorhub.dev', start: [1, 9, 30], end: [1, 12, 30] },
    { email: 'alice@tutorhub.dev', start: [2, 13, 0], end: [2, 14, 0] },
    { email: 'alice@tutorhub.dev', start: [2, 15, 0], end: [2, 17, 0] },
    { email: 'bob@tutorhub.dev', start: [1, 10, 0], end: [1, 12, 0] },
    { email: 'bob@tutorhub.dev', start: [2, 13, 30], end: [2, 16, 30] },
    { email: 'bob@tutorhub.dev', start: [4, 9, 0], end: [4, 10, 0] },
    { email: 'bob@tutorhub.dev', start: [4, 12, 0], end: [4, 13, 0] },
  ] as const;

  const bookingData = [
    {
      studentEmail: 'charlie@tutorhub.dev',
      tutorEmail: 'alice@tutorhub.dev',
      subjectName: 'Python Basics',
      startTime: at(now, 2, 14),
      endTime: at(now, 2, 15),
      durationHours: 1,
      hourlyPriceSnapshot: 400,
      notes: 'Loops and list comprehensions, please.',
    },
    {
      studentEmail: 'charlie@tutorhub.dev',
      tutorEmail: 'bob@tutorhub.dev',
      subjectName: 'Calculus I',
      startTime: at(now, 4, 10),
      endTime: at(now, 4, 12),
      durationHours: 2,
      hourlyPriceSnapshot: 300,
      notes: 'Limits and derivatives before the midterm.',
    },
  ];

  // 1. Create or update accounts (admin only when SEED_DEMO_DATA=false).
  const accountsToSeed = seedDemoData
    ? seedAccounts
    : seedAccounts.filter((account) => account.role === 'ADMIN');

  const userIds = new Map<string, number>();

  for (const account of accountsToSeed) {
    const passwordHash = account.role === 'ADMIN' ? adminPasswordHash : demoPasswordHash;

    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        ...account,
        password: passwordHash,
      },
      update: {
        name: account.name,
        role: account.role,
        isEmailVerified: account.isEmailVerified,
        isApproved: account.isApproved,
        // Existing user password is intentionally NOT overwritten on rerun
      },
    });

    userIds.set(account.email, user.id);
  }

  // 2. Create or update subjects.
  const subjectIds = new Map<string, number>();

  for (const subject of subjectData) {
    const result = await prisma.subject.upsert({
      where: { name: subject.name },
      create: subject,
      update: {
        description: subject.description,
      },
    });

    subjectIds.set(subject.name, result.id);
  }

  if (seedDemoData) {
    // 3. Create or update tutor profiles.
    const profileIds = new Map<string, number>();

    for (const profile of tutorProfileData) {
      const userId = userIds.get(profile.email);

      if (userId === undefined) {
        throw new Error(`Missing tutor account: ${profile.email}`);
      }

      const result = await prisma.tutorProfile.upsert({
        where: { userId },
        create: {
          userId,
          bio: profile.bio,
        },
        update: {
          bio: profile.bio,
        },
      });

      profileIds.set(profile.email, result.id);
    }

    // 4. Create or update tutor subjects.
    for (const item of tutorSubjectData) {
      const tutorProfileId = profileIds.get(item.tutorEmail);
      const subjectId = subjectIds.get(item.subjectName);

      if (tutorProfileId === undefined || subjectId === undefined) {
        throw new Error(`Missing tutor or subject: ${item.subjectName}`);
      }

      await prisma.tutorSubject.upsert({
        where: {
          tutorProfileId_subjectId: {
            tutorProfileId,
            subjectId,
          },
        },
        create: {
          tutorProfileId,
          subjectId,
          hourlyPrice: item.hourlyPrice,
          levels: item.levels as (
            | 'HIGH_SCHOOL'
            | 'UNDERGRADUATE'
            | 'GRADUATE'
          )[],
          topics: item.topics,
        },
        update: {
          hourlyPrice: item.hourlyPrice,
          levels: item.levels as (
            | 'HIGH_SCHOOL'
            | 'UNDERGRADUATE'
            | 'GRADUATE'
          )[],
          topics: item.topics,
        },
      });
    }

    // 5. Create demo availabilities.
    for (const item of availabilityData) {
      const tutorId = userIds.get(item.email);

      if (tutorId === undefined) {
        throw new Error(`Missing tutor: ${item.email}`);
      }

      const startTime = at(now, ...item.start);
      const endTime = at(now, ...item.end);

      const existing = await prisma.availability.findFirst({
        where: {
          tutorId,
          startTime,
          endTime,
        },
      });

      if (!existing) {
        await prisma.availability.create({
          data: {
            tutorId,
            startTime,
            endTime,
          },
        });
      }
    }

    // 6. Create demo bookings.
    for (const item of bookingData) {
      const studentId = userIds.get(item.studentEmail);
      const tutorId = userIds.get(item.tutorEmail);
      const subjectId = subjectIds.get(item.subjectName);

      if (
        studentId === undefined ||
        tutorId === undefined ||
        subjectId === undefined
      ) {
        throw new Error(`Missing booking relation: ${item.notes}`);
      }

      const existing = await prisma.booking.findFirst({
        where: {
          studentId,
          tutorId,
          subjectId,
          notes: item.notes,
        },
      });

      if (!existing) {
        await prisma.booking.create({
          data: {
            studentId,
            tutorId,
            subjectId,
            startTime: item.startTime,
            endTime: item.endTime,
            durationHours: item.durationHours,
            hourlyPriceSnapshot: item.hourlyPriceSnapshot,
            totalPrice:
              item.hourlyPriceSnapshot * item.durationHours,
            notes: item.notes,
            status: 'CONFIRMED',
            paymentStatus: 'SUCCESS',
          },
        });
      }
    }
  }

  console.log('TutorHub seed completed successfully.');
  console.log(`Accounts: ${accountsToSeed.length}${!seedDemoData ? ' (Admin only)' : ''}`);
  console.log(`Subjects: ${subjectData.length}`);
  if (seedDemoData) {
    console.log(`Tutor profiles: ${tutorProfileData.length}`);
    console.log(`Tutor subjects: ${tutorSubjectData.length}`);
    console.log(`Availability windows: ${availabilityData.length}`);
    console.log(`Demo bookings: ${bookingData.length}`);
  } else {
    console.log('Demo data omitted (SEED_DEMO_DATA=false).');
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
