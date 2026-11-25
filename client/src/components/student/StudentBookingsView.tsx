import { useState } from 'react'
import { listBookings } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import { useNow } from '../../hooks/useNow'
import type { Booking } from '../../types/types'
import { formatDay, formatHours, formatMoney, formatTimeRange } from '../../utils/format'
import { currentRateOf, subjectNameOf, userNameOf } from '../../utils/lookups'
import { AppLink } from '../ui/AppLink'
import { BookingDetailModal } from '../ui/BookingDetailModal'
import { CancelBookingModal } from '../ui/CancelBookingModal'
import { EmptyStateArt } from '../ui/Illustrations'
import { BookingStatusTags, PriceSnapshot } from '../ui/PriceSnapshot'

/** F-05 / F-10 / FR-11 / FR-12: the signed-in student's own bookings and 3-tier cancellation. */
export function StudentBookingsView() {
  const user = useCurrentUser()
  const { db } = useMockApp()
  const now = useNow()
  const bookings = listBookings(db, user)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <main className="th-page">
      <header className="th-page-header">
        <h1>
          My <span className="th-accent-text">bookings</span>
        </h1>
        <p>Each booking keeps the price you paid, even if the tutor changes their rate later.</p>
      </header>

      {notice && (
        <div className="th-notice th-notice-success mb-3" role="status">
          {notice}
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="th-empty">
          <EmptyStateArt kind="bookings" />
          <p className="mb-1">You have no bookings yet.</p>
          <AppLink to="/student/discover" className="btn btn-ink btn-sm">
            Find a tutor
          </AppLink>
        </div>
      ) : (
        <ol className="th-booking-list">
          {bookings.map((b) => {
            const canCancel = b.status === 'CONFIRMED' && new Date(b.startTime).getTime() > now.getTime()
            return (
              <li key={b.id} className="th-booking">
                <div className="th-booking-when">
                  <strong>{formatDay(b.startTime)}</strong>
                  <span>{formatTimeRange(b.startTime, b.endTime)}</span>
                  <span className="text-muted-ink small">{formatHours(b.durationHours)}</span>
                </div>
                <div className="th-booking-what">
                  <h2 className="h3 mb-1">{subjectNameOf(db, b.subjectId, b.subject)}</h2>
                  <p className="mb-1">with {userNameOf(db, b.tutorId, b.tutor)}</p>
                  {b.notes && <p className="th-booking-notes mb-2">“{b.notes}”</p>}
                  <BookingStatusTags booking={b} />
                  {b.status === 'CANCELLED' && (
                    <p className="small text-muted-ink mt-1 mb-0">
                      Cancelled by {b.cancelledBy === 'TUTOR' ? 'tutor' : 'student'} · {b.refundPercentage ?? 0}% refund (
                      {formatMoney(b.refundAmount ?? 0)})
                    </p>
                  )}
                  {b.status === 'COMPLETED' && b.lessonSummary && (
                    <div className="mt-2 p-2 rounded border small bg-white">
                      <strong className="d-block mb-1">Lesson notes &amp; homework:</strong>
                      <p className="mb-0 text-muted-ink" style={{ whiteSpace: 'pre-wrap' }}>
                        {b.lessonSummary}
                      </p>
                    </div>
                  )}
                  <div className="mt-2 d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-ink btn-sm"
                      aria-label={`View booking #${b.id}`}
                      onClick={() => setSelectedBookingId(b.id)}
                    >
                      Details
                    </button>
                    {canCancel && (
                      <button
                        type="button"
                        className="btn btn-danger-soft btn-sm"
                        aria-label={`Cancel booking #${b.id}`}
                        onClick={() => setCancellingBooking(b)}
                      >
                        Cancel booking
                      </button>
                    )}
                  </div>
                </div>
                <PriceSnapshot booking={b} currentRate={currentRateOf(db, b.tutorId, b.subjectId, b.currentHourlyPrice)} />
              </li>
            )
          })}
        </ol>
      )}
      {selectedBookingId !== null && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
          onCancelled={(res) =>
            setNotice(
              `Cancelled booking #${res.booking.id}. Refund: ${res.refundPercentage}% (${formatMoney(res.refundAmount)}).`,
            )
          }
        />
      )}
      {cancellingBooking !== null && (
        <CancelBookingModal
          booking={cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          onCancelled={(res) => {
            setCancellingBooking(null)
            setNotice(
              `Cancelled booking #${res.booking.id}. Refund: ${res.refundPercentage}% (${formatMoney(res.refundAmount)}).`,
            )
          }}
        />
      )}
    </main>
  )
}
