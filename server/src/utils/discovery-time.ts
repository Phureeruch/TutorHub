const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface TimeWindowValidationResult {
  valid: boolean;
  reason?: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):(00|30)$/;

function parseMinutes(timeStr: string): number {
  if (timeStr === '24:00') return 24 * 60;
  const [h, m] = timeStr.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function validateDiscoveryTimeWindow(
  startHour?: string,
  endHour?: string,
): TimeWindowValidationResult {
  if (startHour !== undefined) {
    if (!TIME_REGEX.test(startHour)) {
      return { valid: false, reason: 'Invalid discovery filters.' };
    }
  }

  if (endHour !== undefined) {
    if (endHour !== '24:00' && !TIME_REGEX.test(endHour)) {
      return { valid: false, reason: 'Invalid discovery filters.' };
    }
  }

  if (startHour !== undefined && endHour !== undefined) {
    const startMin = parseMinutes(startHour);
    const endMin = parseMinutes(endHour);

    if (endMin <= startMin || endMin - startMin < 60) {
      return {
        valid: false,
        reason: 'End time must be at least 1 hour after start time.',
      };
    }
  }

  return { valid: true };
}

export function isSlotInBangkokTimeWindow(
  slotStart: Date,
  _slotEnd: Date,
  startHour?: string,
  endHour?: string,
): boolean {
  if (startHour === undefined && endHour === undefined) {
    return true;
  }

  const startBangkokMs = slotStart.getTime() + BANGKOK_OFFSET_MS;
  const bangkokDate = new Date(startBangkokMs);
  const slotStartMin = bangkokDate.getUTCHours() * 60 + bangkokDate.getUTCMinutes();
  const slotEndMin = slotStartMin + 60;

  if (startHour !== undefined) {
    const reqStartMin = parseMinutes(startHour);
    if (slotStartMin < reqStartMin) {
      return false;
    }
  }

  if (endHour !== undefined) {
    const reqEndMin = parseMinutes(endHour);
    if (slotEndMin > reqEndMin) {
      return false;
    }
  }

  return true;
}
