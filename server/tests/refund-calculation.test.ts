import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateStudentRefund,
  calculateTutorRefund,
} from '../src/utils/refund-calculation.js';

const HOUR_MS = 60 * 60 * 1000;
const SEC_MS = 1000;
const NOW = new Date('2026-11-24T10:00:00.000Z');

describe('calculateStudentRefund (BR-11, STS-10.1)', () => {
  it('grants 100% refund (REFUNDED_FULL) when cancelled >= 72 hours before lesson start (including exact 72h boundary)', () => {
    const exact72h = new Date(NOW.getTime() + 72 * HOUR_MS);
    const over72h = new Date(NOW.getTime() + 96 * HOUR_MS);

    assert.deepEqual(
      calculateStudentRefund({ totalPrice: 750, startTime: exact72h, now: NOW }),
      {
        refundPercentage: 100,
        refundAmount: 750,
        paymentStatus: 'REFUNDED_FULL',
      },
    );

    assert.deepEqual(
      calculateStudentRefund({ totalPrice: 750, startTime: over72h, now: NOW }),
      {
        refundPercentage: 100,
        refundAmount: 750,
        paymentStatus: 'REFUNDED_FULL',
      },
    );
  });

  it('grants 50% refund (REFUNDED_PARTIAL) when cancelled between 24h (inclusive) and < 72h before lesson start', () => {
    const justUnder72h = new Date(NOW.getTime() + 72 * HOUR_MS - SEC_MS);
    const exact24h = new Date(NOW.getTime() + 24 * HOUR_MS);

    assert.deepEqual(
      calculateStudentRefund({ totalPrice: 750, startTime: justUnder72h, now: NOW }),
      {
        refundPercentage: 50,
        refundAmount: 375,
        paymentStatus: 'REFUNDED_PARTIAL',
      },
    );

    assert.deepEqual(
      calculateStudentRefund({ totalPrice: 750, startTime: exact24h, now: NOW }),
      {
        refundPercentage: 50,
        refundAmount: 375,
        paymentStatus: 'REFUNDED_PARTIAL',
      },
    );
  });

  it('grants 0% refund (SUCCESS) when cancelled < 24 hours before lesson start', () => {
    const justUnder24h = new Date(NOW.getTime() + 24 * HOUR_MS - SEC_MS);
    const oneHourBefore = new Date(NOW.getTime() + 1 * HOUR_MS);

    assert.deepEqual(
      calculateStudentRefund({ totalPrice: 750, startTime: justUnder24h, now: NOW }),
      {
        refundPercentage: 0,
        refundAmount: 0,
        paymentStatus: 'SUCCESS',
      },
    );

    assert.deepEqual(
      calculateStudentRefund({ totalPrice: 750, startTime: oneHourBefore, now: NOW }),
      {
        refundPercentage: 0,
        refundAmount: 0,
        paymentStatus: 'SUCCESS',
      },
    );
  });

  it('rounds 50% refund cleanly to two decimal places', () => {
    const at36h = new Date(NOW.getTime() + 36 * HOUR_MS);
    assert.deepEqual(
      calculateStudentRefund({ totalPrice: 399.99, startTime: at36h, now: NOW }),
      {
        refundPercentage: 50,
        refundAmount: 200,
        paymentStatus: 'REFUNDED_PARTIAL',
      },
    );
  });

  it('rejects cancellation at or after lesson start time', () => {
    const atStart = new Date(NOW.getTime());
    const pastStart = new Date(NOW.getTime() - 60 * SEC_MS);

    assert.throws(
      () => calculateStudentRefund({ totalPrice: 750, startTime: atStart, now: NOW }),
      /only cancel a booking before the lesson starts/i,
    );
    assert.throws(
      () => calculateStudentRefund({ totalPrice: 750, startTime: pastStart, now: NOW }),
      /only cancel a booking before the lesson starts/i,
    );
  });
});

describe('calculateTutorRefund (BR-12, STS-11.1)', () => {
  it('always grants 100% refund regardless of hours remaining when lesson is in the future', () => {
    const twoHoursBefore = new Date(NOW.getTime() + 2 * HOUR_MS);
    assert.deepEqual(
      calculateTutorRefund({ totalPrice: 800, startTime: twoHoursBefore, now: NOW }),
      {
        refundPercentage: 100,
        refundAmount: 800,
        paymentStatus: 'REFUNDED_FULL',
      },
    );
  });

  it('rejects tutor cancellation at or after lesson start time', () => {
    assert.throws(
      () => calculateTutorRefund({ totalPrice: 800, startTime: NOW, now: NOW }),
      /only cancel a booking before the lesson starts/i,
    );
  });
});
