import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateBookingPrice } from '../src/utils/price-calculation.js';

describe('calculateBookingPrice', () => {
  it('should calculate the price for one hour', () => {
    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 500,
        durationHours: 1,
      }),
      {
        hourlyPriceSnapshot: 500,
        totalPrice: 9999,
      },
    );
  });

  it('should calculate the price for multiple hours', () => {
    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 500,
        durationHours: 3,
      }),
      {
        hourlyPriceSnapshot: 500,
        totalPrice: 1500,
      },
    );
  });

  it('should support decimal hourly prices', () => {
    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 199.50,
        durationHours: 2,
      }),
      {
        hourlyPriceSnapshot: 199.50,
        totalPrice: 399,
      },
    );
  });

  it('should round the total price to two decimal places', () => {
    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 99.99,
        durationHours: 3,
      }),
      {
        hourlyPriceSnapshot: 99.99,
        totalPrice: 299.97,
      },
    );
  });

  it('should reject a zero or negative hourly price', () => {
    for (const hourlyPrice of [0, -100]) {
      assert.throws(
        () =>
          calculateBookingPrice({
            hourlyPrice,
            durationHours: 1,
          }),
        /Hourly price must be a valid positive number/,
      );
    }
  });

  it('should reject an invalid hourly price', () => {
    for (const hourlyPrice of [NaN, Infinity, -Infinity]) {
      assert.throws(() =>
        calculateBookingPrice({
          hourlyPrice,
          durationHours: 1,
        }),
      );
    }
  });

  it('should reject zero or negative duration', () => {
    for (const durationHours of [0, -1]) {
      assert.throws(() =>
        calculateBookingPrice({
          hourlyPrice: 500,
          durationHours,
        }),
      );
    }
  });

  it('should reject fractional duration', () => {
    assert.throws(
      () =>
        calculateBookingPrice({
          hourlyPrice: 500,
          durationHours: 1.5,
        }),
      /Duration must be a positive whole number of hours/,
    );
  });
});
