# Backend API Guide — TutorHub (Sprint 1 → real API)

**For:** the backend team (Express + Prisma in `server/`)
**Status:** the Sprint 1 client in `client/` is feature-complete against an in-browser mock of the API. This guide is the hand-off: what to build so the client can switch from the mock to `server/` without UI changes.
**Read with:** [SRS Draft 2](srs.md) (rules), [SDS v2.0](system-sds.md) (schema §2, API §4). Where this guide and the SDS differ, the difference is listed in [§2](#2-changes-from-sds-v20-team-review) and needs an SDS update.

---

## 0. TL;DR

1. **The mock is the executable contract.** `client/src/api/mockApi.ts` implements every endpoint the UI calls, as pure functions that throw `ApiError(status, message)`. `client/src/api/mockApi.test.ts` pins the behaviour (status codes, messages, BR rules). Port those tests first, then make them pass against Express.
2. **`server/prisma/schema.prisma` is out of date.** It still has the pre-Draft-2 `TutorSlot` model. Replace it with SDS §2 plus the review changes in §2 below, and create a fresh migration.
3. **Six endpoints the UI needs are missing from SDS §4** (subjects list, tutor directory, own profile, own schedule, admin summary, embedded names on bookings). See [§5](#5-endpoints-the-client-needs-that-sds-4-does-not-list).
4. **Two review features need a team decision before backend work:** lecture-file attachments (SRS §4.2 says out of scope) and teaching levels/topics (not in SRS). See [§9](#9-open-decisions).

---

## 1. Where things stand

| Area | State |
|---|---|
| `client/` | All Sprint 1 screens built and tested (200+ Vitest tests). Talks to `MockAppContext`, which calls `mockApi.ts` and stores a fake DB in `localStorage`. |
| `server/src/server.ts` | Express 5 app, CORS, JSON body parser, `GET /health` with a DB ping. |
| `server/src/routes/booking.routes.ts` | Placeholders only; comments cite old rule numbers (BR-01 "double booking" is now BR-07/BR-08 in Draft 2). |
| `server/prisma/schema.prisma` | **Old model** (`TutorSlot`, `SlotStatus`, `Booking.slotId`). Does not match SDS v2.0. Its one migration can be dropped while there is no shared data. |
| Auth, validation, tests | Not started on the server. `npm test` is a placeholder. |

Stack already installed in `server/`: Express 5, Prisma 7 with `@prisma/adapter-pg`, `pg`, `tsx`, TypeScript (strict, `nodenext`). Still to add: `bcrypt`, `jsonwebtoken`, `zod` (request validation), `vitest` + `supertest` (tests).

---

## 2. Changes from SDS v2.0 (team review)

The team reviewed the clickable prototype and asked for changes the SDS does not have yet. The client already implements them.

| # | Change | Schema impact | API impact |
|---|---|---|---|
| R1 | **Currency is Thai baht (THB).** | None (amounts stay numbers). | Amounts are baht. The client formats `฿400`. |
| R2 | **Hourly rate per subject**, not per tutor. | Move `hourlyPrice` from `TutorProfile` to `TutorSubject`. | `PUT /api/tutor/profile` body changes (§4.2). Booking snapshots the chosen subject's rate. |
| R3 | **Teaching levels and topics per subject** (who the tutor teaches it to, what they cover). | `TutorSubject.levels TeachingLevel[]`, `TutorSubject.topics String?` (≤ 200 chars). New enum `TeachingLevel { HIGH_SCHOOL UNDERGRADUATE GRADUATE }`. | Part of the profile body; returned in the directory; `?level=` filter on discovery. |
| R4 | **Optional lecture files on a booking** (≤ 5 files, ≤ 20 MB each; PDF, PowerPoint, Word, text, images). | New `BookingAttachment` table plus file storage. | Upload flow, see §6. **Conflicts with SRS §4.2 "File attachments: out of scope". Decide first.** |
| R5 | Slot picker: student taps whole hours, which must be back to back. | None. | None. `POST /api/bookings` already takes `startTime` + `durationHours`, which can only describe a contiguous block. |

### Prisma deltas against SDS §2

```prisma
enum TeachingLevel {
  HIGH_SCHOOL
  UNDERGRADUATE
  GRADUATE
}

model TutorProfile {
  id        Int            @id @default(autoincrement())
  userId    Int            @unique
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio       String?
  // hourlyPrice removed: rates are per subject (R2)
  subjects  TutorSubject[]
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
}

model TutorSubject {
  id             Int             @id @default(autoincrement())
  tutorProfileId Int
  tutorProfile   TutorProfile    @relation(fields: [tutorProfileId], references: [id], onDelete: Cascade)
  subjectId      Int
  subject        Subject         @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  hourlyPrice    Decimal         @db.Decimal(10, 2) // R2, BR-09 source; > 0
  levels         TeachingLevel[] @default([])       // R3
  topics         String?         @db.VarChar(200)   // R3

  @@unique([tutorProfileId, subjectId])
}

// Only if the team accepts R4 (see §9). Uploaded first, linked to a booking on confirm (§6).
model BookingAttachment {
  id           Int      @id @default(autoincrement())
  bookingId    Int?     // null until the booking is confirmed
  booking      Booking? @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  uploadedById Int
  uploadedBy   User     @relation("UploadedAttachments", fields: [uploadedById], references: [id])
  fileName     String
  mimeType     String
  sizeBytes    Int
  storageKey   String   @unique // object-store key or disk path, never sent to clients as-is
  createdAt    DateTime @default(now())

  @@index([bookingId])
  @@index([uploadedById, bookingId])
}
// Booking gets `attachments BookingAttachment[]`; User gets `uploads BookingAttachment[] @relation("UploadedAttachments")`.
```

**Money type.** The SDS uses `Float` for prices. Use `Decimal(10, 2)` for `hourlyPrice`, `hourlyPriceSnapshot`, `totalPrice` and `refundAmount` (the current `server/` schema already does), so BR-11's 50 % refunds never pick up float error. Serialise them as JSON **numbers** (`Number(decimal)`), because the client's `types.ts` expects `number`.

---

## 3. Conventions (every endpoint)

| Topic | Rule |
|---|---|
| Base path | `/api`. JSON in and out (`Content-Type: application/json`), except the file upload in §6. |
| Auth | `Authorization: Bearer <JWT>`. Payload: `{ sub: userId, role }`. Re-load the user on each request so a revoked/changed role takes effect. Expire after e.g. 8 h. |
| Passwords | bcrypt, cost ≥ 10 (NFR-01). Never return `password`. |
| Timestamps | ISO-8601 strings in UTC (`2026-11-14T02:30:00.000Z`). Prisma `DateTime` already serialises this way. |
| Time zone | The school runs on **Asia/Bangkok (UTC+7, no DST)**. Use it for `?date=YYYY-MM-DD` (the local calendar day) and for anything said "per day". Because the offset is a whole number of hours, the BR-04 `:00`/`:30` minute check gives the same answer in UTC. |
| IDs | Integers (`autoincrement`), as in the SDS. |
| Errors | Status code + body `{ "message": "<sentence for the user>" }`. **The client shows `message` verbatim**, so write it for students and tutors, not developers. Optional `field` (e.g. `"subjects[1].hourlyPrice"`) lets the form focus the bad input. |
| Status codes | `400` validation / rule broken · `401` not signed in or bad credentials · `403` wrong role or not the owner · `404` not found · `409` conflict (time taken, duplicate email) · `500` unexpected (generic message, log details). |
| RBAC | Enforce role and ownership on the server for every route (BR-03, NFR-02). The client hides buttons, but that is not security. |

Middleware order: `authenticate` (JWT → `req.user`) → `requireRole(...roles)` → `validate(zodSchema)` → handler. One error-handling middleware maps a thrown `ApiError(status, message)` to the response, the same shape the mock uses.

---

## 4. Endpoint reference (SDS §4, as the client uses it)

Each entry names the mock function that defines the behaviour and the test block that pins it. Port those tests to `supertest` as the acceptance check.

### 4.1 Auth (SDS §4.1)

| Endpoint | Request | Success | Errors | Mock / tests |
|---|---|---|---|---|
| `POST /api/auth/register` | `{ email, password, name }` | `201 { message, userId }`. Creates `STUDENT`, `isEmailVerified=false` (BR-01, BR-02). | `400` blank name / bad email / password < 8 chars · `409` email exists | `registerStudent` · `registerStudent (FR-02, BR-01, BR-02)` |
| `POST /api/auth/login` | `{ email, password }` | `200 { token, user }`; `user` has no password. Email is matched trimmed and lower-cased. | `401 "Email or password is incorrect."` (same message for both cases) | `login` · `login (FR-01)` |
| `POST /api/auth/verify-email` | `{}` (auth) | `200 { message, isEmailVerified: true }` | `401` | `verifyEmail` · `verifyEmail (FR-04)` |
| `POST /api/auth/reset-password` | `{ email, newPassword }` | `200 { message }`, **also for unknown emails**, so the endpoint can't be used to find accounts. | `400` password < 8 | `resetPassword` · `resetPassword (FR-04)` |

Add `GET /api/auth/me` → `200 { user }` so the client can restore a session from a stored token (the mock keeps `currentUserId` in storage).

### 4.2 Tutor profile and availability (SDS §4.2)

**`PUT /api/tutor/profile`** · role `TUTOR` · changed by R2/R3

```json
{
  "bio": "Fourth-year CompEng…",
  "subjects": [
    { "subjectId": 1, "hourlyPrice": 400, "levels": ["HIGH_SCHOOL", "UNDERGRADUATE"], "topics": "Loops, recursion" },
    { "subjectId": 2, "hourlyPrice": 450, "levels": [], "topics": "" }
  ]
}
```

- **Replaces** the tutor's whole subject list (PUT semantics). Do it in one transaction: delete the tutor's `TutorSubject` rows, then insert the new ones.
- `bio` omitted → unchanged; `""` → `null`.
- A repeated `subjectId` keeps its last entry; unknown subject ids are ignored. If nothing is left → `400 "Choose at least one subject you teach."`.
- `hourlyPrice` must be finite and > 0 → else `400 "<Subject>: hourly rate must be more than 0."`
- `levels` must all be valid enum values → else `400 "<Subject>: unknown level."`. Store deduplicated, in enum order.
- `topics` is trimmed, `""` → `null`, > 200 chars → `400 "<Subject>: keep topics to 200 characters."`
- **Never touch existing bookings** (BR-09: their price is frozen).
- Response `200`: the profile in the same shape as a directory entry (§5.2), so the form can refresh.
- Mock / tests: `updateTutorProfile` · `updateTutorProfile (FR-05, per-subject rates)`.

**`POST /api/tutor/availability`** · role `TUTOR` · `{ startTime, endTime }`

- BR-04: start on `:00` or `:30` with zero seconds; length ≥ 1 h and a whole number of hours; start in the future. Messages are in `validateAvailabilityInput` (`client/src/utils/bookingRules.ts`).
- `400 "This overlaps availability you already offer."` if it overlaps the tutor's own availability.
- `400 "This overlaps a lesson that is already booked."` if it overlaps the tutor's non-cancelled booking.
- `201` the `Availability`.
- Mock / tests: `createAvailability` · `createAvailability (FR-06, BR-04)`.

**`DELETE /api/tutor/availability/:id`** · role `TUTOR`

- `404` missing · `403 "You can only remove your own availability."` · `200 { message }`.
- Booked time is sliced **out** of availability when a booking is confirmed (BR-06), so an availability row never contains a lesson. The SDS's "cannot delete interval with confirmed bookings" case cannot happen with that model; keep a defensive check if you like.
- Mock / tests: `deleteAvailability` · `deleteAvailability (FR-06)`.

**`GET /api/availability`** (discovery): see §5.2, where it is specified as the tutor directory the UI needs.

### 4.3 Bookings and mock payment (SDS §4.3)

**`POST /api/bookings`** · role `STUDENT`

```json
{ "tutorId": 1, "subjectId": 2, "startTime": "2026-11-14T02:30:00.000Z", "durationHours": 2, "notes": "Midterm prep", "attachmentIds": [12] }
```

Validation order (same as the mock, so the same error wins when several apply):

| Step | Check | Error |
|---|---|---|
| 1 | Student's email verified (BR-02) | `400 "Verify your email before booking a lesson."` |
| 2 | `durationHours` integer ≥ 1 (BR-05) | `400 "Lesson length must be a whole number of hours."` |
| 3 | `startTime` in the future | `400 "Choose a start time in the future."` |
| 4 | Tutor exists, is `TUTOR`, `isApproved` | `404 "Tutor not found."` |
| 5 | Tutor teaches `subjectId` | `400 "<Tutor> does not teach this subject."` |
| 6 | Attachments valid (R4, if accepted) | `400` (count / size / ownership) |
| **Inside the transaction** | | |
| 7 | An availability of that tutor contains `[start, start + duration)` | `409 "This time is no longer available. Your payment was not taken."` |
| 8 | `start − availability.start` is a whole number of hours (BR-05) | `400 "Start time must be a whole number of hours after the window opens."` |
| 9 | No non-cancelled booking of **this student or this tutor** overlaps (BR-07) | `409 "You already have a lesson at this time."` |
| 10 | Mock payment (always succeeds in Sprint 1) | — |
| 11 | Snapshot `TutorSubject.hourlyPrice` → `hourlyPriceSnapshot`; `totalPrice = snapshot × durationHours` (BR-09, R2) | — |
| 12 | Insert booking (`CONFIRMED`, `paymentStatus SUCCESS`); delete the availability row; insert the 0–2 leftover pieces before/after (BR-06, `sliceAvailabilityAfterBooking`) | — |

Response `201`: the booking DTO (§4.4). Mock / tests: `createBooking` · `createBooking (FR-08..FR-10)`, including the atomic-rollback and "does not mutate on failure" cases.

**Concurrency (BR-08, NFR-04).** Two students can pass step 7 at the same time. Do both:

1. Run steps 7–12 in `prisma.$transaction(fn, { isolationLevel: 'Serializable' })`. On a serialization failure (Prisma `P2034`), retry once, then answer `409` with the message above. Nothing is written and no payment is recorded.
2. Add a database guarantee so a bug can never double-book. Prisma can't express it, so put it in the migration SQL:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD CONSTRAINT booking_tutor_no_overlap
  EXCLUDE USING gist ("tutorId" WITH =, tsrange("startTime", "endTime") WITH &&)
  WHERE (status <> 'CANCELLED');
ALTER TABLE "Booking" ADD CONSTRAINT booking_student_no_overlap
  EXCLUDE USING gist ("studentId" WITH =, tsrange("startTime", "endTime") WITH &&)
  WHERE (status <> 'CANCELLED');
```

Map the exclusion violation (Postgres `23P01`) to the same `409`. `tsrange` matches Prisma's default `DateTime` column (`timestamp(3)`, stored as UTC). If you switch the columns to `@db.Timestamptz(3)`, use `tstzrange` instead. Ranges are half-open (`[start, end)`), so back-to-back lessons don't collide.

**`GET /api/bookings`** · any signed-in role · NFR-02

- `STUDENT` → own (`studentId`), `TUTOR` → own (`tutorId`), `ADMIN` → all. Sorted by `startTime` ascending.
- Mock / tests: `listBookings` · `listBookings (FR-11, NFR-02)`.

**`GET /api/bookings/:id`**

- Owner student, owner tutor, or admin. Order matters: `404` if missing, then `403` for anyone else.
- Mock / tests: `getBookingById` · `getBookingById (FR-11, SDS §4.3, NFR-02)`.

### 4.4 Booking DTO

The client type is `Booking` in `client/src/types/types.ts`. Return it with the related names **embedded**, because the UI shows them on every row (today it looks them up in the mock DB):

```jsonc
{
  "id": 7,
  "studentId": 3, "tutorId": 1, "subjectId": 1,
  "student": { "id": 3, "name": "Charlie" },
  "tutor":   { "id": 1, "name": "Alice" },
  "subject": { "id": 1, "name": "Python Basics" },
  "startTime": "2026-11-14T02:30:00.000Z",
  "endTime":   "2026-11-14T04:30:00.000Z",
  "durationHours": 2,
  "hourlyPriceSnapshot": 400,
  "totalPrice": 800,
  "currentHourlyPrice": 650,       // tutor's rate for this subject now; null if no longer taught (BR-09 display)
  "notes": "Midterm prep",
  "attachments": [{ "id": 12, "name": "week5.pdf", "size": 245760, "type": "application/pdf" }],
  "lessonSummary": null,
  "status": "CONFIRMED",
  "paymentStatus": "SUCCESS",
  "cancelledBy": null, "cancelledAt": null,
  "refundPercentage": null, "refundAmount": null,
  "createdAt": "…", "updatedAt": "…"
}
```

`currentHourlyPrice` drives the "you paid ฿400, the rate is now ฿650" line (BR-09 demo). Load it with one join on `TutorSubject (tutorProfile.userId = tutorId, subjectId)`, not a query per row.

---

## 5. Endpoints the client needs that SDS §4 does not list

| Endpoint | Role | Why the UI needs it | Response |
|---|---|---|---|
| `GET /api/subjects` | any | Subject filter pills, profile form subject list | `200 Subject[]` sorted by name or id |
| `GET /api/tutors` | any | "Tutor" filter dropdown | `200 { id, name }[]`, approved tutors only |
| `GET /api/availability` | any | Find a tutor (§5.2) | `200 TutorListing[]` |
| `GET /api/tutor/profile` | `TUTOR` | Profile form initial values | `200 TutorListing` without `availabilities` |
| `GET /api/tutor/availability` | `TUTOR` | Own schedule with open windows + booked lessons | `200 { availabilities: Availability[], bookings: Booking[] }` (future, sorted) |
| `GET /api/admin/summary` | `ADMIN` | Stat tiles on All bookings | `200 { totalBookings, mockRevenue, activeTutors, students }` |
| `GET /api/auth/me` | any | Restore session on reload | `200 { user }` |

### 5.1 Admin summary

Formula from `client/src/components/admin/adminSummary.ts`:
- `totalBookings`: all bookings.
- `mockRevenue`: sum of `totalPrice` over non-cancelled bookings.
- `activeTutors`: approved tutors.
- `students`: student accounts.

Compute it with `count` / `aggregate` queries rather than loading rows.

### 5.2 Discovery: `GET /api/availability`

Query: `?subjectId=&tutorId=&date=YYYY-MM-DD&level=HIGH_SCHOOL|UNDERGRADUATE|GRADUATE` (all optional).

```jsonc
[
  {
    "user":    { "id": 1, "name": "Alice", "role": "TUTOR", "isApproved": true },
    "profile": { "id": 1, "userId": 1, "bio": "…" },
    "subjects": [
      { "id": 1, "name": "Python Basics", "description": "…", "hourlyPrice": 400,
        "levels": ["HIGH_SCHOOL", "UNDERGRADUATE"], "topics": "Variables, loops…" }
    ],
    "availabilities": [ { "id": 3, "tutorId": 1, "startTime": "…", "endTime": "…" } ]
  }
]
```

Rules (mock: `listTutorDirectory`, tests: `listTutorDirectory (FR-07)`):

- Approved tutors with a profile only.
- `availabilities`: the tutor's windows with **at least one bookable hour still in the future**, i.e. some `start + k h > now` with `start + (k+1) h ≤ end`. Sorted by start. With `date`, only windows starting on that Asia/Bangkok day.
- `subjectId` / `level`: keep tutors who teach some subject matching **both** (e.g. `subjectId=4&level=HIGH_SCHOOL` drops Bob, who teaches Linear Algebra only at university level).
- With `date`, drop tutors with no window that day.
- Never include `email`, password or unapproved tutors.
- Load it in **one** query with `include` (profile → subjects → subject, availabilities filtered by `endTime > now`), not one query per tutor.

---

## 6. Lecture-file attachments (R4): only if the team accepts it

Recommended two-step flow, so the booking transaction never waits on file I/O:

1. `POST /api/attachments` (`STUDENT`, `multipart/form-data`, field `file`, one file per request).
   - Validate type (allow-list on the sniffed MIME, not the extension) and size ≤ 20 MB. Limits and messages: `client/src/utils/attachments.ts` (`attachmentError`).
   - Store the file outside the web root under a random key.
   - Insert a row with `bookingId = null`, `uploadedById = student`.
   - Returns `201 { id, name, size, type }`.
2. `POST /api/bookings` with `attachmentIds` (≤ 5). Inside the booking transaction:
   - check every id belongs to this student and is unattached → else `400`;
   - set `bookingId`.
3. `GET /api/attachments/:id` streams the file to the booking's student, tutor or an admin (same rule as `GET /api/bookings/:id`). Send `Content-Disposition: attachment` so it downloads.
4. A daily job deletes unattached uploads older than 24 h.

The prototype stores only `{ name, size, type }` and uploads nothing. The real DTO adds `id` so the client can link to `GET /api/attachments/:id`.

---

## 7. Moving the client from mock to API

1. Add `client/src/api/httpClient.ts`:
   - `fetch` wrapper that adds the bearer token;
   - parses `{ message }` into the existing `ApiError(status, message)`, so every screen's error handling keeps working unchanged.
2. Re-implement `MockAppContext`'s actions on top of it (same names: `login`, `register`, `verifyEmail`, `updateTutorProfile`, `createAvailability`, `deleteAvailability`, `createBookingWithMockPayment`, …). Components already call only these actions, plus the read helpers below.
3. Replace these mock-DB reads with the endpoints in §5:
   - `listTutorDirectory`, `listBookings`, `subjectsOfTutor`;
   - `userNameOf`, `subjectNameOf`, `currentRateOf` → embedded fields in the booking DTO;
   - `db.subjects`, `db.availabilities`, `adminSummary`.
4. Keep `client/src/types/types.ts` as the shared contract. Delete `MockDb`, `credentials` and `nextIds` once nothing uses them.
5. Remove the demo-only pieces:
   - `DemoToolbar`;
   - `simulateConflict` (the real 409 comes from concurrency);
   - the seed-account buttons on the sign-in page.

---

## 8. Seed data and tests

**Seed** (`prisma/seed.ts`): mirror `client/src/data/seedData.ts`.

| Account | Email | Notes |
|---|---|---|
| Alice | `alice@tutorhub.dev` | Tutor, approved. Python Basics ฿400, Data Structures ฿450. |
| Bob | `bob@tutorhub.dev` | Tutor, approved. Calculus I ฿350, Linear Algebra ฿380. |
| Charlie | `charlie@tutorhub.dev` | Student, verified. |
| Diana | `diana@tutorhub.dev` | Student, **not** verified (BR-02 demo). |
| Admin User | `admin@tutorhub.dev` | Admin. |

- Use the same subjects, levels and topics. Keep one booking whose snapshot (฿300) is below the tutor's current rate, so BR-09 is visible.
- Hash the shared demo password with bcrypt.
- Availability is relative to "now" (tomorrow, day after); compute it at seed time.

**Tests** (NFR-05). Vitest + supertest against a throwaway Postgres (Docker, or a schema per test run):

| Port from `mockApi.test.ts` | Plus server-only cases |
|---|---|
| Every `describe` block: auth, profile, availability, booking, list, get, directory | `401` with no/expired token on every protected route |
| Status code **and** message for each error | `403` cross-user reads (NFR-02) on bookings and attachments |
| "Rolls back atomically on conflict": assert no booking row and availability unchanged | Two parallel `POST /api/bookings` for the same hour: exactly one `201`, one `409` (BR-08) |
| Price snapshot unchanged after `PUT /api/tutor/profile` (BR-09) | Password never appears in any response |

Pure rules (`client/src/utils/bookingRules.ts` + its tests) have no browser dependency. Copy them into `server/src/domain/` (or a shared package later) rather than rewriting them, so client preview and server enforcement can't drift.

---

## 9. Open decisions

| # | Decision | Owner | Blocks |
|---|---|---|---|
| D1 | Accept lecture-file attachments (R4) and update SRS §4.2, or drop it from the UI. | Team + PO | §6, `BookingAttachment` |
| D2 | Teaching levels list: High school / Undergraduate / Graduate, or the school's own year levels. | Team | `TeachingLevel` enum |
| D3 | Add levels/topics (R3) and per-subject rates (R2) to SRS FR-05 and SDS §2/§4.2. | Doc owners | SDS sign-off |
| D4 | Money as `Decimal(10,2)` instead of SDS `Float`. | Backend | Migration |
| D5 | Adopt the extra endpoints in §5 into SDS §4. | Backend + Frontend | Client swap |
