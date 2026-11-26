import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateBookingPrice } from '../src/utils/price-calculation.js';

describe('calculateBookingPrice (BR-09, CHG-03A, STS-L7-01)', () => {
  it('should calculate 0% discount for 1 hour (STS-L7-01)', () => {
    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 400,
        durationHours: 1,
      }),
      {
        hourlyPriceSnapshot: 400,
        basePrice: 400,
        discountPercentage: 0,
        discountAmount: 0,
        totalPrice: 400,
      },
    );
  });

  it('should apply 5% bundle discount for 2 hours (STS-L7-01)', () => {
    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 400,
        durationHours: 2,
      }),
      {
        hourlyPriceSnapshot: 400,
        basePrice: 800,
        discountPercentage: 5,
        discountAmount: 40,
        totalPrice: 760,
      },
    );
  });

  it('should apply 10% bundle discount for 3 hours and 4 hours (STS-L7-01)', () => {
    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 400,
        durationHours: 3,
      }),
      {
        hourlyPriceSnapshot: 400,
        basePrice: 1200,
        discountPercentage: 10,
        discountAmount: 120,
        totalPrice: 1080,
      },
    );

    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 400,
        durationHours: 4,
      }),
      {
        hourlyPriceSnapshot: 400,
        basePrice: 1600,
        discountPercentage: 10,
        discountAmount: 160,
        totalPrice: 1440,
      },
    );
  });

  it('should support decimal hourly prices and round to 2 decimal places (STS-L7-01)', () => {
    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 333,
        durationHours: 2,
      }),
      {
        hourlyPriceSnapshot: 333,
        basePrice: 666,
        discountPercentage: 5,
        discountAmount: 33.3,
        totalPrice: 632.7,
      },
    );

    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 333,
        durationHours: 3,
      }),
      {
        hourlyPriceSnapshot: 333,
        basePrice: 999,
        discountPercentage: 10,
        discountAmount: 99.9,
        totalPrice: 899.1,
      },
    );

    assert.deepEqual(
      calculateBookingPrice({
        hourlyPrice: 99.99,
        durationHours: 3,
      }),
      {
        hourlyPriceSnapshot: 99.99,
        basePrice: 299.97,
        discountPercentage: 10,
        discountAmount: 30,
        totalPrice: 269.97,
      },
    );
  });

  it('should reject a booking duration exceeding 4 hours (CHG-03B, STS-L7-01)', () => {
    for (const durationHours of [5, 6, 8]) {
      assert.throws(
        () =>
          calculateBookingPrice({
            hourlyPrice: 400,
            durationHours,
          }),
        /A single booking cannot exceed 4 hours/,
      );
    }
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
