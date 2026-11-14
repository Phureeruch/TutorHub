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
    startTime.getMinutes() !== 0 &&
    startTime.getMinutes() !== 30
  ) {
    return { valid: false, reason: 'Start time must be at :00 or :30' };
  }

  if (
    startTime.getSeconds() !== 0 ||
    startTime.getMilliseconds() !== 0
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