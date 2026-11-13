import { useState } from 'react'
import { listBookings } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import { formatDay, formatHours, formatTimeRange } from '../../utils/format'
import { currentRateOf, subjectNameOf, userNameOf } from '../../utils/lookups'
import { AppLink } from '../ui/AppLink'
import { BookingDetailModal } from '../ui/BookingDetailModal'
import { BookingStatusTags, PriceSnapshot } from '../ui/PriceSnapshot'

/** F-05 / FR-11: the signed-in student's own bookings only (NFR-02). */
export function StudentBookingsView() {
  const user = useCurrentUser()
  const { db } = useMockApp()
  const bookings = listBookings(db, user)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)

  return (
    <main className="th-page">
      <header className="th-page-header">
        <h1>My bookings</h1>
        <p>Each booking keeps the price you paid, even if the tutor changes their rate later.</p>
      </header>

      {bookings.length === 0 ? (
        <div className="th-empty">
          <p className="mb-2">You have no bookings yet.</p>
          <AppLink to="/student/discover" className="btn btn-ink btn-sm">
            Find a tutor
          </AppLink>
        </div>
      ) : (
        <ol className="th-booking-list">
          {bookings.map((b) => (
            <li key={b.id} className="th-booking">
              <div className="th-booking-when">
                <strong>{formatDay(b.startTime)}</strong>
                <span>{formatTimeRange(b.startTime, b.endTime)}</span>
                <span className="text-muted-ink small">{formatHours(b.durationHours)}</span>
              </div>
              <div className="th-booking-what">
                <h2 className="h3 mb-1">{subjectNameOf(db, b.subjectId)}</h2>
                <p className="mb-1">with {userNameOf(db, b.tutorId)}</p>
                {b.notes && <p className="th-booking-notes mb-2">“{b.notes}”</p>}
                <BookingStatusTags booking={b} />
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-outline-ink btn-sm"
                    aria-label={`View booking #${b.id}`}
                    onClick={() => setSelectedBookingId(b.id)}
                  >
                    Details
                  </button>
                </div>
              </div>
              <PriceSnapshot booking={b} currentRate={currentRateOf(db, b.tutorId, b.subjectId)} />
            </li>
          ))}
        </ol>
      )}
      {selectedBookingId !== null && (
        <BookingDetailModal bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
      )}
    </main>
  )
}
