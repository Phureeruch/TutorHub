import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, before, test } from 'node:test';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';

config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error('DATABASE_URL is not configured');

const databaseUrl = new URL(configuredUrl);
if (!['/tutorhub', '/tutorhub_test'].includes(databaseUrl.pathname)) {
  throw new Error('Unexpected database name. Test execution stopped.');
}
databaseUrl.pathname = '/tutorhub_test';
process.env.DATABASE_URL = databaseUrl.toString();

let uploadDir = '';

const { prisma } = await import('../src/lib/prisma.js');
const { app } = await import('../src/server.js');

let server: ReturnType<typeof app.listen>;
let baseUrl = '';

const userIds: number[] = [];
const subjectIds: number[] = [];
const tutorProfileIds: number[] = [];
const availabilityIds: number[] = [];
const bookingIds: number[] = [];
const attachmentIds: number[] = [];

before(async () => {
  uploadDir = await mkdtemp(path.join(os.tmpdir(), 'tutorhub-test-uploads-'));
  process.env.UPLOAD_DIR = uploadDir;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterEach(async () => {
  if (bookingIds.length) {
    await prisma.bookingAttachment.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }
  if (attachmentIds.length) {
    await prisma.bookingAttachment.deleteMany({
      where: { id: { in: attachmentIds } },
    });
  }
  if (userIds.length) {
    await prisma.bookingAttachment.deleteMany({
      where: { uploadedById: { in: userIds } },
    });
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { studentId: { in: userIds } },
          { tutorId: { in: userIds } },
        ],
      },
    });
    await prisma.availability.deleteMany({
      where: { tutorId: { in: userIds } },
    });
  }
  if (availabilityIds.length) {
    await prisma.availability.deleteMany({
      where: { id: { in: availabilityIds } },
    });
  }
  if (tutorProfileIds.length) {
    await prisma.tutorSubject.deleteMany({
      where: { tutorProfileId: { in: tutorProfileIds } },
    });
    await prisma.tutorProfile.deleteMany({
      where: { id: { in: tutorProfileIds } },
    });
  }
  if (subjectIds.length) {
    await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
  }
  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  bookingIds.length = 0;
  attachmentIds.length = 0;
  availabilityIds.length = 0;
  tutorProfileIds.length = 0;
  subjectIds.length = 0;
  userIds.length = 0;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  if (uploadDir) {
    await rm(uploadDir, { recursive: true, force: true });
  }
  await prisma.$disconnect();
});

async function seedUser(
  role: 'STUDENT' | 'TUTOR' | 'ADMIN',
  options?: { verified?: boolean; approved?: boolean; password?: string },
) {
  const password = options?.password ?? 'password123';
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${randomUUID()}@test.com`,
      password: passwordHash,
      name: `Test ${role}`,
      role,
      isEmailVerified: options?.verified ?? true,
      isApproved: options?.approved ?? role !== 'STUDENT',
    },
  });
  userIds.push(user.id);
  return { user, password };
}

async function apiJson<T>(
  route: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${baseUrl}${route}`, { ...init, headers });
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await apiJson<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200);
  return res.body.token;
}

test('rejects unauthenticated requests to /api/bookings with 401', async () => {
  const listRes = await apiJson<{ message: string }>('/api/bookings');
  assert.equal(listRes.status, 401);

  const getRes = await apiJson<{ message: string }>('/api/bookings/1');
  assert.equal(getRes.status, 401);

  const createRes = await apiJson<{ message: string }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({ tutorId: 1, subjectId: 1, startTime: new Date().toISOString(), durationHours: 1 }),
  });
  assert.equal(createRes.status, 401);
});

test('auth register returns token + user and allows immediate email verification', async () => {
  const email = `student-${randomUUID()}@test.com`;
  const regRes = await apiJson<{
    message: string;
    userId: number;
    token: string;
    user: { id: number; email: string; role: string; isEmailVerified: boolean };
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Nong Film', email, password: 'password123' }),
  });

  assert.equal(regRes.status, 201);
  userIds.push(regRes.body.userId);
  assert.equal(regRes.body.user.role, 'STUDENT');
  assert.equal(regRes.body.user.isEmailVerified, false);
  assert.ok(regRes.body.token);

  const verifyRes = await apiJson<{
    isEmailVerified: boolean;
    user: { isEmailVerified: boolean };
  }>('/api/auth/verify-email', {
    method: 'POST',
    token: regRes.body.token,
    body: JSON.stringify({}),
  });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.isEmailVerified, true);
  assert.equal(verifyRes.body.user.isEmailVerified, true);

  const meRes = await apiJson<{ user: { id: number; isEmailVerified: boolean } }>('/api/auth/me', {
    token: regRes.body.token,
  });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.id, regRes.body.userId);
  assert.equal(meRes.body.user.isEmailVerified, true);
});

test('rejects student registration when full name is blank (FR-02, #46)', async () => {
  const email = `blank-name-${randomUUID()}@test.com`;
  const regRes = await apiJson<{
    message?: string;
    userId?: number;
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: '   ', email, password: 'password123' }),
  });

  if (regRes.body.userId) {
    userIds.push(regRes.body.userId);
  }

  assert.equal(regRes.status, 400);
  assert.equal(regRes.body.message, 'Enter your name.');
});

test('end-to-end HTTP booking with multipart attachment upload, retrieval, and role isolation', async () => {
  const { user: student, password: studentPwd } = await seedUser('STUDENT', { verified: true });
  const { user: otherStudent, password: otherPwd } = await seedUser('STUDENT', { verified: true });
  const { user: tutor, password: tutorPwd } = await seedUser('TUTOR', { approved: true });
  const { user: admin, password: adminPwd } = await seedUser('ADMIN', { approved: true });

  const profile = await prisma.tutorProfile.create({
    data: { userId: tutor.id, bio: 'API integration tutor' },
  });
  tutorProfileIds.push(profile.id);

  const subject = await prisma.subject.create({
    data: { name: `API Subject ${randomUUID()}` },
  });
  subjectIds.push(subject.id);

  const tutorToken = await loginAs(tutor.email, tutorPwd);
  const studentToken = await loginAs(student.email, studentPwd);
  const otherToken = await loginAs(otherStudent.email, otherPwd);
  const adminToken = await loginAs(admin.email, adminPwd);

  // Tutor updates profile via PUT /api/tutor/profile
  const profilePut = await apiJson<{
    user: { id: number; name: string };
    profile: { id: number; userId: number; bio: string | null };
    subjects: { id: number; name: string; hourlyPrice: number; levels: string[]; topics: string | null }[];
  }>('/api/tutor/profile', {
    method: 'PUT',
    token: tutorToken,
    body: JSON.stringify({
      bio: 'Updated bio',
      subjects: [
        {
          subjectId: subject.id,
          hourlyPrice: 450,
          levels: ['UNDERGRADUATE'],
          topics: 'API testing',
        },
      ],
    }),
  });
  assert.equal(profilePut.status, 200);
  assert.equal(profilePut.body.profile.bio, 'Updated bio');
  assert.equal(profilePut.body.subjects[0]?.hourlyPrice, 450);

  // Tutor adds availability via POST /api/tutor/availability
  const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
  start.setUTCMinutes(30, 0, 0);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

  const availCreate = await apiJson<{ id: number }>('/api/tutor/availability', {
    method: 'POST',
    token: tutorToken,
    body: JSON.stringify({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    }),
  });
  assert.equal(availCreate.status, 201);
  availabilityIds.push(availCreate.body.id);

  // Student uploads a lecture file via POST /api/attachments (multipart/form-data)
  const form = new FormData();
  form.append('file', new Blob(['%PDF-1.4\nhello'], { type: 'application/pdf' }), 'lecture.pdf');
  const uploadRes = await fetch(`${baseUrl}/api/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: form,
  });
  assert.equal(uploadRes.status, 201);
  const uploaded = (await uploadRes.json()) as { id: number; name: string; size: number; type: string };
  attachmentIds.push(uploaded.id);
  assert.equal(uploaded.name, 'lecture.pdf');
  assert.equal(uploaded.type, 'application/pdf');

  // Student creates a partial booking referencing the uploaded attachment
  const bookingStart = new Date(start.getTime() + 60 * 60 * 1000);
  const bookingRes = await apiJson<{
    id: number;
    hourlyPriceSnapshot: number;
    totalPrice: number;
    currentHourlyPrice: number;
    student: { id: number; name: string };
    tutor: { id: number; name: string };
    subject: { id: number; name: string };
    attachments: { id: number; name: string; size: number; type: string }[];
  }>('/api/bookings', {
    method: 'POST',
    token: studentToken,
    body: JSON.stringify({
      tutorId: tutor.id,
      subjectId: subject.id,
      startTime: bookingStart.toISOString(),
      durationHours: 1,
      notes: 'Focus on REST',
      attachmentIds: [uploaded.id],
    }),
  });

  assert.equal(bookingRes.status, 201);
  bookingIds.push(bookingRes.body.id);
  assert.equal(bookingRes.body.hourlyPriceSnapshot, 450);
  assert.equal(bookingRes.body.totalPrice, 450);
  assert.equal(bookingRes.body.currentHourlyPrice, 450);
  assert.equal(bookingRes.body.attachments.length, 1);
  assert.equal(bookingRes.body.attachments[0]?.id, uploaded.id);

  // Tutor can download the attached file via GET /api/attachments/:id
  const tutorDownload = await fetch(`${baseUrl}/api/attachments/${uploaded.id}`, {
    headers: { Authorization: `Bearer ${tutorToken}` },
  });
  assert.equal(tutorDownload.status, 200);
  assert.equal(await tutorDownload.text(), '%PDF-1.4\nhello');

  // Unrelated student gets 403 on both booking and attachment
  const strangerBooking = await apiJson<{ message: string }>(`/api/bookings/${bookingRes.body.id}`, {
    token: otherToken,
  });
  assert.equal(strangerBooking.status, 403);

  const strangerAttachment = await fetch(`${baseUrl}/api/attachments/${uploaded.id}`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  assert.equal(strangerAttachment.status, 403);

  // Tutor schedule endpoint returns DTO bookings with embedded names
  const scheduleRes = await apiJson<{
    availabilities: { id: number }[];
    bookings: { id: number; student: { name: string }; attachments: { id: number }[] }[];
  }>('/api/tutor/availability', { token: tutorToken });
  assert.equal(scheduleRes.status, 200);
  assert.equal(scheduleRes.body.availabilities.length, 2);
  assert.equal(scheduleRes.body.bookings.length, 1);
  assert.equal(scheduleRes.body.bookings[0]?.student.name, student.name);
  assert.equal(scheduleRes.body.bookings[0]?.attachments[0]?.id, uploaded.id);

  // Admin summary includes verifiedStudents & totalStudents
  const summaryRes = await apiJson<{
    totalBookings: number;
    mockRevenue: number;
    activeTutors: number;
    verifiedStudents: number;
    totalStudents: number;
  }>('/api/admin/summary', { token: adminToken });
  assert.equal(summaryRes.status, 200);
  assert.ok(summaryRes.body.totalBookings >= 1);
  assert.ok(summaryRes.body.verifiedStudents >= 2);
  assert.ok(summaryRes.body.totalStudents >= summaryRes.body.verifiedStudents);

  // Confirmed booking schedule cannot be modified via PUT /api/bookings/:id (BR-10, STS-10.6)
  const mutateBooking = await apiJson(`/api/bookings/${bookingRes.body.id}`, {
    method: 'PUT',
    token: studentToken,
    body: JSON.stringify({ durationHours: 2 }),
  });
  assert.equal(mutateBooking.status, 404);

  // Stranger student cannot cancel someone else's booking (403, STS-10.5)
  const strangerCancel = await apiJson<{ message: string }>(
    `/api/bookings/${bookingRes.body.id}/cancel`,
    {
      method: 'PATCH',
      token: otherToken,
      body: JSON.stringify({}),
    },
  );
  assert.equal(strangerCancel.status, 403);

  // Student cancels own booking (< 24h away -> 0% refund) and merges availability (STS-10.2, STS-10.3, STS-12.2)
  const cancelRes = await apiJson<{
    message: string;
    refundPercentage: number;
    refundAmount: number;
    booking: {
      id: number;
      status: string;
      paymentStatus: string;
      cancelledBy: string;
      refundPercentage: number;
      refundAmount: number;
    };
  }>(`/api/bookings/${bookingRes.body.id}/cancel`, {
    method: 'PATCH',
    token: studentToken,
    body: JSON.stringify({ reason: 'Schedule conflict' }),
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.refundPercentage, 0);
  assert.equal(cancelRes.body.refundAmount, 0);
  assert.equal(cancelRes.body.booking.status, 'CANCELLED');
  assert.equal(cancelRes.body.booking.paymentStatus, 'SUCCESS');
  assert.equal(cancelRes.body.booking.cancelledBy, 'STUDENT');

  // Re-cancelling an already-cancelled booking returns 409 (STS-10.4)
  const cancelAgain = await apiJson<{ message: string }>(
    `/api/bookings/${bookingRes.body.id}/cancel`,
    {
      method: 'PATCH',
      token: studentToken,
      body: JSON.stringify({}),
    },
  );
  assert.equal(cancelAgain.status, 409);

  // Tutor schedule now shows the two slices merged back into 1 continuous availability window (STS-12.2)
  const mergedSchedule = await apiJson<{
    availabilities: { id: number; startTime: string; endTime: string }[];
  }>('/api/tutor/availability', { token: tutorToken });
  assert.equal(mergedSchedule.status, 200);
  assert.equal(mergedSchedule.body.availabilities.length, 1);
  availabilityIds.push(mergedSchedule.body.availabilities[0]!.id);

  // Tutor updates the merged availability window via PUT /api/tutor/availability/:id (STS-12.3)
  const avId = mergedSchedule.body.availabilities[0]!.id;
  const shiftedStart = new Date(start.getTime() + 60 * 60 * 1000);
  const shiftedEnd = new Date(shiftedStart.getTime() + 2 * 60 * 60 * 1000);
  const updateAvRes = await apiJson<{ id: number; startTime: string; endTime: string }>(
    `/api/tutor/availability/${avId}`,
    {
      method: 'PUT',
      token: tutorToken,
      body: JSON.stringify({
        startTime: shiftedStart.toISOString(),
        endTime: shiftedEnd.toISOString(),
      }),
    },
  );
  assert.equal(updateAvRes.status, 200);
  availabilityIds.push(updateAvRes.body.id);
  assert.equal(new Date(updateAvRes.body.startTime).getTime(), shiftedStart.getTime());
  assert.equal(new Date(updateAvRes.body.endTime).getTime(), shiftedEnd.getTime());

  // F-09: Discovery time window validation (STS-09.4)
  const badFilterRes1 = await apiJson<{ message: string }>(
    '/api/availability?startHour=15:00&endHour=14:00',
  );
  assert.equal(badFilterRes1.status, 400);
  assert.equal(badFilterRes1.body.message, 'End time must be at least 1 hour after start time.');

  const badFilterRes2 = await apiJson<{ message: string }>(
    '/api/availability?startHour=09:15',
  );
  assert.equal(badFilterRes2.status, 400);
  assert.equal(badFilterRes2.body.message, 'Invalid discovery filters.');

  // F-13: Student and Tutor cannot access Admin endpoints (403 Forbidden, STS-13.4)
  const studentPending = await apiJson('/api/admin/tutors/pending', { token: studentToken });
  assert.equal(studentPending.status, 403);

  const tutorSubjectPost = await apiJson('/api/admin/subjects', {
    method: 'POST',
    token: tutorToken,
    body: JSON.stringify({ name: 'Hacking 101' }),
  });
  assert.equal(tutorSubjectPost.status, 403);

  // F-13: Admin can list pending tutors (STS-13.1)
  const adminPending = await apiJson<{ id: number; name: string }[]>('/api/admin/tutors/pending', {
    token: adminToken,
  });
  assert.equal(adminPending.status, 200);
  assert.ok(Array.isArray(adminPending.body));

  // F-13: Admin approving unknown tutor returns 404 (STS-13.2)
  const unknownApprove = await apiJson<{ message: string }>('/api/admin/tutors/999999/approve', {
    method: 'PATCH',
    token: adminToken,
  });
  assert.equal(unknownApprove.status, 404);
  assert.equal(unknownApprove.body.message, 'Tutor account not found.');

  // F-13: Admin duplicate subject returns 409 (STS-13.3)
  const dupSubject = await apiJson<{ message: string }>('/api/admin/subjects', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({ name: 'python basics' }),
  });
  assert.equal(dupSubject.status, 409);
  assert.equal(dupSubject.body.message, 'A subject with this name already exists.');
});
