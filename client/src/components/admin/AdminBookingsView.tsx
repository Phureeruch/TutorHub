import { useState } from 'react'
import { listBookings } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import { formatDay, formatHours, formatMoney, formatRate, formatTimeRange } from '../../utils/format'
import { subjectNameOf, userNameOf } from '../../utils/lookups'
import { BookingDetailModal } from '../ui/BookingDetailModal'
import { EmptyStateArt } from '../ui/Illustrations'
import { BookingStatusTags } from '../ui/PriceSnapshot'

/** F-07 / FR-11 / BR-03: every booking in the school, admin only (route-guarded). */
export function AdminBookingsView() {
  const admin = useCurrentUser()
  const { db, adminSummary: summary } = useMockApp()
  const bookings = listBookings(db, admin)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)

  return (
    <main className="th-page">
      <header className="th-page-header">
        <h1>
          All <span className="th-accent-text">bookings</span>
        </h1>
        <p>Every lesson booked at the school, with the price recorded when it was confirmed.</p>
      </header>

      <dl className="th-stats">
        <div>
          <dt>Bookings</dt>
          <dd>{summary.totalBookings}</dd>
        </div>
        <div className="th-stats-accent">
          <dt>Mock payments taken</dt>
          <dd>{formatMoney(summary.mockRevenue)}</dd>
        </div>
        <div>
          <dt>Active tutors</dt>
          <dd>{summary.activeTutors}</dd>
        </div>
        <div>
          <dt>Verified students</dt>
          <dd>
            {summary.verifiedStudents}
            <span className="th-stats-of"> of {summary.totalStudents}</span>
          </dd>
        </div>
      </dl>

      {bookings.length === 0 ? (
        <div className="th-empty">
          <EmptyStateArt kind="bookings" />
          <p className="mb-0">No bookings yet.</p>
        </div>
      ) : (
        <div className="table-responsive th-table-wrap">
          <table className="table th-table align-middle" aria-label="All bookings, earliest first">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">When</th>
                <th scope="col">Student</th>
                <th scope="col">Tutor</th>
                <th scope="col">Subject</th>
                <th scope="col" className="th-num">
                  Length
                </th>
                <th scope="col" className="th-num">
                  Rate at booking
                </th>
                <th scope="col" className="th-num">
                  Total
                </th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="th-num text-start">#{b.id}</td>
                  <td className="text-nowrap">
                    {formatDay(b.startTime)}
                    <br />
                    <span className="text-muted-ink">{formatTimeRange(b.startTime, b.endTime)}</span>
                  </td>
                  <td>{userNameOf(db, b.studentId, b.student)}</td>
                  <td>{userNameOf(db, b.tutorId, b.tutor)}</td>
                  <td>{subjectNameOf(db, b.subjectId, b.subject)}</td>
                  <td className="th-num">{formatHours(b.durationHours)}</td>
                  <td className="th-num">{formatRate(b.hourlyPriceSnapshot)}</td>
                  <td className="th-num fw-semibold">{formatMoney(b.totalPrice)}</td>
                  <td>
                    <BookingStatusTags booking={b} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline-ink btn-sm"
                      aria-label={`View booking #${b.id}`}
                      onClick={() => setSelectedBookingId(b.id)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedBookingId !== null && (
        <BookingDetailModal bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
      )}
    </main>
  )
}
