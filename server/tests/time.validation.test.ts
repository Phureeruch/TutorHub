import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  validateAvailabilityWindow,
  validateBookingTime,
} from '../src/utils/time.validation.js';

const now = new Date('2026-11-10T07:00:00.000Z');

const availabilityStartTime = new Date('2026-11-10T09:00:00.000Z');
const availabilityEndTime = new Date('2026-11-10T15:00:00.000Z');

function validate(
  startTime: string,
  endTime: string,
  customNow: Date = now,
) {
  return validateBookingTime({
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    availabilityStartTime,
    availabilityEndTime,
    now: customNow,
  });
}

describe('validateBookingTime (BR-05, CHG-03B, STS-L7-03, STS-L7-04)', () => {
  it('should accept a valid booking time at least 2 hours in advance', () => {
    assert.deepEqual(
      validate(
        '2026-11-10T10:00:00.000Z',
        '2026-11-10T12:00:00.000Z',
      ),
      { valid: true },
    );
  });

  it('should accept a booking at the exact 2-hour (120m) advance cutoff boundary (STS-L7-03)', () => {
    assert.deepEqual(
      validate(
        '2026-11-10T09:00:00.000Z',
        '2026-11-10T11:00:00.000Z',
        new Date('2026-11-10T07:00:00.000Z'),
      ),
      { valid: true },
    );
  });

  it('should reject a booking less than 2 hours (e.g. 119m or 60m) before lesson start (STS-L7-03)', () => {
    const result119m = validate(
      '2026-11-10T09:00:00.000Z',
      '2026-11-10T10:00:00.000Z',
      new Date('2026-11-10T07:01:00.000Z'),
    );
    assert.deepEqual(result119m, {
      valid: false,
      reason: 'Bookings must be made at least 2 hours before the lesson starts.',
    });

    const result60m = validate(
      '2026-11-10T09:00:00.000Z',
      '2026-11-10T10:00:00.000Z',
      new Date('2026-11-10T08:00:00.000Z'),
    );
    assert.deepEqual(result60m, {
      valid: false,
      reason: 'Bookings must be made at least 2 hours before the lesson starts.',
    });
  });

  it('should accept a 4-hour booking and reject a 5-hour booking (STS-L7-04)', () => {
    assert.deepEqual(
      validate(
        '2026-11-10T09:00:00.000Z',
        '2026-11-10T13:00:00.000Z',
      ),
      { valid: true },
    );

    const overMax = validate(
      '2026-11-10T09:00:00.000Z',
      '2026-11-10T14:00:00.000Z',
    );
    assert.deepEqual(overMax, {
      valid: false,
      reason: 'A single booking cannot exceed 4 hours.',
    });
  });

  it('should reject a booking that starts in the past', () => {
    const result = validate(
      '2026-11-10T06:00:00.000Z',
      '2026-11-10T08:00:00.000Z',
    );

    assert.equal(result.valid, false);
  });

  it('should reject a booking that starts at the current time', () => {
    const result = validate(
      '2026-11-10T07:00:00.000Z',
      '2026-11-10T09:00:00.000Z',
    );

    assert.equal(result.valid, false);
  });

  it('should reject a start time that is not :00 or :30', () => {
    const result = validate(
      '2026-11-10T10:15:00.000Z',
      '2026-11-10T12:15:00.000Z',
    );

    assert.equal(result.valid, false);
  });

  it('should reject a duration that is not a whole number of hours', () => {
    const result = validate(
      '2026-11-10T10:00:00.000Z',
      '2026-11-10T11:30:00.000Z',
    );

    assert.equal(result.valid, false);
  });

  it('should reject a booking that starts before availability', () => {
    const result = validate(
      '2026-11-10T08:00:00.000Z',
      '2026-11-10T10:00:00.000Z',
      new Date('2026-11-10T05:00:00.000Z'),
    );

    assert.equal(result.valid, false);
  });

  it('should reject a booking that ends after availability', () => {
    const result = validate(
      '2026-11-10T14:00:00.000Z',
      '2026-11-10T16:00:00.000Z',
    );

    assert.equal(result.valid, false);
  });

  it('should reject a start time that is not aligned with availability start', () => {
    const result = validate(
      '2026-11-10T09:30:00.000Z',
      '2026-11-10T11:30:00.000Z',
    );

    assert.equal(result.valid, false);
  });

  it('should accept a booking that ends exactly at availability end', () => {
    assert.deepEqual(
      validate(
        '2026-11-10T13:00:00.000Z',
        '2026-11-10T15:00:00.000Z',
      ),
      { valid: true },
    );
  });
});

describe('validateAvailabilityWindow (BR-04, CHG-03C, STS-L7-05, STS-L7-06)', () => {
  it('accepts an availability window starting at the exact 1-hour (60m) advance notice boundary (STS-L7-05)', () => {
    const result = validateAvailabilityWindow(
      new Date('2026-11-10T09:00:00.000Z'),
      new Date('2026-11-10T11:00:00.000Z'),
      new Date('2026-11-10T08:00:00.000Z'),
    );
    assert.deepEqual(result, { valid: true });
  });

  it('rejects an availability window starting less than 1 hour (e.g. 59m or 30m) in the future (STS-L7-05)', () => {
    const result59m = validateAvailabilityWindow(
      new Date('2026-11-10T09:00:00.000Z'),
      new Date('2026-11-10T11:00:00.000Z'),
      new Date('2026-11-10T08:01:00.000Z'),
    );
    assert.deepEqual(result59m, {
      valid: false,
      reason: 'Availability must start at least 1 hour in the future.',
    });

    const result30m = validateAvailabilityWindow(
      new Date('2026-11-10T09:00:00.000Z'),
      new Date('2026-11-10T11:00:00.000Z'),
      new Date('2026-11-10T08:30:00.000Z'),
    );
    assert.deepEqual(result30m, {
      valid: false,
      reason: 'Availability must start at least 1 hour in the future.',
    });
  });

  it('accepts an 8-hour availability window and rejects a 9-hour window (STS-L7-06)', () => {
    const ok8h = validateAvailabilityWindow(
      new Date('2026-11-10T09:00:00.000Z'),
      new Date('2026-11-10T17:00:00.000Z'),
      new Date('2026-11-10T07:00:00.000Z'),
    );
    assert.deepEqual(ok8h, { valid: true });

    const bad9h = validateAvailabilityWindow(
      new Date('2026-11-10T09:00:00.000Z'),
      new Date('2026-11-10T18:00:00.000Z'),
      new Date('2026-11-10T07:00:00.000Z'),
    );
    assert.deepEqual(bad9h, {
      valid: false,
      reason: 'Daily tutor availability and booked lessons cannot exceed 8 hours per day.',
    });
  });
});
