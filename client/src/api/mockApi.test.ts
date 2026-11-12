import { describe, expect, it } from 'vitest'
import { createSeedDb, SEED_PASSWORD } from '../data/seedData'
import type { MockDb } from '../types/types'
import {
  ApiError,
  createAvailability,
  createBooking,
  deleteAvailability,
  getBookingById,
  listBookings,
  listTutorDirectory,
  login,
  registerStudent,
  resetPassword,
  updateTutorProfile,
  verifyEmail,
} from './mockApi'

const NOW = new Date(2026, 10, 12, 8, 0)
const day = (offset: number, hh: number, mm = 0) => new Date(2026, 10, 12 + offset, hh, mm).toISOString()
const ALICE = 1
const BOB = 2
const CHARLIE = 3
const DIANA = 4
const ADMIN = 5

const fresh = (): MockDb => createSeedDb(NOW)
const userOf = (db: MockDb, id: number) => db.users.find((u) => u.id === id)!

/** Runs `fn` and returns the ApiError it throws, failing the test otherwise. */
function apiErrorOf(fn: () => unknown): ApiError {
  try {
    fn()
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('expected an ApiError')
}

describe('login (FR-01)', () => {
  it('returns the user for valid seed credentials', () => {
    expect(login(fresh(), 'alice@tutorhub.dev', SEED_PASSWORD).name).toBe('Alice')
  })

  it('matches email case-insensitively', () => {
    expect(login(fresh(), 'Alice@TutorHub.dev', SEED_PASSWORD).id).toBe(ALICE)
  })

  it('rejects a wrong password with 401', () => {
    expect(apiErrorOf(() => login(fresh(), 'alice@tutorhub.dev', 'nope')).status).toBe(401)
  })
})

describe('registerStudent (FR-02, BR-01, BR-02)', () => {
  it('creates an unverified STUDENT', () => {
    const { db, data } = registerStudent(fresh(), { name: 'Eve', email: 'eve@kmutt.ac.th', password: 'secret12' }, NOW)
    expect(data).toMatchObject({ role: 'STUDENT', isEmailVerified: false, name: 'Eve' })
    expect(login(db, 'eve@kmutt.ac.th', 'secret12').id).toBe(data.id)
  })

  it('rejects a duplicate email with 409', () => {
    const err = apiErrorOf(() =>
      registerStudent(fresh(), { name: 'X', email: 'charlie@tutorhub.dev', password: 'secret12' }, NOW),
    )
    expect(err.status).toBe(409)
  })

  it.each([
    ['bad email', { name: 'X', email: 'not-an-email', password: 'secret12' }],
    ['short password', { name: 'X', email: 'x@y.com', password: '123' }],
    ['blank name', { name: '  ', email: 'x@y.com', password: 'secret12' }],
  ])('rejects %s with 400', (_label, req) => {
    expect(apiErrorOf(() => registerStudent(fresh(), req, NOW)).status).toBe(400)
  })
})

describe('verifyEmail (FR-04)', () => {
  it('marks the student verified', () => {
    const { db } = verifyEmail(fresh(), DIANA, NOW)
    expect(userOf(db, DIANA).isEmailVerified).toBe(true)
  })
})

describe('resetPassword (FR-04)', () => {
  it('lets the user sign in with the new password', () => {
    const { db } = resetPassword(fresh(), 'diana@tutorhub.dev', 'newpass99')
    expect(login(db, 'diana@tutorhub.dev', 'newpass99').id).toBe(DIANA)
  })

  it('does not reveal whether an email exists', () => {
    const before = fresh()
    const { db } = resetPassword(before, 'nobody@tutorhub.dev', 'newpass99')
    expect(db.credentials).toEqual(before.credentials)
  })
})

describe('updateTutorProfile (FR-05)', () => {
  it('updates bio, rate and subjects for the tutor', () => {
    const { db } = updateTutorProfile(fresh(), userOf(fresh(), ALICE), { bio: 'New bio', hourlyPrice: 65, subjectIds: [1, 4] })
    const profile = db.tutorProfiles.find((p) => p.userId === ALICE)!
    expect(profile).toMatchObject({ bio: 'New bio', hourlyPrice: 65 })
    expect(db.tutorSubjects.filter((ts) => ts.tutorProfileId === profile.id).map((ts) => ts.subjectId)).toEqual([1, 4])
  })

  it('forbids non-tutors with 403', () => {
    const err = apiErrorOf(() => updateTutorProfile(fresh(), userOf(fresh(), CHARLIE), { hourlyPrice: 1, subjectIds: [1] }))
    expect(err.status).toBe(403)
  })

  it('rejects a non-positive rate with 400', () => {
    const err = apiErrorOf(() => updateTutorProfile(fresh(), userOf(fresh(), ALICE), { hourlyPrice: 0, subjectIds: [1] }))
    expect(err.status).toBe(400)
  })

  it('rejects an empty subject list with 400', () => {
    const err = apiErrorOf(() => updateTutorProfile(fresh(), userOf(fresh(), ALICE), { hourlyPrice: 40, subjectIds: [] }))
    expect(err.status).toBe(400)
  })

  it('leaves price snapshots on existing bookings untouched (BR-09)', () => {
    const before = fresh()
    const { db } = updateTutorProfile(before, userOf(before, ALICE), { hourlyPrice: 65, subjectIds: [1, 2] })
    const aliceBooking = db.bookings.find((b) => b.tutorId === ALICE)!
    expect(aliceBooking.hourlyPriceSnapshot).toBe(40)
    expect(aliceBooking.totalPrice).toBe(40)
  })
})

describe('createAvailability (FR-06, BR-04)', () => {
  const alice = () => userOf(fresh(), ALICE)

  it('creates a valid :30-aligned block', () => {
    const { db, data } = createAvailability(fresh(), alice(), { startTime: day(5, 9, 30), endTime: day(5, 11, 30) }, NOW)
    expect(data).toMatchObject({ tutorId: ALICE, startTime: day(5, 9, 30), endTime: day(5, 11, 30) })
    expect(db.availabilities.some((a) => a.id === data.id)).toBe(true)
  })

  it('rejects a BR-04 violation with 400', () => {
    const err = apiErrorOf(() => createAvailability(fresh(), alice(), { startTime: day(5, 9, 15), endTime: day(5, 10, 15) }, NOW))
    expect(err.status).toBe(400)
  })

  it('rejects a block overlapping existing availability with 400', () => {
    const err = apiErrorOf(() => createAvailability(fresh(), alice(), { startTime: day(1, 11, 30), endTime: day(1, 13, 30) }, NOW))
    expect(err.status).toBe(400)
  })

  it('rejects a block overlapping a booked lesson with 400', () => {
    const err = apiErrorOf(() => createAvailability(fresh(), alice(), { startTime: day(2, 14), endTime: day(2, 15) }, NOW))
    expect(err.status).toBe(400)
  })

  it('forbids students with 403', () => {
    const err = apiErrorOf(() =>
      createAvailability(fresh(), userOf(fresh(), CHARLIE), { startTime: day(5, 9), endTime: day(5, 10) }, NOW),
    )
    expect(err.status).toBe(403)
  })
})

describe('deleteAvailability (FR-06)', () => {
  it("removes the tutor's own block", () => {
    const { db } = deleteAvailability(fresh(), userOf(fresh(), ALICE), 1)
    expect(db.availabilities.some((a) => a.id === 1)).toBe(false)
  })

  it("forbids deleting another tutor's block with 403", () => {
    expect(apiErrorOf(() => deleteAvailability(fresh(), userOf(fresh(), BOB), 1)).status).toBe(403)
  })
})

describe('createBooking (FR-08..FR-10)', () => {
  const charlie = (db: MockDb) => userOf(db, CHARLIE)
  // Alice's seed window: tomorrow 09:30–12:30.
  const partial = { tutorId: ALICE, subjectId: 1, startTime: day(1, 10, 30), durationHours: 1, notes: 'Recursion' }

  it('confirms a partial booking with a SUCCESS payment and frozen price (BR-06, BR-09)', () => {
    const before = fresh()
    const { data } = createBooking(before, charlie(before), partial, { now: NOW })
    expect(data).toMatchObject({
      studentId: CHARLIE,
      tutorId: ALICE,
      startTime: day(1, 10, 30),
      endTime: day(1, 11, 30),
      durationHours: 1,
      hourlyPriceSnapshot: 40,
      totalPrice: 40,
      status: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
      notes: 'Recursion',
    })
  })

  it('slices the window into whole-hour blocks either side (BR-06)', () => {
    const before = fresh()
    const { db } = createBooking(before, charlie(before), partial, { now: NOW })
    const aliceBlocks = db.availabilities.filter((a) => a.tutorId === ALICE).map((a) => [a.startTime, a.endTime])
    expect(aliceBlocks).toEqual(
      expect.arrayContaining([
        [day(1, 9, 30), day(1, 10, 30)],
        [day(1, 11, 30), day(1, 12, 30)],
      ]),
    )
    expect(db.availabilities.some((a) => a.id === 1)).toBe(false)
  })

  it('blocks an unverified student with 400 (BR-02)', () => {
    const before = fresh()
    const err = apiErrorOf(() => createBooking(before, userOf(before, DIANA), partial, { now: NOW }))
    expect(err.status).toBe(400)
    expect(err.message).toMatch(/verify/i)
  })

  it('lets the student book once verified (BR-02)', () => {
    const { db } = verifyEmail(fresh(), DIANA, NOW)
    expect(createBooking(db, userOf(db, DIANA), partial, { now: NOW }).data.studentId).toBe(DIANA)
  })

  it('forbids tutors and admins with 403 (BR-03)', () => {
    const db = fresh()
    expect(apiErrorOf(() => createBooking(db, userOf(db, BOB), partial, { now: NOW })).status).toBe(403)
    expect(apiErrorOf(() => createBooking(db, userOf(db, ADMIN), partial, { now: NOW })).status).toBe(403)
  })

  it('rejects a misaligned start that would leave a fragment with 400 (BR-05)', () => {
    const db = fresh()
    const err = apiErrorOf(() => createBooking(db, charlie(db), { ...partial, startTime: day(1, 10) }, { now: NOW }))
    expect(err.status).toBe(400)
  })

  it('rejects a fractional duration with 400 (BR-05)', () => {
    const db = fresh()
    expect(apiErrorOf(() => createBooking(db, charlie(db), { ...partial, durationHours: 1.5 }, { now: NOW })).status).toBe(400)
  })

  it('rejects a booking running past the window with 409', () => {
    const db = fresh()
    expect(apiErrorOf(() => createBooking(db, charlie(db), { ...partial, durationHours: 3 }, { now: NOW })).status).toBe(409)
  })

  it('rejects a subject the tutor does not teach with 400', () => {
    const db = fresh()
    expect(apiErrorOf(() => createBooking(db, charlie(db), { ...partial, subjectId: 3 }, { now: NOW })).status).toBe(400)
  })

  it("rejects overlapping the student's lesson with another tutor with 409 (BR-07)", () => {
    // Charlie already has Alice at D+2 14:00–15:00; Bob is open D+2 13:30–16:30.
    const db = fresh()
    const err = apiErrorOf(() =>
      createBooking(db, charlie(db), { tutorId: BOB, subjectId: 3, startTime: day(2, 13, 30), durationHours: 1 }, { now: NOW }),
    )
    expect(err.status).toBe(409)
  })

  it('rejects the second of two bookings for the same slot with 409', () => {
    const first = fresh()
    const { db } = createBooking(first, charlie(first), partial, { now: NOW })
    const verified = verifyEmail(db, DIANA, NOW).db
    expect(apiErrorOf(() => createBooking(verified, userOf(verified, DIANA), partial, { now: NOW })).status).toBe(409)
  })

  it('rolls back atomically on a simulated concurrent conflict (BR-08)', () => {
    const before = fresh()
    const snapshot = structuredClone(before)
    const err = apiErrorOf(() => createBooking(before, charlie(before), partial, { now: NOW, simulateConflict: true }))
    expect(err.status).toBe(409)
    expect(before).toEqual(snapshot)
  })

  it('does not mutate the input db on success', () => {
    const before = fresh()
    const snapshot = structuredClone(before)
    createBooking(before, charlie(before), partial, { now: NOW })
    expect(before).toEqual(snapshot)
  })
})

describe('listBookings (FR-11, NFR-02)', () => {
  const db = fresh()

  it('returns only the student’s own bookings', () => {
    expect(listBookings(db, userOf(db, CHARLIE)).every((b) => b.studentId === CHARLIE)).toBe(true)
    expect(listBookings(db, userOf(db, DIANA))).toEqual([])
  })

  it('returns only the tutor’s own appointments', () => {
    expect(listBookings(db, userOf(db, ALICE)).map((b) => b.tutorId)).toEqual([ALICE])
  })

  it('returns every booking for admin', () => {
    expect(listBookings(db, userOf(db, ADMIN))).toHaveLength(db.bookings.length)
  })

  it('sorts by start time', () => {
    const starts = listBookings(db, userOf(db, ADMIN)).map((b) => b.startTime)
    expect(starts).toEqual([...starts].sort())
  })
})

describe('getBookingById (FR-11, SDS §4.3, NFR-02)', () => {
  it('returns the booking to the owning student, owning tutor, or admin, and 403s others', () => {
    const db = createSeedDb(new Date(2026, 10, 12, 8, 0))
    const alice = db.users.find((u) => u.id === 1)!
    const bob = db.users.find((u) => u.id === 2)!
    const charlie = db.users.find((u) => u.id === 3)!
    const diana = db.users.find((u) => u.id === 4)!
    const admin = db.users.find((u) => u.id === 5)!

    expect(getBookingById(db, charlie, 1).id).toBe(1)
    expect(getBookingById(db, alice, 1).id).toBe(1)
    expect(getBookingById(db, admin, 1).id).toBe(1)
    expect(() => getBookingById(db, diana, 1)).toThrowError(/permission/i)
    expect(() => getBookingById(db, bob, 1)).toThrowError(/permission/i)
  })

  it('uses 403 for a stranger and 404 for a missing id', () => {
    const db = fresh()
    expect(apiErrorOf(() => getBookingById(db, userOf(db, DIANA), 1)).status).toBe(403)
    expect(apiErrorOf(() => getBookingById(db, userOf(db, ADMIN), 999)).status).toBe(404)
  })
})

describe('listTutorDirectory (FR-07)', () => {
  const db = fresh()

  it('lists approved tutors with subjects, rate and future availability', () => {
    const alice = listTutorDirectory(db, { now: NOW }).find((t) => t.user.id === ALICE)!
    expect(alice.profile.hourlyPrice).toBe(40)
    expect(alice.subjects.map((s) => s.name)).toEqual(['Python Basics', 'Data Structures'])
    expect(alice.availabilities.length).toBeGreaterThan(0)
  })

  it('filters by subject', () => {
    expect(listTutorDirectory(db, { now: NOW, subjectId: 3 }).map((t) => t.user.id)).toEqual([BOB])
  })

  it('filters tutor directory by tutorId and local date (FR-07, SDS §4.2)', () => {
    const now = new Date(2026, 10, 12, 8, 0)
    const db = createSeedDb(now)
    const day1 = '2026-11-13'
    const day3 = '2026-11-15'

    const onlyBob = listTutorDirectory(db, { now, tutorId: 2 })
    expect(onlyBob.map((l) => l.user.name)).toEqual(['Bob'])

    const onDay1 = listTutorDirectory(db, { now, date: day1 })
    // Both tutors are open on D+1 (Alice 09:30, Bob 10:00); an empty result must not pass vacuously.
    expect(onDay1.map((l) => l.user.name)).toEqual(['Alice', 'Bob'])
    expect(onDay1.flatMap((l) => l.availabilities).every((a) => new Date(a.startTime).getDate() === 13)).toBe(true)

    // Nobody is open on D+3: date search drops tutors with nothing that day.
    expect(listTutorDirectory(db, { now, date: day3 })).toEqual([])
  })

  it('drops a tutor who teaches the subject but has no window on the chosen date', () => {
    // Bob teaches Calculus I; his windows are D+1, D+2 and D+4, none on D+3.
    expect(listTutorDirectory(db, { now: NOW, subjectId: 3, tutorId: BOB, date: '2026-11-15' })).toEqual([])
    const onD4 = listTutorDirectory(db, { now: NOW, subjectId: 3, date: '2026-11-16' })
    expect(onD4.map((l) => l.user.id)).toEqual([BOB])
    expect(onD4[0].availabilities.map((a) => a.id)).toEqual([6, 7])
  })

  it('skips a tutor who has no profile instead of throwing', () => {
    const broken = { ...db, tutorProfiles: db.tutorProfiles.filter((p) => p.userId !== BOB) }
    expect(listTutorDirectory(broken, { now: NOW }).map((t) => t.user.id)).toEqual([ALICE])
  })

  it('drops windows that have no bookable start left', () => {
    const late = new Date(2026, 10, 13, 12, 0) // Alice's 09:30–12:30 window has no start after 12:00
    const alice = listTutorDirectory(db, { now: late }).find((t) => t.user.id === ALICE)!
    expect(alice.availabilities.some((a) => a.id === 1)).toBe(false)
  })
})
