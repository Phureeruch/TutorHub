import { useState } from 'react'
import { listTutorDirectory, type TutorListing } from '../../api/mockApi'
import { useMockApp } from '../../context/appContext'
import { useNow } from '../../hooks/useNow'
import type { Availability, Booking, TeachingLevel } from '../../types/types'
import { HOUR_MS } from '../../utils/bookingRules'
import { formatDay, formatHours, formatMoney, formatRateRange, formatTimeRange, toDateInputValue } from '../../utils/format'
import { isTeachingLevel, LEVEL_LABEL, TEACHING_LEVELS } from '../../utils/levels'
import { subjectNameOf } from '../../utils/lookups'
import { AppLink } from '../ui/AppLink'
import { TimeTrack } from '../ui/TimeTrack'
import { BookingModal } from './BookingModal'
import { SubjectList } from './SubjectDetails'

const hoursOf = (a: Availability) => (new Date(a.endTime).getTime() - new Date(a.startTime).getTime()) / HOUR_MS

function TutorEntry({ listing, onBook }: { listing: TutorListing; onBook(a: Availability): void }) {
  const { user, profile, subjects, availabilities } = listing
  const headingId = `tutor-${user.id}`
  return (
    <article className="th-tutor" aria-labelledby={headingId}>
      <div className="th-tutor-about">
        <h2 id={headingId}>{user.name}</h2>
        <p className="th-tutor-rate">{formatRateRange(subjects.map((s) => s.hourlyPrice))}</p>
        {profile.bio && <p className="th-tutor-bio">{profile.bio}</p>}
        <SubjectList subjects={subjects} />
      </div>
      <div className="th-tutor-windows">
        <h3 className="visually-hidden">Open times</h3>
        {availabilities.length === 0 ? (
          <p className="text-muted-ink mb-0">No open times right now.</p>
        ) : (
          <ul className="th-window-list">
            {availabilities.map((a) => (
              <li key={a.id} className="th-window">
                <div className="th-window-when">
                  <strong>{formatDay(a.startTime)}</strong>
                  <span>{formatTimeRange(a.startTime, a.endTime)}</span>
                  <span className="text-muted-ink small">{formatHours(hoursOf(a))} open</span>
                </div>
                <div className="th-window-track">
                  <TimeTrack
                    compact
                    segments={[{ start: new Date(a.startTime), end: new Date(a.endTime), kind: 'open' }]}
                    caption={`${user.name}, ${formatDay(a.startTime)}`}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ink btn-sm"
                  onClick={() => onBook(a)}
                  aria-label={`Book ${user.name} on ${formatDay(a.startTime)} ${formatTimeRange(a.startTime, a.endTime)}`}
                >
                  Book
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

export function StudentDiscoveryView() {
  const { db } = useMockApp()
  const now = useNow()
  const [subjectId, setSubjectId] = useState<number | undefined>(undefined)
  const [tutorId, setTutorId] = useState<number | undefined>(undefined)
  const [date, setDate] = useState('')
  const [level, setLevel] = useState<TeachingLevel | undefined>(undefined)
  const [selection, setSelection] = useState<{ listing: TutorListing; availability: Availability } | null>(null)
  const [confirmed, setConfirmed] = useState<Booking | null>(null)

  const listings = listTutorDirectory(db, { now, subjectId, tutorId, date: date || undefined, level })
  const tutors = db.users.filter((u) => u.role === 'TUTOR' && u.isApproved)
  const filtered = subjectId !== undefined || tutorId !== undefined || date !== '' || level !== undefined
  const clearFilters = () => {
    setSubjectId(undefined)
    setTutorId(undefined)
    setDate('')
    setLevel(undefined)
  }

  const emptyMessage = () => {
    if (date) return `No open times on ${formatDay(`${date}T00:00`)} match these filters.`
    if (level !== undefined) {
      const what = subjectId !== undefined ? subjectNameOf(db, subjectId) : 'any subject'
      return `No tutor teaches ${what} at ${LEVEL_LABEL[level].toLowerCase()} level with open times right now.`
    }
    if (subjectId !== undefined) return `No tutor teaches ${subjectNameOf(db, subjectId)} with open times right now.`
    if (tutorId !== undefined) return 'This tutor has no open times right now.'
    return 'No tutors have open times yet.'
  }

  return (
    <main className="th-page">
      <header className="th-page-header">
        <h1>Find a tutor</h1>
        <p>Pick a subject, then book part or all of a tutor’s open window.</p>
      </header>

      {confirmed && (
        <div className="th-notice th-notice-success mb-4 d-flex flex-wrap justify-content-between gap-2" role="status">
          <span>
            Booked: {subjectNameOf(db, confirmed.subjectId)} on {formatDay(confirmed.startTime)},{' '}
            {formatTimeRange(confirmed.startTime, confirmed.endTime)}. Paid {formatMoney(confirmed.totalPrice)}.
          </span>
          <AppLink to="/student/bookings" className="fw-semibold">
            See my bookings
          </AppLink>
        </div>
      )}

      <div className="th-filters">
        <div className="th-filter" role="group" aria-label="Filter by subject">
          <button type="button" className="th-pill" aria-pressed={subjectId === undefined} onClick={() => setSubjectId(undefined)}>
            All subjects
          </button>
          {db.subjects.map((s) => (
            <button key={s.id} type="button" className="th-pill" aria-pressed={subjectId === s.id} onClick={() => setSubjectId(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="th-filter-fields">
          <div>
            <label className="form-label" htmlFor="filter-tutor">
              Tutor
            </label>
            <select
              id="filter-tutor"
              className="form-select"
              value={tutorId ?? ''}
              onChange={(e) => setTutorId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All tutors</option>
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="filter-level">
              Level
            </label>
            <select
              id="filter-level"
              className="form-select"
              value={level ?? ''}
              onChange={(e) => setLevel(isTeachingLevel(e.target.value) ? e.target.value : undefined)}
            >
              <option value="">All levels</option>
              {TEACHING_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="filter-date">
              Date
            </label>
            <input
              id="filter-date"
              type="date"
              className="form-control"
              min={toDateInputValue(now)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {filtered && (
            <button type="button" className="btn btn-outline-ink th-filter-clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="th-empty" role="status">
          <p className="mb-2">{emptyMessage()}</p>
          {filtered && (
            <button type="button" className="btn btn-ink btn-sm" onClick={clearFilters}>
              Show all open times
            </button>
          )}
        </div>
      ) : (
        <div className="th-tutor-list">
          {listings.map((listing) => (
            <TutorEntry
              key={listing.user.id}
              listing={listing}
              onBook={(availability) => {
                setConfirmed(null)
                setSelection({ listing, availability })
              }}
            />
          ))}
        </div>
      )}

      {selection && (
        <BookingModal
          listing={selection.listing}
          availability={selection.availability}
          preferredSubjectId={subjectId}
          onClose={() => setSelection(null)}
          onBooked={(booking) => {
            setSelection(null)
            setConfirmed(booking)
          }}
        />
      )}
    </main>
  )
}
