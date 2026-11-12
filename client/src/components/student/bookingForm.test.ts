import { describe, expect, it } from 'vitest'
import type { Availability, User } from '../../types/types'
import { createSeedDb } from '../../data/seedData'
import { bookingBlockReason, bookingSegments, findStudentConflictingBooking, priceSummary } from './bookingForm'

const t = (hh: number, mm = 0) => new Date(2026, 10, 20, hh, mm)
const block: Availability = {
  id: 1,
  tutorId: 1,
  startTime: t(9, 30).toISOString(),
  endTime: t(12, 30).toISOString(),
  createdAt: '',
  updatedAt: '',
}

const student = (isEmailVerified: boolean): User => ({
  id: 3,
  email: 'x@y.z',
  name: 'X',
  role: 'STUDENT',
  isEmailVerified,
  isApproved: false,
  createdAt: '',
  updatedAt: '',
})

describe('bookingSegments (BR-05, BR-06 preview)', () => {
  const shape = (s: ReturnType<typeof bookingSegments>) =>
    s.map((x) => [x.kind, x.start.getHours() * 60 + x.start.getMinutes(), x.end.getHours() * 60 + x.end.getMinutes()])

  it('shows the chosen hour in the middle and what stays open either side', () => {
    expect(shape(bookingSegments(block, t(10, 30), 1))).toEqual([
      ['open', 9 * 60 + 30, 10 * 60 + 30],
      ['selected', 10 * 60 + 30, 11 * 60 + 30],
      ['open', 11 * 60 + 30, 12 * 60 + 30],
    ])
  })

  it('shows only the selection when it fills the window', () => {
    expect(shape(bookingSegments(block, t(9, 30), 3))).toEqual([['selected', 9 * 60 + 30, 12 * 60 + 30]])
  })

  it('shows the whole window open before a start is chosen', () => {
    expect(shape(bookingSegments(block, null, 1))).toEqual([['open', 9 * 60 + 30, 12 * 60 + 30]])
  })
})

describe('findStudentConflictingBooking (BR-07 preview)', () => {
  it('detects when a chosen slot overlaps an existing confirmed booking of the student (BR-07)', () => {
    const db = createSeedDb(new Date(2026, 10, 12, 8, 0))
    // Booking #1 for Charlie (id=3) is day+2 14:00–15:00; Bob is open 13:30–16:30 that day.
    expect(findStudentConflictingBooking(db.bookings, 3, new Date(2026, 10, 14, 15, 30), 1)).toBeNull()
    expect(findStudentConflictingBooking(db.bookings, 3, new Date(2026, 10, 14, 13, 30), 1)?.id).toBe(1)
    expect(findStudentConflictingBooking(db.bookings, 3, new Date(2026, 10, 14, 13, 30), 2)?.id).toBe(1)
  })

  it("ignores other students' lessons and cancelled ones", () => {
    const db = createSeedDb(new Date(2026, 10, 12, 8, 0))
    const at1330 = new Date(2026, 10, 14, 13, 30)
    expect(findStudentConflictingBooking(db.bookings, 4, at1330, 2)).toBeNull()
    const cancelled = db.bookings.map((b) => ({ ...b, status: 'CANCELLED' as const }))
    expect(findStudentConflictingBooking(cancelled, 3, at1330, 2)).toBeNull()
  })

  it('returns null before a start is chosen', () => {
    expect(findStudentConflictingBooking(createSeedDb(new Date()).bookings, 3, null, 1)).toBeNull()
  })
})

describe('priceSummary (BR-09)', () => {
  it('multiplies the current rate by the hours', () => {
    expect(priceSummary(40, 2)).toEqual({ hourly: 40, hours: 2, total: 80 })
  })
})

describe('bookingBlockReason (BR-02)', () => {
  it('blocks an unverified student', () => {
    expect(bookingBlockReason(student(false))).toMatch(/verify/i)
  })

  it('lets a verified student through', () => {
    expect(bookingBlockReason(student(true))).toBeNull()
  })
})
