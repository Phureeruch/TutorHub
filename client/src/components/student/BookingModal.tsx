import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, type TutorListing } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import { useNow } from '../../hooks/useNow'
import type { Availability, Booking } from '../../types/types'
import { getValidDurations, getValidStartSlots, HOUR_MS } from '../../utils/bookingRules'
import { formatDay, formatHours, formatMoney, formatRate, formatTime, formatTimeRange } from '../../utils/format'
import { Modal } from '../ui/Modal'
import { TimeTrack } from '../ui/TimeTrack'
import { bookingBlockReason, bookingSegments, findStudentConflictingBooking, priceSummary } from './bookingForm'

interface BookingModalProps {
  listing: TutorListing
  availability: Availability
  preferredSubjectId?: number
  onClose(): void
  onBooked(booking: Booking): void
}

export function BookingModal({ listing, availability, preferredSubjectId, onClose, onBooked }: BookingModalProps) {
  const user = useCurrentUser()
  const { db, verifyEmail, createBookingWithMockPayment, simulateConflict, setSimulateConflict } = useMockApp()
  const now = useNow()

  const { user: tutor, profile, subjects } = listing
  const windowEnd = new Date(availability.endTime)
  const slots = getValidStartSlots(availability, now)

  const [subjectId, setSubjectId] = useState<number>(
    subjects.some((s) => s.id === preferredSubjectId) ? preferredSubjectId! : (subjects[0]?.id ?? 0),
  )
  const [startIso, setStartIso] = useState<string>(slots[0]?.toISOString() ?? '')
  const [durationHours, setDurationHours] = useState(1)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // The modal body scrolls; on small screens a payment error lands below the fold.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  const start = startIso ? new Date(startIso) : null
  const durations = start ? getValidDurations(start, windowEnd) : []
  // Moving the start later can shrink the room left; never keep an impossible length.
  const hours = Math.min(durationHours, durations.length || 1)
  const price = priceSummary(profile.hourlyPrice, hours)
  const blockReason = bookingBlockReason(user)
  const windowHours = (windowEnd.getTime() - new Date(availability.startTime).getTime()) / HOUR_MS
  const conflictBooking = findStudentConflictingBooking(db.bookings, user.id, start, hours)
  const canSubmit = !blockReason && conflictBooking === null && start !== null && subjectId > 0 && !submitting

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !start) return
    setError(null)
    setSubmitting(true)
    try {
      const booking = await createBookingWithMockPayment({
        tutorId: tutor.id,
        subjectId,
        startTime: start.toISOString(),
        durationHours: hours,
        notes,
      })
      onBooked(booking)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Booking failed. Nothing was charged.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Book a lesson with ${tutor.name}`}
      onClose={submitting ? () => {} : onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-outline-ink" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="booking-form" className="btn btn-ink" disabled={!canSubmit}>
            {submitting ? 'Processing mock payment…' : `Pay ${formatMoney(price.total)} and confirm`}
          </button>
        </>
      }
    >
      <form id="booking-form" onSubmit={handleSubmit} noValidate>
        <p className="mb-3">
          <strong>{formatDay(availability.startTime)}</strong>, {formatTimeRange(availability.startTime, availability.endTime)}
          <span className="text-muted-ink"> ({formatHours(windowHours)} open)</span>
        </p>

        {blockReason && (
          <div className="th-notice th-notice-info d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3" role="alert">
            <span>{blockReason}</span>
            {user.role === 'STUDENT' && (
              <button type="button" className="btn btn-ink btn-sm" onClick={() => void verifyEmail()}>
                Verify email now
              </button>
            )}
          </div>
        )}

        <div className="row g-3">
          <div className="col-sm-6">
            <label className="form-label" htmlFor="booking-subject">
              Subject
            </label>
            <select
              id="booking-subject"
              className="form-select"
              value={subjectId}
              onChange={(e) => setSubjectId(Number(e.target.value))}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="booking-duration">
              Length
            </label>
            <select
              id="booking-duration"
              className="form-select"
              value={hours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              disabled={!start}
            >
              {durations.map((h) => (
                <option key={h} value={h}>
                  {formatHours(h)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mt-3">
          <legend className="form-label fs-6">Start time</legend>
          {slots.length === 0 ? (
            <p className="text-muted-ink mb-0">This window has no start times left.</p>
          ) : (
            <div className="d-flex flex-wrap gap-2">
              {slots.map((slot) => {
                const iso = slot.toISOString()
                return (
                  <label key={iso} className="th-pill th-pill-radio">
                    <input
                      type="radio"
                      name="booking-start"
                      className="visually-hidden"
                      value={iso}
                      checked={iso === startIso}
                      onChange={() => setStartIso(iso)}
                      aria-describedby="start-hint"
                    />
                    {formatTime(slot)}
                  </label>
                )
              })}
            </div>
          )}
          <p id="start-hint" className="form-text mb-0 mt-2">
            Lessons start on whole hours from when the window opens ({formatTime(availability.startTime)}), so no
            30-minute gaps are left that nobody could book.
          </p>
        </fieldset>

        <div className="mt-3">
          <TimeTrack segments={bookingSegments(availability, start, hours)} caption="Your lesson within the window" />
        </div>

        <div aria-live="polite">
          {conflictBooking && (
            <div className="th-notice th-notice-error mb-2">
              This time overlaps a lesson you already booked ({formatDay(conflictBooking.startTime)},{' '}
              {formatTimeRange(conflictBooking.startTime, conflictBooking.endTime)}). Choose another start time or length.
            </div>
          )}
        </div>

        <div className="mt-2">
          <label className="form-label" htmlFor="booking-notes">
            Notes for {tutor.name} <span className="fw-normal text-muted-ink">(optional)</span>
          </label>
          <textarea
            id="booking-notes"
            className="form-control"
            rows={2}
            maxLength={500}
            placeholder="What do you want to work on?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="th-receipt mt-3" aria-live="polite">
          <div className="th-receipt-line">
            <span>
              {formatRate(price.hourly)} × {formatHours(price.hours)}
            </span>
            <strong className="th-receipt-total">{formatMoney(price.total)}</strong>
          </div>
          <p className="small mb-0">
            This price is locked in when you confirm. If {tutor.name} changes their rate later, your booking keeps this
            price. Payment is simulated; no money moves.
          </p>
        </div>

        <label className="form-check mt-3 small">
          <input
            type="checkbox"
            className="form-check-input"
            checked={simulateConflict}
            onChange={(e) => setSimulateConflict(e.target.checked)}
          />
          <span className="form-check-label">
            Demo: act as if another student confirmed this time first (409 conflict, nothing is saved)
          </span>
        </label>

        {error && (
          <div
            className="th-notice th-notice-error mt-3"
            role="alert"
            ref={errorRef}
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
