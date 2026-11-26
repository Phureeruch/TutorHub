import { describe, expect, it } from 'vitest'
import type { Availability, User } from '../../types/types'
import { createSeedDb } from '../../data/seedData'
import {
  bookingBlockReason,
  chunkSelectionToBooking,
  findStudentConflictingBooking,
  liveSelection,
  priceSummary,
  toggleChunk,
  windowChunks,
} from './bookingForm'

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

describe('windowChunks (BR-05 hour chunks, CHG-03B 2h cutoff)', () => {
  const at = (c: { start: Date }) => `${c.start.getHours()}:${String(c.start.getMinutes()).padStart(2, '0')}`

  it('splits a 09:30–12:30 window into hour chunks from its own start', () => {
    expect(windowChunks(block, t(7)).map(at)).toEqual(['9:30', '10:30', '11:30'])
    expect(windowChunks(block, t(7)).every((c) => c.bookable)).toBe(true)
  })

  it('marks chunks starting in less than 2 hours as not bookable (STS-L7-07)', () => {
    expect(windowChunks(block, t(8)).map((c) => c.bookable)).toEqual([false, true, true])
  })
})

describe('toggleChunk (slot picker: tap each hour, back to back)', () => {
  const chunks = windowChunks(block, t(7)) // 09:30, 10:30, 11:30
  const sel = (start: number, length: number) => ({ start, length })

  it('selects a single hour on the first tap', () => {
    expect(toggleChunk(null, 1, chunks)).toEqual({ selection: sel(1, 1), refused: null })
  })

  it('adds the hour right after or right before the selection', () => {
    expect(toggleChunk(sel(1, 1), 2, chunks).selection).toEqual(sel(1, 2))
    expect(toggleChunk(sel(1, 1), 0, chunks).selection).toEqual(sel(0, 2))
  })

  it('removes an hour from either end of the selection', () => {
    expect(toggleChunk(sel(0, 3), 0, chunks).selection).toEqual(sel(1, 2))
    expect(toggleChunk(sel(0, 3), 2, chunks).selection).toEqual(sel(0, 2))
  })

  it('clears the selection when the only selected hour is tapped again', () => {
    expect(toggleChunk(sel(1, 1), 1, chunks)).toEqual({ selection: null, refused: null })
  })

  it('refuses an hour that would leave a gap, keeping the selection', () => {
    expect(toggleChunk(sel(0, 1), 2, chunks)).toEqual({ selection: sel(0, 1), refused: 'gap' })
  })

  it('refuses removing a middle hour, which would split the lesson', () => {
    expect(toggleChunk(sel(0, 3), 1, chunks)).toEqual({ selection: sel(0, 3), refused: 'split' })
  })

  it('refuses selecting a 5th consecutive hour (CHG-03B max 4h cap, STS-L7-07)', () => {
    const longBlock: Availability = {
      id: 99,
      tutorId: 1,
      startTime: t(9).toISOString(),
      endTime: t(15).toISOString(),
      createdAt: '',
      updatedAt: '',
    }
    const sixChunks = windowChunks(longBlock, t(6))
    expect(toggleChunk(sel(0, 4), 4, sixChunks)).toEqual({ selection: sel(0, 4), refused: 'max_duration' })
  })

  it('ignores taps on hours that are within the 2h cutoff', () => {
    const late = windowChunks(block, t(8))
    expect(toggleChunk(sel(1, 1), 0, late)).toEqual({ selection: sel(1, 1), refused: null })
  })

  it('turns a selection into a start time and whole-hour length', () => {
    expect(chunkSelectionToBooking(chunks, sel(1, 2))).toEqual({ start: t(10, 30), durationHours: 2 })
    expect(chunkSelectionToBooking(chunks, null)).toEqual({ start: null, durationHours: 0 })
  })
})

describe('liveSelection (hours that enter the 2h cutoff while the dialog is open)', () => {
  const sel = (start: number, length: number) => ({ start, length })

  it('keeps a selection whose hours are all still bookable', () => {
    expect(liveSelection(sel(0, 3), windowChunks(block, t(7)))).toEqual(sel(0, 3))
  })

  it('trims hours that have entered the cutoff instead of dropping the whole lesson', () => {
    expect(liveSelection(sel(0, 3), windowChunks(block, t(8)))).toEqual(sel(1, 2))
  })

  it('clears the selection once every chosen hour is unbookable', () => {
    expect(liveSelection(sel(0, 1), windowChunks(block, t(8)))).toBeNull()
    expect(liveSelection(null, windowChunks(block, t(7)))).toBeNull()
  })
})

describe('priceSummary (BR-09, CHG-03A, STS-L7-07)', () => {
  it('computes subtotal, discountPercentage, discountAmount, and discounted total', () => {
    expect(priceSummary(400, 1)).toEqual({
      hourly: 400,
      hours: 1,
      subtotal: 400,
      discountPercentage: 0,
      discountAmount: 0,
      total: 400,
    })
    expect(priceSummary(400, 2)).toEqual({
      hourly: 400,
      hours: 2,
      subtotal: 800,
      discountPercentage: 5,
      discountAmount: 40,
      total: 760,
    })
    expect(priceSummary(400, 3)).toEqual({
      hourly: 400,
      hours: 3,
      subtotal: 1200,
      discountPercentage: 10,
      discountAmount: 120,
      total: 1080,
    })
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
