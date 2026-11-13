import { describe, expect, it } from 'vitest'
import type { Availability, Booking } from '../types/types'
import {
  calculateTotalPrice,
  getValidStartSlots,
  hasBookingOverlap,
  isAlignedBookingStart,
  sliceAvailabilityAfterBooking,
  validateAvailabilityInput,
} from './bookingRules'

// Local wall-clock times on a fixed future day.
const t = (hh: number, mm = 0) => new Date(2026, 10, 20, hh, mm)
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

const availability = (start: Date, end: Date, overrides: Partial<Availability> = {}): Availability => ({
  id: 1,
  tutorId: 1,
  startTime: start.toISOString(),
  endTime: end.toISOString(),
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

const booking = (overrides: Partial<Booking>): Booking => ({
  id: 1,
  studentId: 3,
  tutorId: 1,
  subjectId: 1,
  startTime: t(10).toISOString(),
  endTime: t(11).toISOString(),
  durationHours: 1,
  hourlyPriceSnapshot: 40,
  totalPrice: 40,
  notes: null,
  attachments: [],
  lessonSummary: null,
  status: 'CONFIRMED',
  paymentStatus: 'SUCCESS',
  cancelledBy: null,
  cancelledAt: null,
  refundPercentage: null,
  refundAmount: null,
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

describe('validateAvailabilityInput (BR-04)', () => {
  it('accepts a 3h block starting on :30', () => {
    expect(validateAvailabilityInput(t(9, 30), t(12, 30))).toEqual({ ok: true })
  })

  it('accepts a 1h block starting on :00', () => {
    expect(validateAvailabilityInput(t(9), t(10))).toEqual({ ok: true })
  })

  it.each([
    ['09:15', t(9, 15), t(10, 15)],
    ['09:45', t(9, 45), t(10, 45)],
  ])('rejects a start on %s', (_label, start, end) => {
    const result = validateAvailabilityInput(start, end)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/:00 or :30/)
  })

  it('rejects a duration under one hour', () => {
    const result = validateAvailabilityInput(t(9), t(9, 30))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/at least 1 hour/)
  })

  it('rejects a 1.5h duration', () => {
    const result = validateAvailabilityInput(t(9), t(10, 30))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/whole number of hours/)
  })

  it('rejects an end before the start', () => {
    expect(validateAvailabilityInput(t(12), t(10)).ok).toBe(false)
  })

  it('rejects a start in the past when now is given', () => {
    const result = validateAvailabilityInput(t(9), t(10), t(9, 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/future/)
  })
})

describe('getValidStartSlots (BR-05)', () => {
  const block = availability(t(9, 30), t(12, 30))

  it('steps in whole hours from the block start', () => {
    expect(getValidStartSlots(block).map(hhmm)).toEqual(['09:30', '10:30', '11:30'])
  })

  it('never offers 10:00 inside a 09:30–12:30 block', () => {
    expect(getValidStartSlots(block).map(hhmm)).not.toContain('10:00')
  })

  it('drops start times that are not in the future when now is given', () => {
    expect(getValidStartSlots(block, t(10)).map(hhmm)).toEqual(['10:30', '11:30'])
  })
})

describe('isAlignedBookingStart (BR-05)', () => {
  const block = availability(t(9, 30), t(12, 30))

  it('accepts a start a whole number of hours after the block start', () => {
    expect(isAlignedBookingStart(block, t(10, 30))).toBe(true)
  })

  it('rejects a start that would leave a 30-minute fragment', () => {
    expect(isAlignedBookingStart(block, t(10))).toBe(false)
  })
})

describe('sliceAvailabilityAfterBooking (BR-06)', () => {
  const block = availability(t(9, 30), t(12, 30))
  const asText = (parts: { start: Date; end: Date }[]) => parts.map((p) => `${hhmm(p.start)}-${hhmm(p.end)}`)

  it('splits a middle booking into whole-hour blocks either side', () => {
    expect(asText(sliceAvailabilityAfterBooking(block, t(10, 30), t(11, 30)))).toEqual([
      '09:30-10:30',
      '11:30-12:30',
    ])
  })

  it('leaves only the tail when the booking starts at the block start', () => {
    expect(asText(sliceAvailabilityAfterBooking(block, t(9, 30), t(11, 30)))).toEqual(['11:30-12:30'])
  })

  it('leaves only the head when the booking ends at the block end', () => {
    expect(asText(sliceAvailabilityAfterBooking(block, t(10, 30), t(12, 30)))).toEqual(['09:30-10:30'])
  })

  it('leaves nothing when the booking takes the whole block', () => {
    expect(sliceAvailabilityAfterBooking(block, t(9, 30), t(12, 30))).toEqual([])
  })

  it('throws when the booking does not fit inside the block', () => {
    expect(() => sliceAvailabilityAfterBooking(block, t(12), t(13))).toThrow(/within/)
  })
})

describe('hasBookingOverlap (BR-07)', () => {
  const existing = [booking({ studentId: 3, tutorId: 1, startTime: t(10).toISOString(), endTime: t(11).toISOString() })]

  it('detects a student double-booking with a different tutor', () => {
    expect(hasBookingOverlap(existing, 3, 2, t(10, 30), t(11, 30))).toBe(true)
  })

  it('detects a tutor double-booked by a different student', () => {
    expect(hasBookingOverlap(existing, 4, 1, t(10), t(11))).toBe(true)
  })

  it('allows back-to-back bookings that only touch at the boundary', () => {
    expect(hasBookingOverlap(existing, 3, 1, t(11), t(12))).toBe(false)
  })

  it('ignores unrelated students and tutors', () => {
    expect(hasBookingOverlap(existing, 4, 2, t(10), t(11))).toBe(false)
  })

  it('ignores cancelled bookings', () => {
    const cancelled = [{ ...existing[0], status: 'CANCELLED' as const }]
    expect(hasBookingOverlap(cancelled, 3, 1, t(10), t(11))).toBe(false)
  })
})

describe('calculateTotalPrice (BR-09)', () => {
  it('multiplies the hourly snapshot by whole hours', () => {
    expect(calculateTotalPrice(40, 3)).toBe(120)
  })
})
