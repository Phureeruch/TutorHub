import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, test } from 'node:test';
import { config } from 'dotenv';

config();

// Integration tests must never run against the normal development database.
const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error('DATABASE_URL is not configured');

const databaseUrl = new URL(configuredUrl);
if (!['/tutorhub', '/tutorhub_test'].includes(databaseUrl.pathname)) {
  throw new Error('Unexpected database name. Test execution stopped.');
}
databaseUrl.pathname = '/tutorhub_test';
process.env.DATABASE_URL = databaseUrl.toString();

const { prisma } = await import('../src/lib/prisma.js');
const { createBooking, BookingError } =
  await import('../src/services/booking.service.js');

const userIds: number[] = [];
const subjectIds: number[] = [];
const tutorProfileIds: number[] = [];
const availabilityIds: number[] = [];
const bookingIds: number[] = [];

async function createUser(role: 'STUDENT' | 'TUTOR', options?: {
  verified?: boolean;
  approved?: boolean;
}) {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${randomUUID()}@test.com`,
      password: 'test-password-hash',
      name: `Test ${role}`,
      role,
      isEmailVerified: options?.verified ?? true,
      isApproved: options?.approved ?? true,
    },
  });
  userIds.push(user.id);
  return user;
}

async function createFixture() {
  const student = await createUser('STUDENT');
  const tutor = await createUser('TUTOR');
  const profile = await prisma.tutorProfile.create({
    data: { userId: tutor.id, bio: 'Integration test tutor' },
  });
  tutorProfileIds.push(profile.id);

  const subject = await prisma.subject.create({
    data: { name: `Test Subject ${randomUUID()}` },
  });
  subjectIds.push(subject.id);

  await prisma.tutorSubject.create({
    data: {
      tutorProfileId: profile.id,
      subjectId: subject.id,
      hourlyPrice: '400.00',
    },
  });

  const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
  startTime.setMinutes(0, 0, 0);
  const availability = await prisma.availability.create({
    data: {
      tutorId: tutor.id,
      startTime,
      endTime: new Date(startTime.getTime() + 4 * 60 * 60 * 1000),
    },
  });
  availabilityIds.push(availability.id);

  return { student, tutor, subject, availability };
}

function bookingInput(f: Awaited<ReturnType<typeof createFixture>>, overrides: {
  studentId?: number;
  startTime?: Date;
  durationHours?: number;
} = {}) {
  return {
    studentId: overrides.studentId ?? f.student.id,
    tutorId: f.tutor.id,
    subjectId: f.subject.id,
    startTime: overrides.startTime ?? f.availability.startTime,
    durationHours: overrides.durationHours ?? 1,
    notes: 'Integration test lesson',
  };
}

afterEach(async () => {
  if (bookingIds.length) {
    await prisma.bookingAttachment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }
  if (availabilityIds.length) {
    await prisma.availability.deleteMany({ where: { id: { in: availabilityIds } } });
    // A successful booking may have created leftover availability rows.
    await prisma.availability.deleteMany({ where: { tutorId: { in: userIds } } });
  }
  if (tutorProfileIds.length) {
    await prisma.tutorSubject.deleteMany({ where: { tutorProfileId: { in: tutorProfileIds } } });
    await prisma.tutorProfile.deleteMany({ where: { id: { in: tutorProfileIds } } });
  }
  if (subjectIds.length) await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  bookingIds.length = 0;
  availabilityIds.length = 0;
  tutorProfileIds.length = 0;
  subjectIds.length = 0;
  userIds.length = 0;
});

after(async () => {
  await prisma.$disconnect();
});

test('creates a booking, snapshots the subject price, and splits availability', async () => {
  const f = await createFixture();
  const booking = await createBooking(bookingInput(f));
  bookingIds.push(booking.id);

  assert.equal(booking.studentId, f.student.id);
  assert.equal(booking.tutorId, f.tutor.id);
  assert.equal(booking.subjectId, f.subject.id);
  assert.equal(booking.status, 'CONFIRMED');
  assert.equal(booking.paymentStatus, 'SUCCESS');
  assert.equal(booking.hourlyPriceSnapshot.toString(), '400');
  assert.equal(booking.totalPrice.toString(), '400');

  const remaining = await prisma.availability.findMany({
    where: { tutorId: f.tutor.id },
    orderBy: { startTime: 'asc' },
  });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.startTime.getTime(), f.availability.startTime.getTime() + 1 * 60 * 60 * 1000);
  assert.equal(remaining[0]?.endTime.getTime(), f.availability.endTime.getTime());
});

test('rejects a student who has not verified their email', async () => {
  const f = await createFixture();
  const unverified = await createUser('STUDENT', { verified: false });

  await assert.rejects(
    createBooking(bookingInput(f, { studentId: unverified.id })),
    (error: unknown) =>
      error instanceof BookingError &&
      error.statusCode === 400 &&
      error.message === 'Verify your email before booking a lesson.',
  );
});

test('rejects a fractional lesson duration', async () => {
  const f = await createFixture();
  await assert.rejects(
    createBooking(bookingInput(f, { durationHours: 1.5 })),
    (error: unknown) => error instanceof BookingError && error.statusCode === 400,
  );
});

test('rejects a time outside the tutor availability', async () => {
  const f = await createFixture();
  const outside = new Date(f.availability.endTime.getTime());
  await assert.rejects(
    createBooking(bookingInput(f, { startTime: outside })),
    (error: unknown) => error instanceof BookingError && error.statusCode === 409,
  );
});

test('only one concurrent booking can consume the same availability', async () => {
  const f = await createFixture();
  const secondStudent = await createUser('STUDENT');

  const results = await Promise.allSettled([
    createBooking(bookingInput(f)),
    createBooking(bookingInput(f, { studentId: secondStudent.id })),
  ]);

  const successful = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');
  assert.equal(successful.length, 1);
  assert.equal(failed.length, 1);

  for (const result of successful) {
    if (result.status === 'fulfilled') bookingIds.push(result.value.id);
  }
  const count = await prisma.booking.count({
    where: { tutorId: f.tutor.id, status: 'CONFIRMED' },
  });
  assert.equal(count, 1);
});
