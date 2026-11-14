import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateBookingTime } from '../src/utils/time.validation.js';

const now = new Date('2026-11-10T08:00:00.000Z');

const availabilityStartTime = new Date('2026-11-10T09:00:00.000Z');
const availabilityEndTime = new Date('2026-11-10T14:00:00.000Z');

function validate(
  startTime: string,
  endTime: string,
) {
  return validateBookingTime({
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    availabilityStartTime,
    availabilityEndTime,
    now,
  });
}

describe('validateBookingTime', () => {
  it('should accept a valid booking time', () => {
    assert.deepEqual(
      validate(
        '2026-11-10T10:00:00.000Z',
        '2026-11-10T12:00:00.000Z',
      ),
      { valid: true },
    );
  });

  it('should reject a booking that starts in the past', () => {
    const result = validate(
      '2026-11-10T07:00:00.000Z',
      '2026-11-10T09:00:00.000Z',
    );

    assert.equal(result.valid, false);
  });

  it('should reject a booking that starts at the current time', () => {
    const result = validate(
      '2026-11-10T08:00:00.000Z',
      '2026-11-10T10:00:00.000Z',
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
    );

    assert.equal(result.valid, false);
  });

  it('should reject a booking that ends after availability', () => {
    const result = validate(
      '2026-11-10T13:00:00.000Z',
      '2026-11-10T15:00:00.000Z',
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

  it('should accept a booking that starts at availability start', () => {
    assert.deepEqual(
      validate(
        '2026-11-10T09:00:00.000Z',
        '2026-11-10T11:00:00.000Z',
      ),
      { valid: true },
    );
  });

  it('should accept a booking that ends exactly at availability end', () => {
    assert.deepEqual(
      validate(
        '2026-11-10T12:00:00.000Z',
        '2026-11-10T14:00:00.000Z',
      ),
      { valid: true },
    );
  });
});