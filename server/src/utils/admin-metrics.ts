export interface BookingRevenueInput {
  status: string;
  totalPrice: number | string | { toString(): string };
  refundAmount?: number | string | { toString(): string } | null;
}

/**
 * Calculates total retained school revenue across all bookings (DEF-08, F-15, AC-15.3).
 *
 * Confirmed and completed bookings contribute their full totalPrice.
 * Cancelled bookings contribute their net retained portion: max(0, totalPrice - refundAmount).
 * If refundAmount is omitted or null on a cancelled booking, it is treated as a full refund (0 retained).
 */
export function calculateRetainedRevenue(bookings: BookingRevenueInput[]): number {
  const sum = bookings.reduce((acc, b) => {
    const total = Number(b.totalPrice);
    if (b.status !== 'CANCELLED') {
      return acc + total;
    }
    const refund = b.refundAmount !== undefined && b.refundAmount !== null ? Number(b.refundAmount) : total;
    const retained = Math.max(0, total - refund);
    return acc + retained;
  }, 0);

  return Math.round((sum + Number.EPSILON) * 100) / 100;
}
