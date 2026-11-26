import type { Availability, Booking, User } from '../../types/types'
import {
  calculatePriceBreakdown,
  HOUR_MS,
  hourStarts,
  MAX_BOOKING_DURATION_HOURS,
  MIN_BOOKING_LEAD_MS,
} from '../../utils/bookingRules'

/**
 * BR-07 preview: the student's own lesson that [start, start + hours) would clash
 * with, so the modal can say so before the mock payment instead of after it.
 */
export function findStudentConflictingBooking(
  existingBookings: Booking[],
  studentId: number,
  start: Date | null,
  durationHours: number,
): Booking | null {
  if (!start) return null
  const end = new Date(start.getTime() + durationHours * HOUR_MS)
  return (
    existingBookings.find(
      (b) =>
        b.studentId === studentId &&
        b.status !== 'CANCELLED' &&
        new Date(b.startTime) < end &&
        start < new Date(b.endTime),
    ) ?? null
  )
}

/** One bookable hour of a window, counted from the window's own start (BR-05). */
export interface Chunk {
  start: Date
  end: Date
  bookable: boolean
}

/** A run of back-to-back chunks: indexes [start, start + length). */
export interface ChunkSelection {
  start: number
  length: number
}

export function windowChunks(availability: Availability, now: Date): Chunk[] {
  return hourStarts(availability).map((start) => ({
    start,
    end: new Date(start.getTime() + HOUR_MS),
    bookable: start.getTime() - now.getTime() >= MIN_BOOKING_LEAD_MS,
  }))
}

/** Why a tap was not applied: it would leave a gap, cut the lesson in two, or exceed 4 hours. */
export type ChunkRefusal = 'gap' | 'split' | 'max_duration'

export interface ChunkToggle {
  selection: ChunkSelection | null
  refused: ChunkRefusal | null
}

/**
 * Tap-to-toggle on the ruler: each tap adds or removes one hour, and the total
 * follows. A lesson is one booking, so its hours must stay back to back: a tap
 * may only grow or shrink the selection at either end (up to MAX_BOOKING_DURATION_HOURS).
 */
export function toggleChunk(current: ChunkSelection | null, index: number, chunks: Chunk[]): ChunkToggle {
  if (!chunks[index]?.bookable) return { selection: current, refused: null }
  if (!current) return { selection: { start: index, length: 1 }, refused: null }

  const { start, length } = current
  const last = start + length - 1
  if (index === start && length === 1) return { selection: null, refused: null }
  if (index === start) return { selection: { start: start + 1, length: length - 1 }, refused: null }
  if (index === last) return { selection: { start, length: length - 1 }, refused: null }
  if (index > start && index < last) return { selection: current, refused: 'split' }
  if (index === start - 1) {
    if (length >= MAX_BOOKING_DURATION_HOURS) return { selection: current, refused: 'max_duration' }
    return { selection: { start: index, length: length + 1 }, refused: null }
  }
  if (index === last + 1) {
    if (length >= MAX_BOOKING_DURATION_HOURS) return { selection: current, refused: 'max_duration' }
    return { selection: { start, length: length + 1 }, refused: null }
  }
  return { selection: current, refused: 'gap' }
}

/**
 * The selection as it stands now. Hours start while the dialog is open, and
 * started hours are always at the front, so trim them rather than drop the lesson.
 */
export function liveSelection(selection: ChunkSelection | null, chunks: Chunk[]): ChunkSelection | null {
  if (!selection) return null
  const end = selection.start + selection.length
  let start = selection.start
  while (start < end && !chunks[start]?.bookable) start++
  return start < end ? { start, length: end - start } : null
}

/** Nothing chosen means no lesson: zero hours, so the receipt never prices a phantom hour. */
export function chunkSelectionToBooking(
  chunks: Chunk[],
  selection: ChunkSelection | null,
): { start: Date | null; durationHours: number } {
  if (!selection || !chunks[selection.start]) return { start: null, durationHours: 0 }
  return { start: chunks[selection.start].start, durationHours: selection.length }
}

export function priceSummary(hourly: number, hours: number) {
  const breakdown = calculatePriceBreakdown(hourly, hours)
  return {
    hourly,
    hours,
    subtotal: breakdown.subtotal,
    discountPercentage: breakdown.discountPercentage,
    discountAmount: breakdown.discountAmount,
    total: breakdown.total,
  }
}

/** BR-02: why this user cannot book yet, or null if they can. */
export function bookingBlockReason(user: User): string | null {
  if (user.role !== 'STUDENT') return 'Only students can book lessons.'
  if (!user.isEmailVerified) return 'Verify your email before you book a lesson.'
  return null
}
