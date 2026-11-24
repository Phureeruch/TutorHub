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

export function calculateStudentRefund(_input: CalculateRefundInput): RefundResult {
  throw new Error('Not implemented: calculateStudentRefund');
}

export function calculateTutorRefund(_input: CalculateRefundInput): RefundResult {
  throw new Error('Not implemented: calculateTutorRefund');
}
