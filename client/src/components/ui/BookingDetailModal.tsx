import { useEffect, useState } from 'react'
import { httpClient } from '../../api/httpClient'
import { ApiError, getBookingById } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import type { Booking } from '../../types/types'
import { formatBytes, formatDay, formatHours, formatMoney, formatRate, formatTime, formatTimeRange } from '../../utils/format'
import { attachmentKey } from '../../utils/attachments'
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
  const { mode, db, fetchBookingById } = useMockApp()
  const [apiBooking, setApiBooking] = useState<Booking | null>(() =>
    mode === 'api' ? (db.bookings.find((b) => b.id === bookingId) ?? null) : null,
  )
  const [apiError, setApiError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'api') return
    let active = true
    void fetchBookingById(bookingId)
      .then((loaded) => {
        if (!active) return
        setApiBooking(loaded)
        setApiError(null)
      })
      .catch((err) => {
        if (!active) return
        setApiError(err instanceof ApiError ? err.message : 'This booking could not be loaded.')
      })
    return () => {
      active = false
    }
  }, [mode, bookingId, fetchBookingById])

  let booking: Booking | null = null
  let loadError: string | null = apiError

  if (mode === 'mock') {
    try {
      booking = getBookingById(db, user, bookingId)
    } catch (err) {
      loadError = err instanceof ApiError ? err.message : 'This booking could not be loaded.'
    }
  } else {
    booking = apiBooking
  }

  if (loadError || !booking) {
    return (
      <Modal title="Booking details" onClose={onClose}>
        {loadError ? (
          <div className="th-notice th-notice-error" role="alert">
            {loadError}
          </div>
        ) : (
          <p className="text-muted-ink mb-0">Loading booking details…</p>
        )}
      </Modal>
    )
  }

  const handleDownload = async (attachmentId: number, fileName: string) => {
    setDownloadError(null)
    try {
      await httpClient.downloadAttachment(attachmentId, fileName)
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not download this file.')
    }
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
        <dd>{subjectNameOf(db, booking.subjectId, booking.subject)}</dd>
        <dt>Student</dt>
        <dd>{userNameOf(db, booking.studentId, booking.student)}</dd>
        <dt>Tutor</dt>
        <dd>{userNameOf(db, booking.tutorId, booking.tutor)}</dd>
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
        <dd>
          {rateNow(
            currentRateOf(db, booking.tutorId, booking.subjectId, booking.currentHourlyPrice),
            booking.hourlyPriceSnapshot,
          )}
        </dd>
        <dt>Status</dt>
        <dd>
          <BookingStatusTags booking={booking} />
        </dd>
        <dt>Student notes</dt>
        <dd>{booking.notes ?? 'None'}</dd>
        <dt>Lecture files</dt>
        <dd>
          {booking.attachments.length === 0 ? (
            'None'
          ) : (
            <ul className="th-detail-files">
              {booking.attachments.map((f) => (
                <li key={f.id ?? attachmentKey(f)}>
                  {f.name} <span className="text-muted-ink small">{formatBytes(f.size)}</span>
                  {mode === 'api' && f.id !== undefined && (
                    <button
                      type="button"
                      className="btn-link-ink small ms-2"
                      onClick={() => void handleDownload(f.id!, f.name)}
                    >
                      Download
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {downloadError && (
            <div className="th-notice th-notice-error mt-2" role="alert">
              {downloadError}
            </div>
          )}
        </dd>
        <dt>Confirmed</dt>
        <dd>
          {formatDay(booking.createdAt)}, {formatTime(booking.createdAt)}
        </dd>
      </dl>
    </Modal>
  )
}
