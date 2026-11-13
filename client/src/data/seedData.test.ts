import { describe, expect, it } from 'vitest'
import { createSeedDb, SEED_PASSWORD } from './seedData'

const HOUR_MS = 60 * 60 * 1000
// Fixed local "now" so the relative seed dates are deterministic.
const NOW = new Date(2026, 10, 12, 8, 0, 0, 0)

describe('createSeedDb (F-08, SRS Section 9)', () => {
  const db = createSeedDb(NOW)
  const byName = (name: string) => db.users.find((u) => u.name === name)

  it('creates the five SRS seed users with exactly one role each', () => {
    expect(db.users.map((u) => [u.name, u.role])).toEqual([
      ['Alice', 'TUTOR'],
      ['Bob', 'TUTOR'],
      ['Charlie', 'STUDENT'],
      ['Diana', 'STUDENT'],
      ['Admin User', 'ADMIN'],
    ])
  })

  it('seeds Diana unverified so BR-02 can be demoed, Charlie verified', () => {
    expect(byName('Diana')?.isEmailVerified).toBe(false)
    expect(byName('Charlie')?.isEmailVerified).toBe(true)
  })

  it('seeds both tutors as approved', () => {
    expect(byName('Alice')?.isApproved).toBe(true)
    expect(byName('Bob')?.isApproved).toBe(true)
  })

  it('gives every seed user a dev-only credential', () => {
    for (const user of db.users) {
      expect(db.credentials[user.id]).toBe(SEED_PASSWORD)
    }
  })

  it('seeds the four SRS subjects', () => {
    expect(db.subjects.map((s) => s.name)).toEqual([
      'Python Basics',
      'Data Structures',
      'Calculus I',
      'Linear Algebra',
    ])
  })

  it('creates a tutor profile with subjects for each tutor', () => {
    for (const tutor of db.users.filter((u) => u.role === 'TUTOR')) {
      const profile = db.tutorProfiles.find((p) => p.userId === tutor.id)
      expect(profile).toBeDefined()
      const subjectLinks = db.tutorSubjects.filter((ts) => ts.tutorProfileId === profile!.id)
      expect(subjectLinks.length).toBeGreaterThan(0)
    }
  })

  it('prices each taught subject separately, in baht', () => {
    const rate = (tutorName: string, subjectName: string) => {
      const profile = db.tutorProfiles.find((p) => p.userId === byName(tutorName)!.id)!
      const subject = db.subjects.find((s) => s.name === subjectName)!
      return db.tutorSubjects.find((ts) => ts.tutorProfileId === profile.id && ts.subjectId === subject.id)?.hourlyPrice
    }
    expect(rate('Alice', 'Python Basics')).toBe(400)
    expect(rate('Alice', 'Data Structures')).toBe(450)
    expect(rate('Bob', 'Calculus I')).toBe(350)
    expect(rate('Bob', 'Linear Algebra')).toBe(380)
  })

  it('describes the levels and topics for every taught subject', () => {
    for (const link of db.tutorSubjects) {
      expect(link.levels.length).toBeGreaterThan(0)
      expect(link.topics).toBeTruthy()
    }
  })

  it('keeps every availability BR-04 compliant and in the future', () => {
    expect(db.availabilities.length).toBeGreaterThan(0)
    for (const a of db.availabilities) {
      const start = new Date(a.startTime)
      const duration = new Date(a.endTime).getTime() - start.getTime()
      expect([0, 30]).toContain(start.getMinutes())
      expect(duration).toBeGreaterThanOrEqual(HOUR_MS)
      expect(duration % HOUR_MS).toBe(0)
      expect(start.getTime()).toBeGreaterThan(NOW.getTime())
    }
  })

  it("includes Alice's 3-hour :30-aligned window tomorrow for the partial-booking demo", () => {
    const alice = byName('Alice')!
    const tomorrow0930 = new Date(2026, 10, 13, 9, 30).toISOString()
    const tomorrow1230 = new Date(2026, 10, 13, 12, 30).toISOString()
    expect(
      db.availabilities.some(
        (a) => a.tutorId === alice.id && a.startTime === tomorrow0930 && a.endTime === tomorrow1230,
      ),
    ).toBe(true)
  })

  it('seeds confirmed bookings whose totals equal snapshot × duration (BR-09)', () => {
    expect(db.bookings.length).toBeGreaterThan(0)
    for (const b of db.bookings) {
      expect(b.status).toBe('CONFIRMED')
      expect(b.paymentStatus).toBe('SUCCESS')
      expect(b.totalPrice).toBe(b.hourlyPriceSnapshot * b.durationHours)
    }
  })

  it('seeds at least one booking whose snapshot differs from the current subject rate (BR-09 demo)', () => {
    const differs = db.bookings.some((b) => {
      const profile = db.tutorProfiles.find((p) => p.userId === b.tutorId)
      const link = db.tutorSubjects.find((ts) => ts.tutorProfileId === profile?.id && ts.subjectId === b.subjectId)
      return link !== undefined && link.hourlyPrice !== b.hourlyPriceSnapshot
    })
    expect(differs).toBe(true)
  })

  it('seeds bookings with no attachments', () => {
    expect(db.bookings.every((b) => Array.isArray(b.attachments) && b.attachments.length === 0)).toBe(true)
  })

  it('never lets a seeded availability overlap a seeded booking of the same tutor (BR-06 slicing)', () => {
    for (const b of db.bookings) {
      const bs = new Date(b.startTime).getTime()
      const be = new Date(b.endTime).getTime()
      for (const a of db.availabilities.filter((x) => x.tutorId === b.tutorId)) {
        const as = new Date(a.startTime).getTime()
        const ae = new Date(a.endTime).getTime()
        expect(as < be && bs < ae).toBe(false)
      }
    }
  })

  it('sets id counters past the seeded rows', () => {
    expect(db.nextIds.user).toBeGreaterThan(Math.max(...db.users.map((u) => u.id)))
    expect(db.nextIds.booking).toBeGreaterThan(Math.max(...db.bookings.map((b) => b.id)))
    expect(db.nextIds.availability).toBeGreaterThan(Math.max(...db.availabilities.map((a) => a.id)))
  })
})
