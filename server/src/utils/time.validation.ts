export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const BANGKOK_OFFSET_MS = 7 * HOUR_MS;
export const MIN_AVAILABILITY_LEAD_MS = 1 * HOUR_MS;
export const MAX_DAILY_TUTOR_HOURS = 8;
export const MIN_BOOKING_LEAD_MS = 2 * HOUR_MS;
export const MAX_BOOKING_DURATION_HOURS = 4;

interface ValidateBookingTimeInput {
  startTime: Date;
  endTime: Date;
  availabilityStartTime: Date;
  availabilityEndTime: Date;
  now: Date;
}

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Returns the UTC start and end bounds `[dayStartUtc, dayEndUtc)` of every
 * Asia/Bangkok (UTC+7) local calendar day overlapped by `[startTime, endTime)`.
 */
export function getOverlappedBangkokDaysUtc(
  startTime: Date,
  endTime: Date,
): { dayStartUtc: Date; dayEndUtc: Date }[] {
  const startBkkMs = startTime.getTime() + BANGKOK_OFFSET_MS;
  const endBkkMs = Math.max(startBkkMs, endTime.getTime() + BANGKOK_OFFSET_MS - 1);

  const firstDayFloorBkk = Math.floor(startBkkMs / DAY_MS) * DAY_MS;
  const lastDayFloorBkk = Math.floor(endBkkMs / DAY_MS) * DAY_MS;

  const days: { dayStartUtc: Date; dayEndUtc: Date }[] = [];
  for (let dayBkk = firstDayFloorBkk; dayBkk <= lastDayFloorBkk; dayBkk += DAY_MS) {
    const dayStartUtcMs = dayBkk - BANGKOK_OFFSET_MS;
    days.push({
      dayStartUtc: new Date(dayStartUtcMs),
      dayEndUtc: new Date(dayStartUtcMs + DAY_MS),
    });
  }
  return days;
}

export function computeOverlapMs(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

export function validateAvailabilityWindow(
  startTime: Date,
  endTime: Date,
  now: Date,
): ValidationResult {
  if (
    Number.isNaN(startTime.getTime()) ||
    Number.isNaN(endTime.getTime()) ||
    Number.isNaN(now.getTime())
  ) {
    return { valid: false, reason: 'Invalid availability time.' };
  }

  const minutes = startTime.getUTCMinutes();
  if (
    (minutes !== 0 && minutes !== 30) ||
    startTime.getUTCSeconds() !== 0 ||
    startTime.getUTCMilliseconds() !== 0
  ) {
    return {
      valid: false,
      reason: 'Availability must start on :00 or :30.',
    };
  }

  const duration = endTime.getTime() - startTime.getTime();
  if (duration < HOUR_MS) {
    return {
      valid: false,
      reason: 'Availability must be at least 1 hour long.',
    };
  }

  if (duration % HOUR_MS !== 0) {
    return {
      valid: false,
      reason: 'Availability must last a whole number of hours.',
    };
  }

  if (duration > MAX_DAILY_TUTOR_HOURS * HOUR_MS) {
    return {
      valid: false,
      reason: 'Daily tutor availability and booked lessons cannot exceed 8 hours per day.',
    };
  }

  if (startTime.getTime() - now.getTime() < MIN_AVAILABILITY_LEAD_MS) {
    return {
      valid: false,
      reason: 'Availability must start at least 1 hour in the future.',
    };
  }

  return { valid: true };
}

export function validateBookingTime(
  input: ValidateBookingTimeInput,
): ValidationResult {
  const {
    startTime,
    endTime,
    availabilityStartTime,
    availabilityEndTime,
    now,
  } = input;

  const dates = [
    startTime,
    endTime,
    availabilityStartTime,
    availabilityEndTime,
    now,
  ];

  if (dates.some((date) => Number.isNaN(date.getTime()))) {
    return { valid: false, reason: 'Invalid date' };
  }

  if (startTime.getTime() - now.getTime() < MIN_BOOKING_LEAD_MS) {
    return {
      valid: false,
      reason: 'Bookings must be made at least 2 hours before the lesson starts.',
    };
  }

  if (
    startTime.getUTCMinutes() !== 0 &&
    startTime.getUTCMinutes() !== 30
  ) {
    return { valid: false, reason: 'Start time must be at :00 or :30' };
  }

  if (
    startTime.getUTCSeconds() !== 0 ||
    startTime.getUTCMilliseconds() !== 0
  ) {
    return { valid: false, reason: 'Start time must have zero seconds' };
  }

  if (endTime <= startTime) {
    return { valid: false, reason: 'End time must be after start time' };
  }

  const duration = endTime.getTime() - startTime.getTime();

  if (duration % HOUR_MS !== 0) {
    return { valid: false, reason: 'Duration must be whole hours' };
  }

  if (duration > MAX_BOOKING_DURATION_HOURS * HOUR_MS) {
    return {
      valid: false,
      reason: 'A single booking cannot exceed 4 hours.',
    };
  }

  if (startTime < availabilityStartTime) {
    return { valid: false, reason: 'Start time is before availability' };
  }

  if (endTime > availabilityEndTime) {
    return { valid: false, reason: 'End time exceeds availability' };
  }

  const offset =
    startTime.getTime() - availabilityStartTime.getTime();

  if (offset % HOUR_MS !== 0) {
    return {
      valid: false,
      reason: 'Start time must align with availability start',
    };
  }

  return { valid: true };
}
