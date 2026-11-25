import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRetainedRevenue } from '../src/utils/admin-metrics.js';

describe('calculateRetainedRevenue (DEF-08, F-15, AC-15.3, STS-15.3)', () => {
  it('returns 0 for empty bookings array', () => {
    assert.equal(calculateRetainedRevenue([]), 0);
  });

  it('sums full price for confirmed and completed bookings', () => {
    const bookings = [
      { status: 'CONFIRMED', totalPrice: 400 },
      { status: 'COMPLETED', totalPrice: 350 },
    ];
    assert.equal(calculateRetainedRevenue(bookings), 750);
  });

  it('excludes full price when cancelled with 100% refund (refundAmount = totalPrice)', () => {
    const bookings = [
      { status: 'CANCELLED', totalPrice: 400, refundAmount: 400 },
    ];
    assert.equal(calculateRetainedRevenue(bookings), 0);
  });

  it('retains 50% revenue when cancelled with 50% refund', () => {
    const bookings = [
      { status: 'CANCELLED', totalPrice: 400, refundAmount: 200 },
    ];
    assert.equal(calculateRetainedRevenue(bookings), 200);
  });

  it('retains 100% revenue when cancelled with 0% refund (refundAmount = 0)', () => {
    const bookings = [
      { status: 'CANCELLED', totalPrice: 400, refundAmount: 0 },
    ];
    assert.equal(calculateRetainedRevenue(bookings), 400);
  });

  it('handles null or missing refundAmount on cancelled booking gracefully', () => {
    const bookings = [
      { status: 'CANCELLED', totalPrice: 400, refundAmount: null },
      { status: 'CANCELLED', totalPrice: 500 },
    ];
    assert.equal(calculateRetainedRevenue(bookings), 0);
  });

  it('satisfies STS-15.3: 4 bookings (400 confirmed, 400 @ 50% refund, 400 @ 0% refund, 400 @ 100% refund) yields 1000 THB', () => {
    const bookings = [
      { status: 'CONFIRMED', totalPrice: 400 },
      { status: 'CANCELLED', totalPrice: 400, refundAmount: 200 },
      { status: 'CANCELLED', totalPrice: 400, refundAmount: 0 },
      { status: 'CANCELLED', totalPrice: 400, refundAmount: 400 },
    ];
    assert.equal(calculateRetainedRevenue(bookings), 1000);
  });

  it('supports decimal strings or Prisma.Decimal-like values and rounds cleanly', () => {
    const bookings = [
      { status: 'CONFIRMED', totalPrice: '350.50' },
      { status: 'CANCELLED', totalPrice: '450.75', refundAmount: '225.375' },
    ];
    assert.equal(calculateRetainedRevenue(bookings), 575.88);
  });
});
