import { useRef, useState, type FormEvent } from 'react'
import { ApiError, listBookings, subjectsOfTutor } from '../../api/mockApi'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import { useFieldError } from '../../hooks/useFieldError'
import { useNow } from '../../hooks/useNow'
import type { TutorProfile, User } from '../../types/types'
import { formatDay, formatHours, formatRate, formatTimeRange, toDateInputValue } from '../../utils/format'
import { currentRateOf, subjectNameOf, userNameOf } from '../../utils/lookups'
import { AppLink } from '../ui/AppLink'
import { BookingDetailModal } from '../ui/BookingDetailModal'
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

function AvailabilitySection({ tutor }: { tutor: User }) {
  const { db, createAvailability, deleteAvailability } = useMockApp()
  const now = useNow()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [date, setDate] = useState(() => toDateInputValue(tomorrow))
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState<0 | 30>(0)
  const [duration, setDuration] = useState(2)
  const [notice, setNotice] = useState<string | null>(null)
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
          <div className="th-empty">No windows yet. Add one above so students can book you.</div>
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
    </>
  )
}

// ---------------------------------------------------------------------------
// Section A: profile, subjects & hourly rate (FR-05, BR-09 hint)
// ---------------------------------------------------------------------------

function ProfileForm({ tutor, profile }: { tutor: User; profile: TutorProfile }) {
  const { db, updateTutorProfile } = useMockApp()
  const [bio, setBio] = useState(profile.bio ?? '')
  const [rate, setRate] = useState(String(profile.hourlyPrice))
  const [subjectIds, setSubjectIds] = useState<number[]>(() => subjectsOfTutor(db, tutor.id).map((s) => s.id))
  const [saved, setSaved] = useState(false)
  const rateRef = useRef<HTMLInputElement>(null)
  const { error, setError, fail, invalidProps, clearField } = useFieldError({ rate: rateRef })

  const toggleSubject = (id: number) =>
    setSubjectIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    const hourlyPrice = Number(rate)
    if (!rate.trim() || !Number.isFinite(hourlyPrice) || hourlyPrice <= 0) {
      return fail({ field: 'rate', message: 'Hourly rate must be more than 0.' })
    }
    setError(null)
    try {
      await updateTutorProfile({ bio, hourlyPrice, subjectIds })
      setSaved(true)
    } catch (err) {
      // e.g. no subject chosen: that is a fieldset, not one input, so no field is flagged.
      fail({ field: null, message: messageOf(err) })
    }
  }

  const rateChanged = Number(rate) !== profile.hourlyPrice && Number(rate) > 0

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

      <div className="mb-4">
        <label className="form-label" htmlFor="profile-rate">
          Hourly rate (USD)
        </label>
        <div className="input-group th-rate-input">
          <span className="input-group-text">$</span>
          <input
            id="profile-rate"
            ref={rateRef}
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            className="form-control"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value)
              clearField('rate')
            }}
            aria-describedby="profile-rate-hint"
            {...invalidProps('rate')}
          />
          <span className="input-group-text">/hr</span>
        </div>
        <div id="profile-rate-hint" className={`form-text${rateChanged ? ' th-hint-strong' : ''}`}>
          {rateChanged
            ? `New bookings will cost ${formatRate(Number(rate))}. Lessons already booked keep the ${formatRate(profile.hourlyPrice)} the student paid.`
            : 'A new rate only applies to new bookings. Lessons already booked keep the price the student paid.'}
        </div>
      </div>

      <fieldset className="mb-4">
        <legend className="form-label fs-6">Subjects you teach</legend>
        <div className="d-flex flex-wrap gap-2">
          {db.subjects.map((s) => (
            <label key={s.id} className="th-pill th-pill-radio th-pill-check">
              <input
                type="checkbox"
                className="visually-hidden"
                checked={subjectIds.includes(s.id)}
                onChange={() => toggleSubject(s.id)}
              />
              {s.name}
            </label>
          ))}
        </div>
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
        <h1>Profile & rate</h1>
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
  const bookings = listBookings(db, tutor)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
  return (
    <>
      <header className="th-page-header">
        <h1>Appointments</h1>
        <p>Lessons students have booked with you. Prices are the ones paid at booking time.</p>
      </header>
      {bookings.length === 0 ? (
        <div className="th-empty">
          <p className="mb-2">No lessons booked yet. Students can book once you have open windows.</p>
          <AppLink to="/tutor/dashboard" className="btn btn-ink btn-sm">
            Add availability
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
                <h2 className="h3 mb-1">{userNameOf(db, b.studentId)}</h2>
                <p className="mb-1">{subjectNameOf(db, b.subjectId)}</p>
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
              <PriceSnapshot booking={b} currentRate={currentRateOf(db, b.tutorId)} />
            </li>
          ))}
        </ol>
      )}
      {selectedBookingId !== null && (
        <BookingDetailModal bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
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
