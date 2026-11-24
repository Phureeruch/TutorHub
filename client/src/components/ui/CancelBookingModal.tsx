import { useState } from 'react'
import { ApiError } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import { useNow } from '../../hooks/useNow'
import type { Booking, CancelBookingResponse } from '../../types/types'
import { calculateStudentRefund } from '../../utils/bookingRules'
import { formatDay, formatHours, formatMoney, formatTimeRange } from '../../utils/format'
import { subjectNameOf, userNameOf } from '../../utils/lookups'
import { Modal } from './Modal'

interface CancelBookingModalProps {
  booking: Booking
  onClose(): void
  onCancelled(response: CancelBookingResponse): void
}

function tierDescription(percentage: 100 | 50 | 0): string {
  if (percentage === 100) return 'At least 72 hours before lesson start (full refund)'
  if (percentage === 50) return 'Between 24 and 72 hours before lesson start (half refund)'
  return 'Less than 24 hours before lesson start (no refund)'
}

/** F-10 & F-11: Student 3-tier refund preview and Tutor 100%-refund / blocked-slot confirmation modal. */
export function CancelBookingModal({ booking, onClose, onCancelled }: CancelBookingModalProps) {
  const user = useCurrentUser()
  const { db, cancelBooking } = useMockApp()
  const now = useNow()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTutor = user.role === 'TUTOR'
  const preview = calculateStudentRefund(booking.totalPrice, booking.startTime, now)
  const refundPercentage = isTutor ? 100 : preview.refundPercentage
  const refundAmount = isTutor ? booking.totalPrice : preview.refundAmount

  const handleConfirm = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const response = await cancelBooking(booking.id, reason.trim() || undefined)
      onCancelled(response)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to cancel this booking.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={isTutor ? `Cancel appointment #${booking.id}` : `Cancel booking #${booking.id}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-ink" onClick={onClose} disabled={submitting}>
            Keep lesson
          </button>
          <button
            type="button"
            className="btn btn-danger-soft"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {submitting ? 'Cancelling…' : 'Confirm cancellation'}
          </button>
        </>
      }
    >
      <div className="mb-3">
        <p className="mb-1 fw-semibold">{subjectNameOf(db, booking.subjectId, booking.subject)}</p>
        <p className="text-muted-ink small mb-0">
          {isTutor
            ? `Student: ${userNameOf(db, booking.studentId, booking.student)}`
            : `Tutor: ${userNameOf(db, booking.tutorId, booking.tutor)}`}{' '}
          · {formatDay(booking.startTime)}, {formatTimeRange(booking.startTime, booking.endTime)} (
          {formatHours(booking.durationHours)})
        </p>
      </div>

      {isTutor ? (
        <div className="th-notice th-notice-warning mb-3" role="note">
          <strong>Tutor cancellation policy (BR-12):</strong> The student will receive a{' '}
          <strong>100% refund ({formatMoney(refundAmount)})</strong>, and this time slot will{' '}
          <strong>remain blocked</strong> (it will not be reopened for other students to book).
        </div>
      ) : (
        <>
          <div className="th-receipt mb-3">
            <div className="th-receipt-line">
              <span className="text-muted-ink small">Original payment</span>
              <span>{formatMoney(booking.totalPrice)}</span>
            </div>
            <div className="th-receipt-line">
              <span className="text-muted-ink small">Refund tier</span>
              <strong>{refundPercentage}% refund</strong>
            </div>
            <div className="th-receipt-line mb-0">
              <span className="fw-semibold">Refund amount</span>
              <strong className="th-receipt-total">{formatMoney(refundAmount)}</strong>
            </div>
            <p className="small text-muted-ink mt-2 mb-0">{tierDescription(preview.refundPercentage)}</p>
          </div>
          <p className="small text-muted-ink mb-3">
            Confirmed lessons cannot be rescheduled directly (BR-10). Cancelling releases this time slot back to the
            tutor’s schedule so you can book a new time.
          </p>
        </>
      )}

      <div>
        <label className="form-label" htmlFor={`cancel-reason-${booking.id}`}>
          Cancellation note <span className="fw-normal text-muted-ink">(optional)</span>
        </label>
        <textarea
          id={`cancel-reason-${booking.id}`}
          className="form-control"
          rows={2}
          maxLength={300}
          placeholder="Optional note for your records"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
        />
      </div>

      {error && (
        <div className="th-notice th-notice-error mt-3" role="alert">
          {error}
        </div>
      )}
    </Modal>
  )
}
