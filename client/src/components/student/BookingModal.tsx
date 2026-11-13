import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError, type TutorListing } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import { useNow } from '../../hooks/useNow'
import type { Availability, Booking, BookingAttachment } from '../../types/types'
import {
  attachmentError,
  attachmentKey,
  MAX_ATTACHMENT_MB,
  MAX_ATTACHMENTS,
  mergeAttachments,
} from '../../utils/attachments'
import { HOUR_MS } from '../../utils/bookingRules'
import { formatBytes, formatDay, formatHours, formatMoney, formatRate, formatTime, formatTimeRange } from '../../utils/format'
import { Modal } from '../ui/Modal'
import {
  bookingBlockReason,
  chunkSelectionToBooking,
  findStudentConflictingBooking,
  liveSelection,
  priceSummary,
  toggleChunk,
  windowChunks,
  type ChunkRefusal,
  type ChunkSelection,
} from './bookingForm'
import { SubjectLevels } from './SubjectDetails'

interface BookingModalProps {
  listing: TutorListing
  availability: Availability
  preferredSubjectId?: number
  onClose(): void
  onBooked(booking: Booking): void
}

const ACCEPTED_FILES = '.pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg'

const REFUSAL_MESSAGE: Record<ChunkRefusal, string> = {
  gap: 'Pick an hour next to the ones you chose. A lesson is one block of time with no gaps.',
  split: 'Remove hours from either end. Taking out a middle hour would split the lesson in two.',
}

export function BookingModal({ listing, availability, preferredSubjectId, onClose, onBooked }: BookingModalProps) {
  const user = useCurrentUser()
  const { db, verifyEmail, createBookingWithMockPayment, simulateConflict, setSimulateConflict } = useMockApp()
  const now = useNow()

  const { user: tutor, subjects } = listing
  const chunks = windowChunks(availability, now)

  const [subjectId, setSubjectId] = useState<number>(
    subjects.some((s) => s.id === preferredSubjectId) ? preferredSubjectId! : (subjects[0]?.id ?? 0),
  )
  // Starts empty: every hour is the student's own tap, so tapping always adds or removes.
  const [selection, setSelection] = useState<ChunkSelection | null>(null)
  const [refusal, setRefusal] = useState<ChunkRefusal | null>(null)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<BookingAttachment[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The modal body scrolls; on small screens a payment error lands below the fold.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

  const activeSelection = liveSelection(selection, chunks)
  const { start, durationHours: hours } = chunkSelectionToBooking(chunks, activeSelection)
  const end = start ? new Date(start.getTime() + hours * HOUR_MS) : null
  const subject = subjects.find((s) => s.id === subjectId)
  const price = priceSummary(subject?.hourlyPrice ?? 0, hours)
  const blockReason = bookingBlockReason(user)
  const windowHours = chunks.length
  const conflictBooking = findStudentConflictingBooking(db.bookings, user.id, start, hours)
  // A rejected pick never joins `files`, so its error is advice, not a blocker.
  const canSubmit = !blockReason && conflictBooking === null && start !== null && subject !== undefined && !submitting

  const isSelected = (index: number) =>
    activeSelection !== null && index >= activeSelection.start && index < activeSelection.start + activeSelection.length

  const tapChunk = (index: number) => {
    const result = toggleChunk(activeSelection, index, chunks)
    setSelection(result.selection)
    setRefusal(result.refused)
  }

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size, type: f.type }))
    // Reset so picking the same file again still fires a change event.
    e.target.value = ''
    const next = mergeAttachments(files, picked)
    const problem = attachmentError(next)
    setFileError(problem)
    if (!problem) setFiles(next)
  }

  const removeFile = (key: string) => {
    setFiles((current) => current.filter((f) => attachmentKey(f) !== key))
    setFileError(null)
    fileInputRef.current?.focus()
  }

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
        attachments: files,
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
            {submitting
              ? 'Processing mock payment…'
              : start
                ? `Pay ${formatMoney(price.total)} and confirm`
                : 'Pick hours to continue'}
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

        <div>
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
                {`${s.name} (${formatRate(s.hourlyPrice)})`}
              </option>
            ))}
          </select>
          {subject && (subject.levels.length > 0 || subject.topics) && (
            <div className="th-subject-brief" aria-live="polite">
              <SubjectLevels levels={subject.levels} subjectName={subject.name} />
              {subject.topics && (
                <p className="th-subject-topics">
                  <span className="visually-hidden">{tutor.name} covers: </span>
                  {subject.topics}
                </p>
              )}
            </div>
          )}
        </div>

        <fieldset className="mt-3">
          <legend className="form-label fs-6">Lesson time</legend>
          <p id="chunk-hint" className="form-text mt-0 mb-2">
            Tap each hour you want, side by side; the total updates as you go. Tap an end hour again to remove it.
            Hours run from when the window opens ({formatTime(availability.startTime)}).
          </p>
          {chunks.every((c) => !c.bookable) ? (
            <p className="text-muted-ink mb-0">This window has no start times left.</p>
          ) : (
            <div className="th-chunks" role="group" aria-describedby="chunk-hint">
              {chunks.map((chunk, index) => {
                const range = formatTimeRange(chunk.start, chunk.end)
                const selected = isSelected(index)
                return (
                  <button
                    key={chunk.start.getTime()}
                    type="button"
                    className="th-chunk"
                    aria-pressed={selected}
                    aria-label={`${range}${chunk.bookable ? '' : ', already started'}`}
                    disabled={!chunk.bookable}
                    onClick={() => tapChunk(index)}
                  >
                    <span className="th-chunk-time">{formatTime(chunk.start)}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div aria-live="polite">
            <div className="th-chunk-summary mt-2">
              <span>
                {start && end ? (
                  <>
                    Your lesson: <strong>{formatTimeRange(start, end)}</strong> ({formatHours(hours)})
                  </>
                ) : (
                  'Tap at least one hour.'
                )}
              </span>
              {activeSelection && activeSelection.length > 1 && (
                <button
                  type="button"
                  className="btn-link-ink small"
                  onClick={() => {
                    setSelection(null)
                    setRefusal(null)
                  }}
                >
                  Clear hours
                </button>
              )}
            </div>
            {refusal && <p className="th-chunk-refusal">{REFUSAL_MESSAGE[refusal]}</p>}
          </div>
        </fieldset>

        <div aria-live="polite">
          {conflictBooking && (
            <div className="th-notice th-notice-error mt-2">
              This time overlaps a lesson you already booked ({formatDay(conflictBooking.startTime)},{' '}
              {formatTimeRange(conflictBooking.startTime, conflictBooking.endTime)}). Choose different hours.
            </div>
          )}
        </div>

        <div className="mt-3">
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

        <div className="mt-3">
          <label className="form-label" htmlFor="booking-files">
            Lecture files <span className="fw-normal text-muted-ink">(optional)</span>
          </label>
          <input
            id="booking-files"
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            className="form-control"
            onChange={handleFiles}
            aria-describedby="booking-files-hint"
            aria-invalid={fileError ? true : undefined}
          />
          <div id="booking-files-hint" className="form-text">
            Slides, notes or homework for {tutor.name} to look at before the lesson. PDF, PowerPoint, Word, text or
            images; up to {MAX_ATTACHMENTS} files, {MAX_ATTACHMENT_MB} MB each.
          </div>
          {fileError && (
            <div className="th-notice th-notice-error mt-2" role="alert">
              {fileError}
            </div>
          )}
          {files.length > 0 && (
            <ul className="th-file-list" aria-label="Attached files">
              {files.map((f) => (
                <li key={attachmentKey(f)}>
                  <span className="th-file-name">{f.name}</span>
                  <span className="text-muted-ink small">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    className="btn-link-ink small"
                    onClick={() => removeFile(attachmentKey(f))}
                    aria-label={`Remove ${f.name} (${formatBytes(f.size)})`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="th-receipt mt-3" aria-live="polite">
          <div className="th-receipt-line">
            <span>
              {start ? `${formatRate(price.hourly)} × ${formatHours(price.hours)}` : `${formatRate(price.hourly)}, pick hours`}
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
          <div className="th-notice th-notice-error mt-3" role="alert" ref={errorRef}>
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
