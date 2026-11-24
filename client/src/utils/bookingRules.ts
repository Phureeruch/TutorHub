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

const roundCurrency = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100

/** BR-11: 3-tier student cancellation refund calculation. */
export function calculateStudentRefund(
  totalPrice: number,
  startTime: Date | string,
  now: Date,
): RefundPreview {
  const startMs = new Date(startTime).getTime()
  const remainingMs = startMs - now.getTime()
  const hoursUntilStart = remainingMs / HOUR_MS

  if (remainingMs >= 72 * HOUR_MS) {
    return {
      refundPercentage: 100,
      refundAmount: roundCurrency(totalPrice),
      paymentStatus: 'REFUNDED_FULL',
      hoursUntilStart,
    }
  }
  if (remainingMs >= 24 * HOUR_MS) {
    return {
      refundPercentage: 50,
      refundAmount: roundCurrency(totalPrice * 0.5),
      paymentStatus: 'REFUNDED_PARTIAL',
      hoursUntilStart,
    }
  }
  return {
    refundPercentage: 0,
    refundAmount: 0,
    paymentStatus: 'SUCCESS',
    hoursUntilStart,
  }
}

/** BR-13: merge an interval with any adjacent open windows for the same tutor. */
export function mergeAdjacentAvailabilities(
  availabilities: Availability[],
  tutorId: number,
  interval: Interval,
  nextId: number,
  stamp: string,
): { availabilities: Availability[]; merged: Availability; nextAvailabilityId: number } {
  const startMs = interval.start.getTime()
  const endMs = interval.end.getTime()

  const touching = availabilities.filter(
    (a) =>
      a.tutorId === tutorId &&
      (new Date(a.endTime).getTime() === startMs || new Date(a.startTime).getTime() === endMs),
  )

  let mergedStart = startMs
  let mergedEnd = endMs
  for (const row of touching) {
    mergedStart = Math.min(mergedStart, new Date(row.startTime).getTime())
    mergedEnd = Math.max(mergedEnd, new Date(row.endTime).getTime())
  }

  const touchingIds = new Set(touching.map((a) => a.id))
  const earliestCreatedAt =
    touching.length > 0
      ? [...touching].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0].createdAt
      : stamp

  const merged: Availability = {
    id: nextId,
    tutorId,
    startTime: new Date(mergedStart).toISOString(),
    endTime: new Date(mergedEnd).toISOString(),
    createdAt: earliestCreatedAt || stamp,
    updatedAt: stamp,
  }

  const remaining = availabilities.filter((a) => !touchingIds.has(a.id))
  const updatedList = [...remaining, merged].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )

  return {
    availabilities: updatedList,
    merged,
    nextAvailabilityId: nextId + 1,
  }
}

function parseMinutes(timeStr: string): number {
  if (timeStr === '24:00') return 24 * 60
  const [h, m] = timeStr.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Checks if a 1-hour booking slot starting at `slotStart` fits within the
 * optional [startHour, endHour] daily time window (local time).
 */
export function isSlotInTimeWindow(
  slotStart: Date,
  startHour?: string,
  endHour?: string,
): boolean {
  if (!startHour && !endHour) return true

  const slotMinutes = slotStart.getHours() * 60 + slotStart.getMinutes()
  const slotEndMinutes = slotMinutes + 60

  if (startHour) {
    const startMin = parseMinutes(startHour)
    if (slotMinutes < startMin) return false
  }

  if (endHour) {
    const endMin = parseMinutes(endHour)
    if (slotEndMinutes > endMin) return false
  }

  return true
}
