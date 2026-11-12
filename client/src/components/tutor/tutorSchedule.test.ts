import { describe, expect, it } from 'vitest'
import type { Availability, Booking } from '../../types/types'
import { buildAvailabilityRequest, groupScheduleByDay } from './tutorSchedule'

const at = (day: number, hh: number, mm = 0) => new Date(2026, 10, day, hh, mm).toISOString()

describe('buildAvailabilityRequest (BR-04 form)', () => {
  it('turns date, :30 start and hours into a local start/end pair', () => {
    expect(buildAvailabilityRequest('2026-11-20', 9, 30, 3)).toEqual({
      startTime: at(20, 9, 30),
      endTime: at(20, 12, 30),
    })
  })

  it('rolls past midnight correctly', () => {
    expect(buildAvailabilityRequest('2026-11-20', 22, 0, 3)?.endTime).toBe(at(21, 1))
  })

  it('returns null for an empty date', () => {
    expect(buildAvailabilityRequest('', 9, 0, 1)).toBeNull()
  })
})

describe('groupScheduleByDay', () => {
  const availability = (id: number, start: string, end: string): Availability => ({
    id,
    tutorId: 1,
    startTime: start,
    endTime: end,
    createdAt: '',
    updatedAt: '',
  })
  const booking = (id: number, start: string, end: string): Booking => ({
    id,
    studentId: 3,
    tutorId: 1,
    subjectId: 1,
    startTime: start,
    endTime: end,
    durationHours: 1,
    hourlyPriceSnapshot: 40,
    totalPrice: 40,
    notes: null,
    lessonSummary: null,
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    cancelledBy: null,
    cancelledAt: null,
    refundPercentage: null,
    refundAmount: null,
    createdAt: '',
    updatedAt: '',
  })

  const days = groupScheduleByDay(
    [availability(2, at(21, 9), at(21, 10)), availability(1, at(20, 13), at(20, 14)), availability(3, at(20, 15), at(20, 17))],
    [booking(1, at(20, 14), at(20, 15))],
  )

  it('groups by local calendar day in date order', () => {
    expect(days.map((d) => d.key)).toEqual(['2026-11-20', '2026-11-21'])
  })

  it('merges open and booked time into one time-ordered segment list per day', () => {
    expect(days[0].segments.map((s) => s.kind)).toEqual(['open', 'booked', 'open'])
  })

  it('keeps the availability rows for the day so they can be removed', () => {
    expect(days[0].availabilities.map((a) => a.id)).toEqual([1, 3])
  })

  it('ignores cancelled bookings', () => {
    const cancelled = { ...booking(9, at(22, 9), at(22, 10)), status: 'CANCELLED' as const }
    expect(groupScheduleByDay([], [cancelled])).toEqual([])
  })
})
