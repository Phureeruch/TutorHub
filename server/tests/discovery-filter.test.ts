import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateDiscoveryTimeWindow,
  isSlotInBangkokTimeWindow,
} from '../src/utils/discovery-time.js';

describe('validateDiscoveryTimeWindow (AC-09.4, STS-09.4)', () => {
  it('accepts valid time window with both startHour and endHour', () => {
    const result = validateDiscoveryTimeWindow('09:00', '12:00');
    assert.deepEqual(result, { valid: true });
  });

  it('accepts half-hour aligned times', () => {
    const result = validateDiscoveryTimeWindow('13:30', '15:30');
    assert.deepEqual(result, { valid: true });
  });

  it('accepts startHour only or endHour only', () => {
    assert.deepEqual(validateDiscoveryTimeWindow('14:00', undefined), { valid: true });
    assert.deepEqual(validateDiscoveryTimeWindow(undefined, '18:00'), { valid: true });
    assert.deepEqual(validateDiscoveryTimeWindow(undefined, undefined), { valid: true });
  });

  it('rejects malformed time format not on :00 or :30 grid', () => {
    const result = validateDiscoveryTimeWindow('09:15', '12:00');
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.reason, 'Invalid discovery filters.');
    }
  });

  it('rejects reversed time window (endHour <= startHour)', () => {
    const result = validateDiscoveryTimeWindow('15:00', '14:00');
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.reason, 'End time must be at least 1 hour after start time.');
    }
  });

  it('rejects time window span less than 1 hour (e.g. 30 minutes)', () => {
    const result = validateDiscoveryTimeWindow('10:00', '10:30');
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.equal(result.reason, 'End time must be at least 1 hour after start time.');
    }
  });
});

describe('isSlotInBangkokTimeWindow (AC-09.1, STS-09.1)', () => {
  // 2026-11-26 09:00:00 Bangkok (UTC+7) = 2026-11-26 02:00:00 UTC
  const slotStartUtc = new Date('2026-11-26T02:00:00.000Z');
  const slotEndUtc = new Date('2026-11-26T03:00:00.000Z'); // 10:00 Bangkok

  it('matches when slot falls completely within the requested Bangkok time window', () => {
    // 09:00 to 12:00 Bangkok
    const matches = isSlotInBangkokTimeWindow(slotStartUtc, slotEndUtc, '09:00', '12:00');
    assert.equal(matches, true);
  });

  it('matches when slot starts exactly at startHour and ends exactly at endHour (1-hour window)', () => {
    const matches = isSlotInBangkokTimeWindow(slotStartUtc, slotEndUtc, '09:00', '10:00');
    assert.equal(matches, true);
  });

  it('rejects slot that starts before requested startHour', () => {
    // Requested 10:00 to 14:00, but slot is 09:00 to 10:00
    const matches = isSlotInBangkokTimeWindow(slotStartUtc, slotEndUtc, '10:00', '14:00');
    assert.equal(matches, false);
  });

  it('rejects slot that ends after requested endHour', () => {
    // Requested 08:00 to 09:30, but slot ends at 10:00
    const matches = isSlotInBangkokTimeWindow(slotStartUtc, slotEndUtc, '08:00', '09:30');
    assert.equal(matches, false);
  });
});
