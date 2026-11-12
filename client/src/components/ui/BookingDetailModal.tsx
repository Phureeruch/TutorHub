import { ApiError, getBookingById } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import type { Booking } from '../../types/types'
import { formatDay, formatHours, formatMoney, formatRate, formatTime, formatTimeRange } from '../../utils/format'
import { currentRateOf, subjectNameOf, userNameOf } from '../../utils/lookups'
import { Modal } from './Modal'
import { BookingStatusTags } from './PriceSnapshot'

// BR-09: compare the live rate with the frozen one instead of repeating the price.
function rateNow(current: number | null, snapshot: number): string {
  if (current === null) return 'Not available'
  if (current === snapshot) return `${formatRate(current)} (unchanged)`
  return `${formatRate(current)}. This booking keeps ${formatRate(snapshot)}.`
}

interface BookingDetailModalProps {
  bookingId: number
  onClose(): void
}

/** FR-11: one booking in full, fetched through the same ownership check as GET /api/bookings/:id. */
export function BookingDetailModal({ bookingId, onClose }: BookingDetailModalProps) {
  const user = useCurrentUser()
  const { db } = useMockApp()

  let booking: Booking
  try {
    booking = getBookingById(db, user, bookingId)
  } catch (err) {
    return (
      <Modal title="Booking details" onClose={onClose}>
        <div className="th-notice th-notice-error" role="alert">
          {err instanceof ApiError ? err.message : 'This booking could not be loaded.'}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={`Booking #${booking.id}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-outline-ink" onClick={onClose}>
          Close
        </button>
      }
    >
      <dl className="th-detail">
        <dt>Subject</dt>
        <dd>{subjectNameOf(db, booking.subjectId)}</dd>
        <dt>Student</dt>
        <dd>{userNameOf(db, booking.studentId)}</dd>
        <dt>Tutor</dt>
        <dd>{userNameOf(db, booking.tutorId)}</dd>
        <dt>When</dt>
        <dd>
          {formatDay(booking.startTime)}, {formatTimeRange(booking.startTime, booking.endTime)}
        </dd>
        <dt>Length</dt>
        <dd>{formatHours(booking.durationHours)}</dd>
        <dt>Rate at booking</dt>
        <dd>{formatRate(booking.hourlyPriceSnapshot)}</dd>
        <dt>Total paid</dt>
        <dd>{formatMoney(booking.totalPrice)}</dd>
        <dt>Tutor&rsquo;s rate now</dt>
        <dd>{rateNow(currentRateOf(db, booking.tutorId), booking.hourlyPriceSnapshot)}</dd>
        <dt>Status</dt>
        <dd>
          <BookingStatusTags booking={booking} />
        </dd>
        <dt>Student notes</dt>
        <dd>{booking.notes ?? 'None'}</dd>
        <dt>Confirmed</dt>
        <dd>
          {formatDay(booking.createdAt)}, {formatTime(booking.createdAt)}
        </dd>
      </dl>
    </Modal>
  )
}
