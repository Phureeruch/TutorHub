import type { Availability, Booking, PaymentStatus } from '../types/types'

export const HOUR_MS = 60 * 60 * 1000

export type ValidationResult = { ok: true } | { ok: false; error: string }

export interface Interval {
  start: Date
  end: Date
}

/** BR-04: ≥ 1h, whole hours, starting on :00 or :30, and (optionally) in the future. */
export function validateAvailabilityInput(startTime: Date, endTime: Date, now?: Date): ValidationResult {
  const minutes = startTime.getMinutes()
  if ((minutes !== 0 && minutes !== 30) || startTime.getSeconds() !== 0 || startTime.getMilliseconds() !== 0) {
    return { ok: false, error: 'Availability must start on :00 or :30.' }
  }
  const duration = endTime.getTime() - startTime.getTime()
  if (duration < HOUR_MS) {
    return { ok: false, error: 'Availability must be at least 1 hour long.' }
  }
  if (duration % HOUR_MS !== 0) {
    return { ok: false, error: 'Availability must last a whole number of hours.' }
  }
  if (now && startTime.getTime() <= now.getTime()) {
    return { ok: false, error: 'Availability must start in the future.' }
  }
  return { ok: true }
}

/**
 * BR-05: the start of every whole hour in a block, counted from the block's own
 * start, so every booking and every leftover piece stays a whole number of hours.
 */
export function hourStarts(availability: Availability): Date[] {
  const start = new Date(availability.startTime).getTime()
  const end = new Date(availability.endTime).getTime()
  const starts: Date[] = []
  for (let s = start; s + HOUR_MS <= end; s += HOUR_MS) starts.push(new Date(s))
  return starts
}

/** BR-05: bookable start times, i.e. hour starts still in the future when `now` is given. */
export function getValidStartSlots(availability: Availability, now?: Date): Date[] {
  return hourStarts(availability).filter((s) => !now || s.getTime() > now.getTime())
}

export function isAlignedBookingStart(availability: Availability, bookingStart: Date): boolean {
  const offset = bookingStart.getTime() - new Date(availability.startTime).getTime()
  return offset >= 0 && offset % HOUR_MS === 0
}

export function isWithin(availability: Availability, start: Date, end: Date): boolean {
  return (
    start.getTime() >= new Date(availability.startTime).getTime() &&
    end.getTime() <= new Date(availability.endTime).getTime() &&
    start.getTime() < end.getTime()
  )
}

/** BR-06: the pieces of `availability` left open after carving out the booking. */
export function sliceAvailabilityAfterBooking(availability: Availability, bookingStart: Date, bookingEnd: Date): Interval[] {
  if (!isWithin(availability, bookingStart, bookingEnd)) {
    throw new Error('Booking must fit within the availability period.')
  }
  const blockStart = new Date(availability.startTime)
  const blockEnd = new Date(availability.endTime)
  const remaining: Interval[] = []
  if (blockStart.getTime() < bookingStart.getTime()) remaining.push({ start: blockStart, end: bookingStart })
  if (bookingEnd.getTime() < blockEnd.getTime()) remaining.push({ start: bookingEnd, end: blockEnd })
  return remaining
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd

/** BR-07: does [start, end) clash with an active booking of the same student or the same tutor? */
export function hasBookingOverlap(
  existingBookings: Booking[],
  studentId: number,
  tutorId: number,
  start: Date,
  end: Date,
): boolean {
  return existingBookings.some(
    (b) =>
      b.status !== 'CANCELLED' &&
      (b.studentId === studentId || b.tutorId === tutorId) &&
      overlaps(new Date(b.startTime).getTime(), new Date(b.endTime).getTime(), start.getTime(), end.getTime()),
  )
}

/** BR-09: total is fixed from the snapshot at confirmation time. */
export function calculateTotalPrice(hourlyPriceSnapshot: number, durationHours: number): number {
  return hourlyPriceSnapshot * durationHours
}

export interface RefundPreview {
  refundPercentage: 100 | 50 | 0
  refundAmount: number
  paymentStatus: PaymentStatus
  hoursUntilStart: number
}

/** BR-11: 3-tier student cancellation refund calculation. */
export function calculateStudentRefund(
  _totalPrice: number,
  _startTime: Date | string,
  _now: Date,
): RefundPreview {
  throw new Error('Not implemented: calculateStudentRefund')
}

/** BR-13: merge an interval with any adjacent open windows for the same tutor. */
export function mergeAdjacentAvailabilities(
  _availabilities: Availability[],
  _tutorId: number,
  _interval: Interval,
  _nextId: number,
  _stamp: string,
): { availabilities: Availability[]; merged: Availability; nextAvailabilityId: number } {
  throw new Error('Not implemented: mergeAdjacentAvailabilities')
}
