const HOUR_MS = 60 * 60 * 1000;

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

  if (startTime.getTime() <= now.getTime()) {
    return {
      valid: false,
      reason: 'Availability must start in the future.',
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

  if (startTime <= now) {
    return { valid: false, reason: 'Booking must start in the future' };
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
