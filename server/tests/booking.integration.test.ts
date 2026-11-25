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
const { createBooking, cancelBooking, BookingError } =
  await import('../src/services/booking.service.js');
const { createAvailability, updateAvailability, AvailabilityError } =
  await import('../src/services/availability.service.js');

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
  attachmentIds?: number[];
  attachments?: { name: string; size: number; type: string }[];
} = {}) {
  return {
    studentId: overrides.studentId ?? f.student.id,
    tutorId: f.tutor.id,
    subjectId: f.subject.id,
    startTime: overrides.startTime ?? f.availability.startTime,
    durationHours: overrides.durationHours ?? 1,
    notes: 'Integration test lesson',
    ...(overrides.attachmentIds !== undefined ? { attachmentIds: overrides.attachmentIds } : {}),
    ...(overrides.attachments !== undefined ? { attachments: overrides.attachments } : {}),
  };
}

afterEach(async () => {
  if (userIds.length) {
    await prisma.bookingAttachment.deleteMany({ where: { uploadedById: { in: userIds } } });
  }
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

test('rolls back attachment linkage when a booking fails due to conflict (BR-08)', async () => {
  const f = await createFixture();
  const secondStudent = await createUser('STUDENT');

  // First student books the slot cleanly.
  const first = await createBooking(bookingInput(f));
  bookingIds.push(first.id);

  // Second student uploaded an attachment, then tries to book the already-taken slot.
  const upload = await prisma.bookingAttachment.create({
    data: {
      uploadedById: secondStudent.id,
      fileName: 'homework.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      storageKey: randomUUID(),
    },
  });

  await assert.rejects(
    createBooking(bookingInput(f, { studentId: secondStudent.id, attachmentIds: [upload.id] })),
    (error: unknown) => error instanceof BookingError && error.statusCode === 409,
  );

  const persistedUpload = await prisma.bookingAttachment.findUnique({ where: { id: upload.id } });
  assert.equal(persistedUpload?.bookingId, null);
});

test('student cancellation >= 72h grants 100% refund and merges restored middle slot back into one continuous availability block (STS-10.2, STS-12.2)', async () => {
  const f = await createFixture();
  const otherTutor = await createUser('TUTOR');

  // Replace fixture availability with a 3-hour window 4 days (>= 72h) from now.
  await prisma.availability.deleteMany({ where: { tutorId: f.tutor.id } });
  const windowStart = new Date(Date.now() + 96 * 60 * 60 * 1000);
  windowStart.setUTCMinutes(0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + 3 * 60 * 60 * 1000);
  const createdAv = await prisma.availability.create({
    data: { tutorId: f.tutor.id, startTime: windowStart, endTime: windowEnd },
  });
  availabilityIds.push(createdAv.id);

  // Another tutor has a window at the middle hour [10:00-11:00]; must stay isolated.
  const middleStart = new Date(windowStart.getTime() + 1 * 60 * 60 * 1000);
  const middleEnd = new Date(windowStart.getTime() + 2 * 60 * 60 * 1000);
  const otherAv = await prisma.availability.create({
    data: { tutorId: otherTutor.id, startTime: middleStart, endTime: middleEnd },
  });
  availabilityIds.push(otherAv.id);

  // Student books the middle hour, slicing availability into 2 rows.
  const booking = await createBooking(bookingInput(f, { startTime: middleStart, durationHours: 1 }));
  bookingIds.push(booking.id);

  const beforeCancel = await prisma.availability.findMany({
    where: { tutorId: f.tutor.id },
    orderBy: { startTime: 'asc' },
  });
  assert.equal(beforeCancel.length, 2);

  // Student cancels >= 72h before lesson start.
  const cancelRes = await cancelBooking({
    bookingId: booking.id,
    actorId: f.student.id,
    actorRole: 'STUDENT',
  });
  assert.equal(cancelRes.refundPercentage, 100);
  assert.equal(cancelRes.refundAmount, 400);

  const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
  assert.equal(updatedBooking?.status, 'CANCELLED');
  assert.equal(updatedBooking?.paymentStatus, 'REFUNDED_FULL');
  assert.equal(updatedBooking?.cancelledBy, 'STUDENT');
  assert.ok(updatedBooking?.cancelledAt instanceof Date);
  assert.equal(updatedBooking?.refundPercentage, 100);
  assert.equal(Number(updatedBooking?.refundAmount), 400);

  // Restored middle slot merges with both neighbors into a single 3h row.
  const afterCancel = await prisma.availability.findMany({
    where: { tutorId: f.tutor.id },
    orderBy: { startTime: 'asc' },
  });
  assert.equal(afterCancel.length, 1);
  assert.equal(afterCancel[0]?.startTime.getTime(), windowStart.getTime());
  assert.equal(afterCancel[0]?.endTime.getTime(), windowEnd.getTime());

  // Other tutor's availability is untouched.
  const otherAfter = await prisma.availability.findMany({ where: { tutorId: otherTutor.id } });
  assert.equal(otherAfter.length, 1);
});

test('student cancellation applies 50% refund in [24h, 72h) and 0% refund in (0, 24h) (STS-10.3)', async () => {
  const f = await createFixture();
  await prisma.availability.deleteMany({ where: { tutorId: f.tutor.id } });

  const now = new Date();
  const start36h = new Date(now.getTime() + 38 * 60 * 60 * 1000);
  start36h.setUTCMinutes(0, 0, 0);
  const start12h = new Date(now.getTime() + 14 * 60 * 60 * 1000);
  start12h.setUTCMinutes(0, 0, 0);

  await prisma.availability.createMany({
    data: [
      { tutorId: f.tutor.id, startTime: start36h, endTime: new Date(start36h.getTime() + 2 * 60 * 60 * 1000) },
      { tutorId: f.tutor.id, startTime: start12h, endTime: new Date(start12h.getTime() + 2 * 60 * 60 * 1000) },
    ],
  });

  const b50 = await createBooking(bookingInput(f, { startTime: start36h, durationHours: 2 }));
  const b0 = await createBooking(bookingInput(f, { startTime: start12h, durationHours: 1 }));
  bookingIds.push(b50.id, b0.id);

  const res50 = await cancelBooking({
    bookingId: b50.id,
    actorId: f.student.id,
    actorRole: 'STUDENT',
    now,
  });
  assert.equal(res50.refundPercentage, 50);
  assert.equal(res50.refundAmount, 400);

  const res0 = await cancelBooking({
    bookingId: b0.id,
    actorId: f.student.id,
    actorRole: 'STUDENT',
    now,
  });
  assert.equal(res0.refundPercentage, 0);
  assert.equal(res0.refundAmount, 0);

  const row50 = await prisma.booking.findUnique({ where: { id: b50.id } });
  const row0 = await prisma.booking.findUnique({ where: { id: b0.id } });
  assert.equal(row50?.paymentStatus, 'REFUNDED_PARTIAL');
  assert.equal(row0?.paymentStatus, 'SUCCESS');
});

test('tutor cancellation grants 100% refund even < 24h before start and keeps slot blocked (STS-11.1, STS-11.2)', async () => {
  const f = await createFixture();
  const otherTutor = await createUser('TUTOR');

  // Fixture window is 3h in the future (< 24h) and 4h long. Book the first hour.
  const booking = await createBooking(bookingInput(f, { durationHours: 1 }));
  bookingIds.push(booking.id);

  // Another tutor cannot cancel Tutor A's booking (403).
  await assert.rejects(
    cancelBooking({ bookingId: booking.id, actorId: otherTutor.id, actorRole: 'TUTOR' }),
    (err: unknown) => err instanceof BookingError && err.statusCode === 403,
  );

  // Assigned tutor cancels (< 24h remaining -> still 100% refund).
  const res = await cancelBooking({
    bookingId: booking.id,
    actorId: f.tutor.id,
    actorRole: 'TUTOR',
  });
  assert.equal(res.refundPercentage, 100);
  assert.equal(res.refundAmount, 400);

  const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
  assert.equal(updated?.status, 'CANCELLED');
  assert.equal(updated?.cancelledBy, 'TUTOR');
  assert.equal(updated?.paymentStatus, 'REFUNDED_FULL');

  // Cancelled hour is NOT restored to availability; attempts to book that start time fail with 409.
  await assert.rejects(
    createBooking(bookingInput(f, { durationHours: 1 })),
    (err: unknown) => err instanceof BookingError && err.statusCode === 409,
  );
});

test('creating adjacent availability merges automatically and updateAvailability validates ownership and BR-04 (STS-12.3, STS-12.4)', async () => {
  const f = await createFixture();
  const otherTutor = await createUser('TUTOR');
  await prisma.availability.deleteMany({ where: { tutorId: f.tutor.id } });

  const base = new Date(Date.now() + 48 * 60 * 60 * 1000);
  base.setUTCMinutes(0, 0, 0);
  const h1 = new Date(base.getTime() + 1 * 60 * 60 * 1000);
  const h3 = new Date(base.getTime() + 3 * 60 * 60 * 1000);

  const first = await createAvailability(f.tutor.id, { startTime: base, endTime: h1 });
  availabilityIds.push(first.id);

  // Creating adjacent [h1, h3] merges into [base, h3].
  const merged = await createAvailability(f.tutor.id, { startTime: h1, endTime: h3 });
  availabilityIds.push(merged.id);

  const rows = await prisma.availability.findMany({ where: { tutorId: f.tutor.id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.startTime.getTime(), base.getTime());
  assert.equal(rows[0]?.endTime.getTime(), h3.getTime());

  // Non-owning tutor gets 403 on updateAvailability.
  const shiftedStart = new Date(base.getTime() + 30 * 60 * 1000);
  const shiftedEnd = new Date(shiftedStart.getTime() + 2 * 60 * 60 * 1000);
  await assert.rejects(
    updateAvailability(otherTutor.id, rows[0]!.id, { startTime: shiftedStart, endTime: shiftedEnd }),
    (err: unknown) => err instanceof AvailabilityError && err.statusCode === 403,
  );

  // Owner updates window cleanly.
  const updated = await updateAvailability(f.tutor.id, rows[0]!.id, {
    startTime: shiftedStart,
    endTime: shiftedEnd,
  });
  availabilityIds.push(updated.id);
  assert.equal(updated.startTime.getTime(), shiftedStart.getTime());
  assert.equal(updated.endTime.getTime(), shiftedEnd.getTime());
});
