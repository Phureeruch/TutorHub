import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeAdjacentIntervals } from '../src/utils/interval-merge.js';

const slot = (startHour: number, endHour: number, minute = 0) => ({
  startTime: new Date(Date.UTC(2026, 10, 28, startHour, minute, 0, 0)),
  endTime: new Date(Date.UTC(2026, 10, 28, endHour, minute, 0, 0)),
});

describe('mergeAdjacentIntervals (BR-13, STS-12.1)', () => {
  it('merges a released slot with an adjacent left block', () => {
    const merged = mergeAdjacentIntervals([slot(9, 10), slot(10, 11)]);
    assert.deepEqual(merged, [slot(9, 11)]);
  });

  it('merges a released slot with an adjacent right block', () => {
    const merged = mergeAdjacentIntervals([slot(10, 11), slot(11, 13)]);
    assert.deepEqual(merged, [slot(10, 13)]);
  });

  it('merges a released middle slot bridging both left and right blocks into one continuous block', () => {
    const merged = mergeAdjacentIntervals([
      slot(11, 12),
      slot(9, 10),
      slot(10, 11),
    ]);
    assert.deepEqual(merged, [slot(9, 12)]);
  });

  it('preserves non-adjacent intervals with a gap between them', () => {
    const merged = mergeAdjacentIntervals([
      slot(14, 16),
      slot(9, 10),
      slot(10, 11),
    ]);
    assert.deepEqual(merged, [slot(9, 11), slot(14, 16)]);
  });

  it('supports :30-aligned whole-hour intervals', () => {
    const merged = mergeAdjacentIntervals([
      slot(9, 10, 30),
      slot(11, 12, 30),
      slot(10, 11, 30),
    ]);
    assert.deepEqual(merged, [slot(9, 12, 30)]);
  });

  it('returns an empty array when given no intervals', () => {
    assert.deepEqual(mergeAdjacentIntervals([]), []);
  });
});
