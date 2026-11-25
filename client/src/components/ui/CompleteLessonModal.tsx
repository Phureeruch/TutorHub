import { useState } from 'react'
import { ApiError } from '../../api/mockApi'
import { useMockApp } from '../../context/appContext'
import type { Booking } from '../../types/types'
import { formatDay, formatHours, formatTimeRange } from '../../utils/format'
import { subjectNameOf, userNameOf } from '../../utils/lookups'
import { Modal } from './Modal'

interface CompleteLessonModalProps {
  booking: Booking
  onClose(): void
  onCompleted(booking: Booking): void
}

export function CompleteLessonModal({ booking, onClose, onCompleted }: CompleteLessonModalProps) {
  const { db, completeBooking } = useMockApp()
  const [lessonSummary, setLessonSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    const trimmed = lessonSummary.trim()
    if (!trimmed) {
      setError('Enter a lesson summary or homework note.')
      return
    }
    if (trimmed.length > 2000) {
      setError('Lesson summary must be 2000 characters or fewer.')
      return
    }

    setSubmitting(true)
    try {
      const updated = await completeBooking(booking.id, trimmed)
      onCompleted(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to complete this lesson.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Complete lesson #${booking.id}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-ink" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-ink"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {submitting ? 'Completing…' : 'Complete lesson'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        <dl className="th-dl mb-0">
          <dt>Student</dt>
          <dd>{userNameOf(db, booking.studentId, booking.student)}</dd>
          <dt>Subject</dt>
          <dd>{subjectNameOf(db, booking.subjectId, booking.subject)}</dd>
          <dt>When</dt>
          <dd>
            {formatDay(booking.startTime)}, {formatTimeRange(booking.startTime, booking.endTime)} ({formatHours(booking.durationHours)})
          </dd>
        </dl>

        <div className="th-notice th-notice-info">
          Marking this lesson as completed records your summary notes and homework. Once completed, this lesson cannot
          be cancelled by either you or the student.
        </div>

        <div>
          <label htmlFor="complete-lesson-notes" className="form-label">
            Lesson summary &amp; homework notes
          </label>
          <textarea
            id="complete-lesson-notes"
            className="form-control"
            rows={4}
            maxLength={2000}
            placeholder="e.g., Reviewed binary search trees and recursion. Homework: Exercises 4.1 to 4.5."
            value={lessonSummary}
            onChange={(e) => setLessonSummary(e.target.value)}
            disabled={submitting}
          />
          <div className="d-flex justify-content-end text-muted-ink small mt-1">
            {lessonSummary.length}/2000 characters
          </div>
        </div>

        {error && (
          <div className="th-notice th-notice-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
