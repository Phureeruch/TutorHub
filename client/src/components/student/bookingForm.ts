import type { Availability, Booking, User } from '../../types/types'
import { calculateTotalPrice, HOUR_MS } from '../../utils/bookingRules'
import type { TrackSegment } from '../ui/TimeTrack'

/** Ruler preview: the chosen lesson inside the window and what stays bookable around it. */
export function bookingSegments(availability: Availability, start: Date | null, durationHours: number): TrackSegment[] {
  const windowStart = new Date(availability.startTime)
  const windowEnd = new Date(availability.endTime)
  if (!start) return [{ start: windowStart, end: windowEnd, kind: 'open' }]

  const end = new Date(start.getTime() + durationHours * HOUR_MS)
  const segments: TrackSegment[] = []
  if (windowStart < start) segments.push({ start: windowStart, end: start, kind: 'open' })
  segments.push({ start, end, kind: 'selected', label: 'Your lesson' })
  if (end < windowEnd) segments.push({ start: end, end: windowEnd, kind: 'open' })
  return segments
}

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

export function priceSummary(hourly: number, hours: number) {
  return { hourly, hours, total: calculateTotalPrice(hourly, hours) }
}

/** BR-02: why this user cannot book yet, or null if they can. */
export function bookingBlockReason(user: User): string | null {
  if (user.role !== 'STUDENT') return 'Only students can book lessons.'
  if (!user.isEmailVerified) return 'Verify your email before you book a lesson.'
  return null
}
