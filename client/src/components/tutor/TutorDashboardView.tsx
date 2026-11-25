import { useRef, useState, type FormEvent } from 'react'
import { ApiError, listBookings, MAX_TOPICS_LENGTH, subjectsOfTutor } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import { useFieldError } from '../../hooks/useFieldError'
import { useNow } from '../../hooks/useNow'
import type { Availability, Booking, TeachingLevel, TutorProfile, User } from '../../types/types'
import { HOUR_MS } from '../../utils/bookingRules'
import { CURRENCY_SYMBOL, formatDay, formatHours, formatMoney, formatRate, formatTimeRange, toDateInputValue } from '../../utils/format'
import { LEVEL_LABEL, orderLevels, TEACHING_LEVELS } from '../../utils/levels'
import { currentRateOf, subjectNameOf, userNameOf } from '../../utils/lookups'
import { AppLink } from '../ui/AppLink'
import { BookingDetailModal } from '../ui/BookingDetailModal'
import { CancelBookingModal } from '../ui/CancelBookingModal'
import { CompleteLessonModal } from '../ui/CompleteLessonModal'
import { EmptyStateArt } from '../ui/Illustrations'
import { Modal } from '../ui/Modal'
import { BookingStatusTags, PriceSnapshot } from '../ui/PriceSnapshot'
import { TimeTrack } from '../ui/TimeTrack'
import { buildAvailabilityRequest, groupScheduleByDay } from './tutorSchedule'

export type TutorSection = 'availability' | 'profile' | 'appointments'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const DURATIONS = [1, 2, 3, 4, 5, 6, 7, 8]
const pad = (n: number) => String(n).padStart(2, '0')
const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Try again.')

// ---------------------------------------------------------------------------
// Section B: availability creator + schedule (FR-06, BR-04)
// ---------------------------------------------------------------------------

function EditAvailabilityModal({
  availability,
  onClose,
  onUpdated,
}: {
  availability: Availability
  onClose(): void
  onUpdated(updated: Availability): void
}) {
  const { updateAvailability } = useMockApp()
  const now = useNow()
  const initialStart = new Date(availability.startTime)
  const initialHours = Math.max(
    1,
    Math.round((new Date(availability.endTime).getTime() - initialStart.getTime()) / HOUR_MS),
  )

  const [date, setDate] = useState(() => toDateInputValue(initialStart))
  const [hour, setHour] = useState(() => initialStart.getHours())
  const [minute, setMinute] = useState<0 | 30>(() => (initialStart.getMinutes() === 30 ? 30 : 0))
  const [duration, setDuration] = useState(() => initialHours)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const request = buildAvailabilityRequest(date, hour, minute, duration)

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!request) {
      setError('Choose a valid date.')
      return
    }
    setSaving(true)
    try {
      const updated = await updateAvailability(availability.id, request)
      onUpdated(updated)
    } catch (err) {
      setError(messageOf(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Edit open window"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline-ink" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="edit-av-form" className="btn btn-ink" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="edit-av-form" onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="row g-3">
          <div className="col-sm-6">
            <label className="form-label" htmlFor="edit-av-date">
              Date
            </label>
            <input
              id="edit-av-date"
              type="date"
              className="form-control"
              min={toDateInputValue(now)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="col-6 col-sm-3">
            <label className="form-label" htmlFor="edit-av-hour">
              Start hour
            </label>
            <select
              id="edit-av-hour"
              className="form-select"
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-sm-3">
            <label className="form-label" htmlFor="edit-av-duration">
              Length
            </label>
            <select
              id="edit-av-duration"
              className="form-select"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATIONS.map((h) => (
                <option key={h} value={h}>
                  {formatHours(h)}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="col-12">
            <legend className="form-label fs-6">Minutes</legend>
            <div className="d-flex gap-2">
              {([0, 30] as const).map((m) => (
                <label key={m} className="th-pill th-pill-radio">
                  <input
                    type="radio"
                    name="edit-av-minute"
                    className="visually-hidden"
                    checked={minute === m}
                    onChange={() => setMinute(m)}
                  />
                  :{pad(m)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {request && (
          <p className="form-text mb-0 mt-3">
            {formatDay(request.startTime)}, {formatTimeRange(request.startTime, request.endTime)}
          </p>
        )}
        {error && (
          <div className="th-notice th-notice-error mt-3" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}

function AvailabilitySection({ tutor }: { tutor: User }) {
  const { db, createAvailability, deleteAvailability } = useMockApp()
  const now = useNow()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [date, setDate] = useState(() => toDateInputValue(tomorrow))
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState<0 | 30>(0)
  const [duration, setDuration] = useState(2)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingAvailability, setEditingAvailability] = useState<Availability | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const { error, setError, fail, invalidProps, clearField } = useFieldError({ date: dateRef })

  const request = buildAvailabilityRequest(date, hour, minute, duration)
  const days = groupScheduleByDay(
    db.availabilities.filter((a) => a.tutorId === tutor.id),
    listBookings(db, tutor),
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!request) return fail({ field: 'date', message: 'Choose a date.' })
    try {
      const created = await createAvailability(request)
      setNotice(`Added ${formatDay(created.startTime)}, ${formatTimeRange(created.startTime, created.endTime)}.`)
    } catch (err) {
      // Overlap and past-time errors depend on several fields together, so none is flagged.
      fail({ field: null, message: messageOf(err) })
    }
  }

  const handleRemove = async (id: number, label: string) => {
    if (!window.confirm(`Remove open window ${label}?`)) return
    setError(null)
    try {
      await deleteAvailability(id)
      setNotice(`Removed ${label}.`)
    } catch (err) {
      fail({ field: null, message: messageOf(err) })
    }
  }

  return (
    <>
      <header className="th-page-header">
        <h1>Availability</h1>
        <p>Add the times you are free. Students book whole hours inside each window, starting from when it opens.</p>
      </header>

      <form className="th-panel th-creator" onSubmit={handleSubmit} noValidate aria-labelledby="creator-heading">
        <h2 id="creator-heading" className="h3 mb-3">
          Add a window
        </h2>
        <div className="row g-3 align-items-end">
          <div className="col-sm-6 col-lg-3">
            <label className="form-label" htmlFor="av-date">
              Date
            </label>
            <input
              id="av-date"
              ref={dateRef}
              type="date"
              className="form-control"
              min={toDateInputValue(now)}
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                clearField('date')
              }}
              required
              {...invalidProps('date')}
            />
          </div>
          <div className="col-6 col-lg-2">
            <label className="form-label" htmlFor="av-hour">
              Start hour
            </label>
            <select id="av-hour" className="form-select" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="col-6 col-lg-3">
            <legend className="form-label fs-6">Minutes</legend>
            <div className="d-flex gap-2">
              {([0, 30] as const).map((m) => (
                <label key={m} className="th-pill th-pill-radio">
                  <input
                    type="radio"
                    name="av-minute"
                    className="visually-hidden"
                    checked={minute === m}
                    onChange={() => setMinute(m)}
                  />
                  :{pad(m)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="col-6 col-lg-2">
            <label className="form-label" htmlFor="av-duration">
              Length
            </label>
            <select
              id="av-duration"
              className="form-select"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATIONS.map((h) => (
                <option key={h} value={h}>
                  {formatHours(h)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <button type="submit" className="btn btn-ink w-100">
              Add window
            </button>
          </div>
        </div>
        {request && (
          <p className="form-text mb-0 mt-3">
            {formatDay(request.startTime)}, {formatTimeRange(request.startTime, request.endTime)}. Windows start on :00 or
            :30 and last whole hours, so every lesson inside them does too.
          </p>
        )}
        <div aria-live="polite">
          {error && (
            <div className="th-notice th-notice-error mt-3" role="alert">
              {error.message}
            </div>
          )}
          {notice && <div className="th-notice th-notice-success mt-3">{notice}</div>}
        </div>
      </form>

      <section className="mt-5" aria-labelledby="schedule-heading">
        <h2 id="schedule-heading">Your schedule</h2>
        <p className="text-muted-ink">
          Blue is open for booking. Hatched time is booked; it was cut out of the window it came from.
        </p>
        {days.length === 0 ? (
          <div className="th-empty">
            <EmptyStateArt kind="schedule" />
            <p className="mb-0">No windows yet. Add one above so students can book you.</p>
          </div>
        ) : (
          <ol className="th-schedule">
            {days.map((day) => (
              <li key={day.key} className="th-schedule-day">
                <h3 className="th-schedule-date">{formatDay(day.date)}</h3>
                <TimeTrack segments={day.segments} caption={`Schedule for ${formatDay(day.date)}`} />
                {day.availabilities.length > 0 && (
                  <ul className="th-window-chips" aria-label={`Open windows on ${formatDay(day.date)}`}>
                    {day.availabilities.map((a) => {
                      const label = formatTimeRange(a.startTime, a.endTime)
                      return (
                        <li key={a.id} className="th-window-chip">
                          <span>{label}</span>
                          <button
                            type="button"
                            className="btn-link-ink small"
                            onClick={() => setEditingAvailability(a)}
                            aria-label={`Edit ${formatDay(a.startTime)} ${label}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-link-ink small"
                            onClick={() => handleRemove(a.id, `${formatDay(a.startTime)}, ${label}`)}
                            aria-label={`Remove ${formatDay(a.startTime)} ${label}`}
                          >
                            Remove
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {editingAvailability !== null && (
        <EditAvailabilityModal
          availability={editingAvailability}
          onClose={() => setEditingAvailability(null)}
          onUpdated={(updated) => {
            setEditingAvailability(null)
            setError(null)
            setNotice(`Updated window to ${formatDay(updated.startTime)}, ${formatTimeRange(updated.startTime, updated.endTime)}.`)
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Section A: profile, subjects & per-subject hourly rates (FR-05, BR-09 hint)
// ---------------------------------------------------------------------------

const rateInputId = (subjectId: number) => `profile-rate-${subjectId}`
const topicsInputId = (subjectId: number) => `profile-topics-${subjectId}`

/** One ticked subject as typed; the rate stays a string until save so "" can be flagged. */
interface SubjectDraft {
  rate: string
  levels: TeachingLevel[]
  topics: string
}

function ProfileForm({ tutor, profile }: { tutor: User; profile: TutorProfile }) {
  const { db, updateTutorProfile } = useMockApp()
  const taughtNow = subjectsOfTutor(db, tutor.id)
  const [bio, setBio] = useState(profile.bio ?? '')
  // Keyed by subject id; a key exists only while the subject is ticked.
  const [drafts, setDrafts] = useState<Record<number, SubjectDraft>>(() =>
    Object.fromEntries(
      taughtNow.map((s) => [s.id, { rate: String(s.hourlyPrice), levels: s.levels, topics: s.topics ?? '' }]),
    ),
  )
  const [saved, setSaved] = useState(false)
  // Field names are the inputs' element ids, so a failed field can be focused by id.
  const { error, setError, fail, invalidProps, clearField } = useFieldError<string>({})
  // Rate inputs come and go with their checkbox, so they are focused by id rather than a fixed ref map.
  const failAndFocus = (next: { field: string | null; message: string }) => {
    fail(next)
    if (next.field) document.getElementById(next.field)?.focus()
  }

  const toggleSubject = (id: number) =>
    setDrafts((current) => {
      const next = { ...current }
      if (id in next) delete next[id]
      else next[id] = { rate: '', levels: [], topics: '' }
      return next
    })

  const editDraft = (id: number, change: Partial<SubjectDraft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...change } }))

  const toggleLevel = (id: number, level: TeachingLevel) => {
    const { levels } = drafts[id]
    editDraft(id, { levels: orderLevels(levels.includes(level) ? levels.filter((l) => l !== level) : [...levels, level]) })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    const taughtSubjects = db.subjects.filter((s) => s.id in drafts)
    if (taughtSubjects.length === 0) {
      return failAndFocus({ field: null, message: 'Choose at least one subject you teach.' })
    }
    // Checked in display order so focus lands on the first problem.
    for (const s of taughtSubjects) {
      const { rate } = drafts[s.id]
      const value = Number(rate)
      if (!rate.trim() || !Number.isFinite(value) || value <= 0) {
        return failAndFocus({ field: rateInputId(s.id), message: `${s.name}: enter an hourly rate more than 0.` })
      }
    }
    setError(null)
    try {
      await updateTutorProfile({
        bio,
        subjects: taughtSubjects.map((s) => ({
          subjectId: s.id,
          hourlyPrice: Number(drafts[s.id].rate),
          levels: drafts[s.id].levels,
          topics: drafts[s.id].topics,
        })),
      })
      setSaved(true)
    } catch (err) {
      failAndFocus({ field: null, message: messageOf(err) })
    }
  }

  return (
    <form className="th-panel th-profile-form" onSubmit={handleSubmit} noValidate>
      <div className="mb-4">
        <label className="form-label" htmlFor="profile-bio">
          About you
        </label>
        <textarea
          id="profile-bio"
          className="form-control"
          rows={3}
          maxLength={600}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          aria-describedby="profile-bio-hint"
        />
        <div id="profile-bio-hint" className="form-text">
          Students see this next to your open times.
        </div>
      </div>

      <fieldset className="mb-4" aria-describedby="profile-rates-hint">
        <legend className="form-label fs-6 mb-1">Subjects you teach</legend>
        <p id="profile-rates-hint" className="form-text mt-0 mb-2">
          Tick each subject you teach. Set its rate in baht per hour, who you teach it to, and what you cover, so
          students can pick the right tutor. A new rate only applies to new bookings; lessons already booked keep the
          price the student paid.
        </p>
        <ul className="th-rate-list">
          {db.subjects.map((s) => {
            const draft = drafts[s.id]
            const isTaught = draft !== undefined
            const id = rateInputId(s.id)
            const topicsId = topicsInputId(s.id)
            const savedRate = taughtNow.find((t) => t.id === s.id)?.hourlyPrice
            const typed = Number(draft?.rate)
            const changed = isTaught && savedRate !== undefined && typed > 0 && typed !== savedRate
            return (
              <li key={s.id} className={`th-rate-row${isTaught ? ' is-taught' : ''}`}>
                <label className="th-rate-subject">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={isTaught}
                    onChange={() => toggleSubject(s.id)}
                  />
                  {s.name}
                </label>
                {isTaught && (
                  <div className="th-rate-field">
                    <label className="visually-hidden" htmlFor={id}>
                      {`Rate for ${s.name}, baht per hour`}
                    </label>
                    <div className="input-group th-rate-input">
                      <span className="input-group-text" aria-hidden="true">
                        {CURRENCY_SYMBOL}
                      </span>
                      <input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        min={1}
                        step={1}
                        className="form-control"
                        placeholder="400"
                        value={draft.rate}
                        onChange={(e) => {
                          editDraft(s.id, { rate: e.target.value })
                          clearField(id)
                        }}
                        {...invalidProps(id)}
                      />
                      <span className="input-group-text" aria-hidden="true">
                        /hr
                      </span>
                    </div>
                    {changed && (
                      <p className="th-rate-change">
                        New bookings {formatRate(typed)}. Booked lessons keep {formatRate(savedRate)}.
                      </p>
                    )}
                  </div>
                )}
                {isTaught && (
                  <div className="th-rate-details">
                    <div role="group" aria-label={`Levels for ${s.name}`}>
                      <span className="th-rate-detail-label" aria-hidden="true">
                        Levels
                      </span>
                      <div className="th-level-picks">
                        {TEACHING_LEVELS.map((level) => (
                          <label key={level} className="th-pill th-pill-check">
                            <input
                              type="checkbox"
                              className="form-check-input m-0"
                              checked={draft.levels.includes(level)}
                              onChange={() => toggleLevel(s.id, level)}
                            />
                            {LEVEL_LABEL[level]}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="th-rate-detail-label" htmlFor={topicsId}>
                        Topics<span className="visually-hidden"> for {s.name}</span>{' '}
                        <span className="fw-normal text-muted-ink">(optional)</span>
                      </label>
                      <textarea
                        id={topicsId}
                        className="form-control"
                        rows={2}
                        maxLength={MAX_TOPICS_LENGTH}
                        placeholder="What you cover, e.g. exam prep, past papers"
                        value={draft.topics}
                        onChange={(e) => editDraft(s.id, { topics: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div aria-live="polite">
        {error && (
          <div className="th-notice th-notice-error mb-3" role="alert">
            {error.message}
          </div>
        )}
        {saved && <div className="th-notice th-notice-success mb-3">Profile saved.</div>}
      </div>
      <button type="submit" className="btn btn-ink">
        Save profile
      </button>
    </form>
  )
}

function ProfileSection({ tutor }: { tutor: User }) {
  const { db } = useMockApp()
  const profile = db.tutorProfiles.find((p) => p.userId === tutor.id)
  return (
    <>
      <header className="th-page-header">
        <h1>
          Profile &amp; <span className="th-accent-text">rate</span>
        </h1>
        <p>What students see when they choose a tutor.</p>
      </header>
      {profile ? (
        // A demo reset recreates the profile with a new createdAt; remount then so the
        // form shows seed values. Saving only bumps updatedAt, which must keep the form
        // (and its "saved" notice) mounted.
        <ProfileForm key={`${profile.id}-${profile.createdAt}`} tutor={tutor} profile={profile} />
      ) : (
        <div className="th-empty">No tutor profile exists for this account. Ask the school administrator to set one up.</div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Section C: appointments (F-06, FR-11, NFR-02)
// ---------------------------------------------------------------------------

function AppointmentsSection({ tutor }: { tutor: User }) {
  const { db } = useMockApp()
  const now = useNow()
  const bookings = listBookings(db, tutor)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null)
  const [completingBooking, setCompletingBooking] = useState<Booking | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <>
      <header className="th-page-header">
        <h1>Appointments</h1>
        <p>Lessons students have booked with you. Prices are the ones paid at booking time.</p>
      </header>
      {notice && (
        <div className="th-notice th-notice-success mb-3" role="status">
          {notice}
        </div>
      )}
      {bookings.length === 0 ? (
        <div className="th-empty">
          <EmptyStateArt kind="bookings" />
          <p className="mb-1">No lessons booked yet. Students can book once you have open windows.</p>
          <AppLink to="/tutor/dashboard" className="btn btn-ink btn-sm">
            Add availability
          </AppLink>
        </div>
      ) : (
        <ol className="th-booking-list">
          {bookings.map((b) => {
            const canCancel = b.status === 'CONFIRMED' && new Date(b.startTime).getTime() > now.getTime()
            const canComplete = b.status === 'CONFIRMED'
            return (
              <li key={b.id} className="th-booking">
                <div className="th-booking-when">
                  <strong>{formatDay(b.startTime)}</strong>
                  <span>{formatTimeRange(b.startTime, b.endTime)}</span>
                  <span className="text-muted-ink small">{formatHours(b.durationHours)}</span>
                </div>
                <div className="th-booking-what">
                  <h2 className="h3 mb-1">{userNameOf(db, b.studentId, b.student)}</h2>
                  <p className="mb-1">{subjectNameOf(db, b.subjectId, b.subject)}</p>
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
                    {canComplete && (
                      <button
                        type="button"
                        className="btn btn-outline-ink btn-sm"
                        aria-label={`Complete lesson #${b.id}`}
                        onClick={() => setCompletingBooking(b)}
                      >
                        Complete lesson
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        className="btn btn-danger-soft btn-sm"
                        aria-label={`Cancel appointment #${b.id}`}
                        onClick={() => setCancellingBooking(b)}
                      >
                        Cancel appointment
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
              `Cancelled appointment #${res.booking.id}. Student refunded 100% (${formatMoney(res.refundAmount)}).`,
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
              `Cancelled appointment #${res.booking.id}. Student refunded 100% (${formatMoney(res.refundAmount)}).`,
            )
          }}
        />
      )}
      {completingBooking !== null && (
        <CompleteLessonModal
          booking={completingBooking}
          onClose={() => setCompletingBooking(null)}
          onCompleted={(updated) => {
            setCompletingBooking(null)
            setNotice(`Lesson #${updated.id} marked as completed. Summary notes saved.`)
          }}
        />
      )}
    </>
  )
}

export function TutorDashboardView({ section }: { section: TutorSection }) {
  const tutor = useCurrentUser()
  return (
    <main className="th-page">
      {section === 'availability' && <AvailabilitySection tutor={tutor} />}
      {section === 'profile' && <ProfileSection tutor={tutor} />}
      {section === 'appointments' && <AppointmentsSection tutor={tutor} />}
    </main>
  )
}
