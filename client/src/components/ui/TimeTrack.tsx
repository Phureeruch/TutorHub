import { HOUR_MS } from '../../utils/bookingRules'
import { formatTime, formatTimeRange } from '../../utils/format'

export type SegmentKind = 'open' | 'selected' | 'booked'

export interface TrackSegment {
  start: Date
  end: Date
  kind: SegmentKind
  label?: string
}

interface TimeTrackProps {
  segments: TrackSegment[]
  /** Short description for screen readers; the segments are listed after it. */
  caption: string
  compact?: boolean
}

const KIND_TEXT: Record<SegmentKind, string> = { open: 'open', selected: 'your lesson', booked: 'booked' }

/**
 * The hour ruler: TutorHub's one visual signature. Windows are drawn on a
 * whole-hour axis with a divider at every bookable hour *from the window's own
 * start*, so a 09:30 window visibly steps 09:30 → 10:30 → 11:30 (BR-05).
 */
export function TimeTrack({ segments, caption, compact = false }: TimeTrackProps) {
  if (segments.length === 0) return null

  const minStart = Math.min(...segments.map((s) => s.start.getTime()))
  const maxEnd = Math.max(...segments.map((s) => s.end.getTime()))
  // When every boundary sits a whole number of hours from the first start, label
  // the axis with those marks (09:30, 10:30…) — they are the real start times.
  // Mixed :00/:30 days fall back to clock hours.
  const windowAligned = segments.every(
    (s) => (s.start.getTime() - minStart) % HOUR_MS === 0 && (s.end.getTime() - minStart) % HOUR_MS === 0,
  )
  const from = new Date(minStart)
  const to = new Date(maxEnd)
  if (!windowAligned) {
    from.setMinutes(0, 0, 0)
    if (to.getMinutes() !== 0) to.setHours(to.getHours() + 1, 0, 0, 0)
  }

  const span = to.getTime() - from.getTime()
  const spanHours = Math.round(span / HOUR_MS)
  const labelEvery = spanHours > 10 ? 3 : spanHours > 6 ? 2 : 1
  const pct = (t: number) => ((t - from.getTime()) / span) * 100

  const ticks = Array.from({ length: spanHours + 1 }, (_, i) => new Date(from.getTime() + i * HOUR_MS))
  const description = `${caption}: ${segments
    .map((s) => `${formatTimeRange(s.start, s.end)} ${KIND_TEXT[s.kind]}`)
    .join(', ')}`

  return (
    <div className={`th-track${compact ? ' th-track-compact' : ''}`} role="img" aria-label={description}>
      <div className="th-track-lane">
        {segments.map((s) => {
          const hours = (s.end.getTime() - s.start.getTime()) / HOUR_MS
          return (
            <div
              key={`${s.kind}-${s.start.getTime()}`}
              className={`th-seg th-seg-${s.kind}`}
              style={{
                left: `${pct(s.start.getTime())}%`,
                width: `${pct(s.end.getTime()) - pct(s.start.getTime())}%`,
                ['--hours' as string]: hours,
              }}
            >
              {s.label && !compact && <span className="th-seg-label">{s.label}</span>}
            </div>
          )
        })}
      </div>
      <div className="th-track-axis" aria-hidden="true">
        {ticks.map((tick, i) => (
          <span
            key={tick.getTime()}
            className={`th-tick${i % labelEvery === 0 ? '' : ' th-tick-quiet'}`}
            style={{ left: `${pct(tick.getTime())}%` }}
          >
            {formatTime(tick)}
          </span>
        ))}
      </div>
    </div>
  )
}
