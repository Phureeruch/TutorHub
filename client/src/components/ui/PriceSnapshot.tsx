import type { Booking } from '../../types/types'
import { formatHours, formatMoney, formatRate } from '../../utils/format'

/**
 * BR-09: shows the price frozen at confirmation. When the tutor's live rate has
 * since moved, says so, which is the clearest proof the snapshot held.
 */
export function PriceSnapshot({ booking, currentRate }: { booking: Booking; currentRate: number | null }) {
  const moved = currentRate !== null && currentRate !== booking.hourlyPriceSnapshot
  return (
    <div className="th-snapshot">
      <strong className="th-snapshot-total">{formatMoney(booking.totalPrice)}</strong>
      <span className="th-snapshot-calc">
        {formatRate(booking.hourlyPriceSnapshot)} × {formatHours(booking.durationHours)}
      </span>
      {moved && <span className="th-snapshot-note">Locked in. Rate is now {formatRate(currentRate)}.</span>}
    </div>
  )
}

const PAYMENT_TEXT: Record<Booking['paymentStatus'], string> = {
  SUCCESS: 'Payment successful',
  REFUNDED_PARTIAL: 'Partly refunded',
  REFUNDED_FULL: 'Refunded',
}

const STATUS_TEXT: Record<Booking['status'], string> = {
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}

export function BookingStatusTags({ booking }: { booking: Booking }) {
  return (
    <span className="d-inline-flex flex-wrap gap-1">
      <span className="th-tag th-tag-success">{STATUS_TEXT[booking.status]}</span>
      <span className="th-tag">{PAYMENT_TEXT[booking.paymentStatus]}</span>
    </span>
  )
}
