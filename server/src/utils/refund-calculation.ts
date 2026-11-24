export type RefundPaymentStatus = 'SUCCESS' | 'REFUNDED_PARTIAL' | 'REFUNDED_FULL';

export interface CalculateRefundInput {
  totalPrice: number;
  startTime: Date;
  now: Date;
}

export interface RefundResult {
  refundPercentage: 100 | 50 | 0;
  refundAmount: number;
  paymentStatus: RefundPaymentStatus;
}

const HOUR_MS = 60 * 60 * 1000;
const TIER_100_MS = 72 * HOUR_MS;
const TIER_50_MS = 24 * HOUR_MS;

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function validateRefundInput({ totalPrice, startTime, now }: CalculateRefundInput): number {
  if (!Number.isFinite(totalPrice) || totalPrice < 0) {
    throw new Error('Total price must be a non-negative number.');
  }
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(now.getTime())) {
    throw new Error('Invalid date provided for refund calculation.');
  }

  const remainingMs = startTime.getTime() - now.getTime();
  if (remainingMs <= 0) {
    throw new Error('You can only cancel a booking before the lesson starts.');
  }
  return remainingMs;
}

/**
 * BR-11: Student cancellation 3-tier refund calculation.
 * - >= 72h (inclusive) : 100% refund (REFUNDED_FULL)
 * - 24h <= t < 72h     : 50% refund  (REFUNDED_PARTIAL)
 * - 0 < t < 24h        : 0% refund   (SUCCESS)
 * - t <= 0             : throws error
 */
export function calculateStudentRefund(input: CalculateRefundInput): RefundResult {
  const remainingMs = validateRefundInput(input);
  const { totalPrice } = input;

  if (remainingMs >= TIER_100_MS) {
    return {
      refundPercentage: 100,
      refundAmount: roundCurrency(totalPrice),
      paymentStatus: 'REFUNDED_FULL',
    };
  }

  if (remainingMs >= TIER_50_MS) {
    return {
      refundPercentage: 50,
      refundAmount: roundCurrency(totalPrice * 0.5),
      paymentStatus: 'REFUNDED_PARTIAL',
    };
  }

  return {
    refundPercentage: 0,
    refundAmount: 0,
    paymentStatus: 'SUCCESS',
  };
}

/**
 * BR-12: Tutor cancellation always grants 100% refund to the student
 * as long as the lesson has not started yet.
 */
export function calculateTutorRefund(input: CalculateRefundInput): RefundResult {
  validateRefundInput(input);
  return {
    refundPercentage: 100,
    refundAmount: roundCurrency(input.totalPrice),
    paymentStatus: 'REFUNDED_FULL',
  };
}
