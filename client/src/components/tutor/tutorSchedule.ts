import type { Availability, Booking, CreateAvailabilityRequest } from '../../types/types'
import { HOUR_MS } from '../../utils/bookingRules'
import { dayKey } from '../../utils/format'
import type { TrackSegment } from '../ui/TimeTrack'

/** Form values (local date, hour, :00/:30, whole hours) → the API's ISO interval. */
export function buildAvailabilityRequest(
  date: string,
  hour: number,
  minute: number,
  durationHours: number,
): CreateAvailabilityRequest | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const start = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, minute)
  return {
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + durationHours * HOUR_MS).toISOString(),
  }
}

export interface ScheduleDay {
  key: string
  date: Date
  segments: TrackSegment[]
  availabilities: Availability[]
}

const byStart = <T extends { startTime: string }>(a: T, b: T) => a.startTime.localeCompare(b.startTime)

/** One row per calendar day: open windows and booked lessons on a shared ruler. */
export function groupScheduleByDay(availabilities: Availability[], bookings: Booking[]): ScheduleDay[] {
  const days = new Map<string, ScheduleDay>()
  const dayFor = (iso: string) => {
    const key = dayKey(iso)
    let day = days.get(key)
    if (!day) {
      day = { key, date: new Date(iso), segments: [], availabilities: [] }
      days.set(key, day)
    }
    return day
  }

  for (const a of [...availabilities].sort(byStart)) {
    const day = dayFor(a.startTime)
    day.availabilities.push(a)
    day.segments.push({ start: new Date(a.startTime), end: new Date(a.endTime), kind: 'open' })
  }
  for (const b of bookings.filter((x) => x.status !== 'CANCELLED')) {
    dayFor(b.startTime).segments.push({ start: new Date(b.startTime), end: new Date(b.endTime), kind: 'booked', label: 'Booked' })
  }

  for (const day of days.values()) day.segments.sort((x, y) => x.start.getTime() - y.start.getTime())
  return [...days.values()].sort((x, y) => x.key.localeCompare(y.key))
}
