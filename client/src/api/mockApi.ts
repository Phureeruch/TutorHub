/**
 * In-browser stand-in for the Sprint 1 REST API (docs/system-sds.md §4).
 *
 * Every function is pure: it takes the current MockDb and returns a new one, or
 * throws an ApiError with the status the real endpoint would send. Because the
 * input is never mutated, a thrown error leaves state exactly as it was — the
 * same guarantee the backend gets from `prisma.$transaction` (BR-08, NFR-04).
 */
import type {
  Availability,
  Booking,
  BookingAttachment,
  CancelBookingResponse,
  CreateAvailabilityRequest,
  CreateBookingRequest,
  MockDb,
  RegisterRequest,
  Subject,
  TaughtSubjectInput,
  TeachingLevel,
  TutorProfile,
  TutorSubject,
  UpdateTutorProfileRequest,
  User,
} from '../types/types'
import {
  calculateStudentRefund,
  calculateTotalPrice,
  getValidStartSlots,
  hasBookingOverlap,
  HOUR_MS,
  isAlignedBookingStart,
  isWithin,
  mergeAdjacentAvailabilities,
  sliceAvailabilityAfterBooking,
  validateAvailabilityInput,
} from '../utils/bookingRules'
import { attachmentError } from '../utils/attachments'
import { dayKey } from '../utils/format'
import { isTeachingLevel, orderLevels } from '../utils/levels'

export type ApiStatus = 400 | 401 | 403 | 404 | 409

export class ApiError extends Error {
  readonly status: ApiStatus

  constructor(status: ApiStatus, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface Mutation<T> {
  db: MockDb
  data: T
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD_LENGTH = 8

const normalizeEmail = (email: string) => email.trim().toLowerCase()

function requireRole(actor: User, role: User['role']): void {
  if (actor.role !== role) throw new ApiError(403, 'You do not have permission to do this.')
}

function findUser(db: MockDb, id: number): User {
  const user = db.users.find((u) => u.id === id)
  if (!user) throw new ApiError(404, 'User not found.')
  return user
}

function profileOf(db: MockDb, tutorId: number): TutorProfile {
  const profile = db.tutorProfiles.find((p) => p.userId === tutorId)
  if (!profile) throw new ApiError(404, 'Tutor profile not found.')
  return profile
}

/** A subject a tutor teaches, with that tutor's rate, levels and topics for it. */
export type RatedSubject = Subject & Pick<TutorSubject, 'hourlyPrice' | 'levels' | 'topics'>

export function subjectsOfTutor(db: MockDb, tutorId: number): RatedSubject[] {
  const profile = db.tutorProfiles.find((p) => p.userId === tutorId)
  if (!profile) return []
  // Index this tutor's links once: discovery calls this for every tutor on every render.
  const links = new Map(
    db.tutorSubjects.filter((ts) => ts.tutorProfileId === profile.id).map((ts) => [ts.subjectId, ts]),
  )
  return db.subjects.flatMap((subject) => {
    const link = links.get(subject.id)
    return link ? [{ ...subject, hourlyPrice: link.hourlyPrice, levels: link.levels, topics: link.topics }] : []
  })
}

export const MAX_TOPICS_LENGTH = 200

const byStartTime = <T extends { startTime: string }>(a: T, b: T) =>
  new Date(a.startTime).getTime() - new Date(b.startTime).getTime()

// ---------------------------------------------------------------------------
// Auth (SDS §4.1)
// ---------------------------------------------------------------------------

export function login(db: MockDb, email: string, password: string): User {
  const user = db.users.find((u) => u.email === normalizeEmail(email))
  if (!user || db.credentials[user.id] !== password) {
    throw new ApiError(401, 'Email or password is incorrect.')
  }
  return user
}

export function registerStudent(db: MockDb, req: RegisterRequest, now: Date): Mutation<User> {
  const email = normalizeEmail(req.email)
  const name = req.name.trim()
  if (!name) throw new ApiError(400, 'Enter your name.')
  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, 'Enter a valid email address.')
  if (req.password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (db.users.some((u) => u.email === email)) throw new ApiError(409, 'An account with this email already exists.')

  const stamp = now.toISOString()
  // BR-01/BR-02: public sign-up only ever creates students, unverified.
  const user: User = {
    id: db.nextIds.user,
    email,
    name,
    role: 'STUDENT',
    isEmailVerified: false,
    isApproved: false,
    createdAt: stamp,
    updatedAt: stamp,
  }
  return {
    db: {
      ...db,
      users: [...db.users, user],
      credentials: { ...db.credentials, [user.id]: req.password },
      nextIds: { ...db.nextIds, user: user.id + 1 },
    },
    data: user,
  }
}

export function verifyEmail(db: MockDb, userId: number, now: Date): Mutation<User> {
  const user = { ...findUser(db, userId), isEmailVerified: true, updatedAt: now.toISOString() }
  return { db: { ...db, users: db.users.map((u) => (u.id === userId ? user : u)) }, data: user }
}

/** Mock reset: succeeds silently for unknown emails so it cannot be used to probe accounts. */
export function resetPassword(db: MockDb, email: string, newPassword: string): Mutation<null> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  const user = db.users.find((u) => u.email === normalizeEmail(email))
  if (!user) return { db, data: null }
  return { db: { ...db, credentials: { ...db.credentials, [user.id]: newPassword } }, data: null }
}

// ---------------------------------------------------------------------------
// Tutor profile & availability (SDS §4.2)
// ---------------------------------------------------------------------------

export function updateTutorProfile(
  db: MockDb,
  actor: User,
  req: UpdateTutorProfileRequest,
  now: Date = new Date(),
): Mutation<TutorProfile> {
  requireRole(actor, 'TUTOR')
  // One entry per subject; a repeated subject keeps its last entry. Unknown subjects are ignored.
  const bySubject = new Map<number, TaughtSubjectInput>()
  for (const entry of req.subjects) {
    if (db.subjects.some((s) => s.id === entry.subjectId)) bySubject.set(entry.subjectId, entry)
  }
  if (bySubject.size === 0) throw new ApiError(400, 'Choose at least one subject you teach.')
  for (const { subjectId, hourlyPrice, levels = [], topics = '' } of bySubject.values()) {
    const name = db.subjects.find((s) => s.id === subjectId)?.name ?? 'This subject'
    if (!Number.isFinite(hourlyPrice) || hourlyPrice <= 0) {
      throw new ApiError(400, `${name}: hourly rate must be more than 0.`)
    }
    if (!levels.every(isTeachingLevel)) throw new ApiError(400, `${name}: unknown level.`)
    if (topics.trim().length > MAX_TOPICS_LENGTH) {
      throw new ApiError(400, `${name}: keep topics to ${MAX_TOPICS_LENGTH} characters.`)
    }
  }

  const current = profileOf(db, actor.id)
  const profile: TutorProfile = {
    ...current,
    bio: req.bio === undefined ? current.bio : req.bio.trim() || null,
    updatedAt: now.toISOString(),
  }

  let nextTutorSubjectId = db.nextIds.tutorSubject
  const links: TutorSubject[] = [...bySubject.values()]
    .sort((a, b) => a.subjectId - b.subjectId)
    .map(({ subjectId, hourlyPrice, levels = [], topics = '' }) => ({
      id: nextTutorSubjectId++,
      tutorProfileId: profile.id,
      subjectId,
      hourlyPrice,
      levels: orderLevels(levels),
      topics: topics.trim() || null,
    }))

  // Bookings are deliberately untouched: their price snapshot is frozen (BR-09).
  return {
    db: {
      ...db,
      tutorProfiles: db.tutorProfiles.map((p) => (p.id === profile.id ? profile : p)),
      tutorSubjects: [...db.tutorSubjects.filter((ts) => ts.tutorProfileId !== profile.id), ...links],
      nextIds: { ...db.nextIds, tutorSubject: nextTutorSubjectId },
    },
    data: profile,
  }
}

const rangesOverlap = (aStart: string, aEnd: string, bStart: Date, bEnd: Date) =>
  new Date(aStart).getTime() < bEnd.getTime() && bStart.getTime() < new Date(aEnd).getTime()

export function createAvailability(
  db: MockDb,
  actor: User,
  req: CreateAvailabilityRequest,
  now: Date,
): Mutation<Availability> {
  requireRole(actor, 'TUTOR')
  const start = new Date(req.startTime)
  const end = new Date(req.endTime)
  const validation = validateAvailabilityInput(start, end, now)
  if (!validation.ok) throw new ApiError(400, validation.error)

  if (db.availabilities.some((a) => a.tutorId === actor.id && rangesOverlap(a.startTime, a.endTime, start, end))) {
    throw new ApiError(400, 'This overlaps availability you already offer.')
  }
  if (
    db.bookings.some(
      (b) => b.tutorId === actor.id && b.status !== 'CANCELLED' && rangesOverlap(b.startTime, b.endTime, start, end),
    )
  ) {
    throw new ApiError(400, 'This overlaps a lesson that is already booked.')
  }

  const stamp = now.toISOString()
  const { availabilities, merged, nextAvailabilityId } = mergeAdjacentAvailabilities(
    db.availabilities,
    actor.id,
    { start, end },
    db.nextIds.availability,
    stamp,
  )
  return {
    db: {
      ...db,
      availabilities,
      nextIds: { ...db.nextIds, availability: nextAvailabilityId },
    },
    data: merged,
  }
}

/**
 * Booked time is sliced out of availability on confirmation, so an availability
 * row never contains a confirmed lesson and can always be removed by its owner.
 */
export function deleteAvailability(db: MockDb, actor: User, availabilityId: number): Mutation<null> {
  requireRole(actor, 'TUTOR')
  const target = db.availabilities.find((a) => a.id === availabilityId)
  if (!target) throw new ApiError(404, 'Availability period not found.')
  if (target.tutorId !== actor.id) throw new ApiError(403, 'You can only remove your own availability.')
  return { db: { ...db, availabilities: db.availabilities.filter((a) => a.id !== availabilityId) }, data: null }
}

export function updateAvailability(
  db: MockDb,
  actor: User,
  availabilityId: number,
  req: CreateAvailabilityRequest,
  now: Date,
): Mutation<Availability> {
  requireRole(actor, 'TUTOR')
  const target = db.availabilities.find((a) => a.id === availabilityId)
  if (!target) throw new ApiError(404, 'Availability not found.')
  if (target.tutorId !== actor.id) throw new ApiError(403, 'You can only edit your own availability.')

  const start = new Date(req.startTime)
  const end = new Date(req.endTime)
  const validation = validateAvailabilityInput(start, end, now)
  if (!validation.ok) throw new ApiError(400, validation.error)

  const others = db.availabilities.filter((a) => a.id !== availabilityId)
  if (others.some((a) => a.tutorId === actor.id && rangesOverlap(a.startTime, a.endTime, start, end))) {
    throw new ApiError(400, 'This overlaps availability you already offer.')
  }
  if (
    db.bookings.some(
      (b) => b.tutorId === actor.id && b.status !== 'CANCELLED' && rangesOverlap(b.startTime, b.endTime, start, end),
    )
  ) {
    throw new ApiError(400, 'This overlaps a lesson that is already booked.')
  }

  const stamp = now.toISOString()
  const { availabilities, merged, nextAvailabilityId } = mergeAdjacentAvailabilities(
    others,
    actor.id,
    { start, end },
    db.nextIds.availability,
    stamp,
  )
  return {
    db: {
      ...db,
      availabilities,
      nextIds: { ...db.nextIds, availability: nextAvailabilityId },
    },
    data: merged,
  }
}

// ---------------------------------------------------------------------------
// Bookings & mock payment (SDS §4.3)
// ---------------------------------------------------------------------------

export interface CreateBookingOptions {
  now: Date
  /** Demo switch: behave as if another student confirmed this slot a moment earlier. */
  simulateConflict?: boolean
}

/**
 * Lecture files are optional. The mock keeps only name, size and type; a real
 * backend needs file storage plus an attachments table (backend-api-guide.md §6).
 */
function validateAttachments(files: BookingAttachment[]): BookingAttachment[] {
  const error = attachmentError(files)
  if (error) throw new ApiError(400, error)
  return files.map(({ name, size, type }) => ({ name, size, type }))
}

export const CONFLICT_MESSAGE = 'This time is no longer available. Your payment was not taken.'

export function createBooking(
  db: MockDb,
  actor: User,
  req: CreateBookingRequest,
  { now, simulateConflict = false }: CreateBookingOptions,
): Mutation<Booking> {
  requireRole(actor, 'STUDENT')
  const student = findUser(db, actor.id)
  if (!student.isEmailVerified) throw new ApiError(400, 'Verify your email before booking a lesson.')

  if (!Number.isInteger(req.durationHours) || req.durationHours < 1) {
    throw new ApiError(400, 'Lesson length must be a whole number of hours.')
  }
  const start = new Date(req.startTime)
  const end = new Date(start.getTime() + req.durationHours * HOUR_MS)
  if (start.getTime() <= now.getTime()) throw new ApiError(400, 'Choose a start time in the future.')

  const tutor = findUser(db, req.tutorId)
  if (tutor.role !== 'TUTOR' || !tutor.isApproved) throw new ApiError(404, 'Tutor not found.')
  const subject = subjectsOfTutor(db, tutor.id).find((s) => s.id === req.subjectId)
  if (!subject) throw new ApiError(400, `${tutor.name} does not teach this subject.`)
  const attachments = validateAttachments(req.attachments ?? [])

  // --- Transaction boundary: everything below is all-or-nothing. ---
  const container = db.availabilities.find((a) => a.tutorId === tutor.id && isWithin(a, start, end))
  if (!container) throw new ApiError(409, CONFLICT_MESSAGE)
  if (!isAlignedBookingStart(container, start)) {
    throw new ApiError(400, 'Start time must be a whole number of hours after the window opens.')
  }
  if (hasBookingOverlap(db.bookings, student.id, tutor.id, start, end)) {
    throw new ApiError(409, 'You already have a lesson at this time.')
  }
  if (simulateConflict) throw new ApiError(409, CONFLICT_MESSAGE)

  // Mock payment always succeeds in Sprint 1; the subject's rate is snapshotted here (BR-09).
  const hourlyPriceSnapshot = subject.hourlyPrice
  const stamp = now.toISOString()
  const booking: Booking = {
    id: db.nextIds.booking,
    studentId: student.id,
    tutorId: tutor.id,
    subjectId: req.subjectId,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationHours: req.durationHours,
    hourlyPriceSnapshot,
    totalPrice: calculateTotalPrice(hourlyPriceSnapshot, req.durationHours),
    notes: req.notes?.trim() || null,
    attachments,
    lessonSummary: null,
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    cancelledBy: null,
    cancelledAt: null,
    refundPercentage: null,
    refundAmount: null,
    createdAt: stamp,
    updatedAt: stamp,
  }

  let nextAvailabilityId = db.nextIds.availability
  const remainder: Availability[] = sliceAvailabilityAfterBooking(container, start, end).map((part) => ({
    id: nextAvailabilityId++,
    tutorId: tutor.id,
    startTime: part.start.toISOString(),
    endTime: part.end.toISOString(),
    createdAt: container.createdAt,
    updatedAt: stamp,
  }))

  return {
    db: {
      ...db,
      bookings: [...db.bookings, booking],
      availabilities: [...db.availabilities.filter((a) => a.id !== container.id), ...remainder],
      nextIds: { ...db.nextIds, booking: booking.id + 1, availability: nextAvailabilityId },
    },
    data: booking,
  }
}

/** NFR-02: each role sees only what it owns; admin sees everything. */
export function listBookings(db: MockDb, actor: User): Booking[] {
  const visible =
    actor.role === 'ADMIN'
      ? db.bookings
      : actor.role === 'TUTOR'
        ? db.bookings.filter((b) => b.tutorId === actor.id)
        : db.bookings.filter((b) => b.studentId === actor.id)
  return [...visible].sort(byStartTime)
}

/** SDS §4.3 GET /api/bookings/:id — owner student, owner tutor, or admin only (NFR-02). */
export function getBookingById(db: MockDb, actor: User, bookingId: number): Booking {
  const booking = db.bookings.find((b) => b.id === bookingId)
  if (!booking) throw new ApiError(404, 'Booking not found.')
  const allowed =
    actor.role === 'ADMIN' ||
    (actor.role === 'STUDENT' && booking.studentId === actor.id) ||
    (actor.role === 'TUTOR' && booking.tutorId === actor.id)
  if (!allowed) throw new ApiError(403, 'You do not have permission to view this booking.')
  return booking
}

export function cancelBooking(
  db: MockDb,
  actor: User,
  bookingId: number,
  now: Date,
  reason?: string,
): Mutation<CancelBookingResponse> {
  const existing = db.bookings.find((b) => b.id === bookingId)
  if (!existing) throw new ApiError(404, 'Booking not found.')

  const isStudentOwner = actor.role === 'STUDENT' && existing.studentId === actor.id
  const isTutorOwner = actor.role === 'TUTOR' && existing.tutorId === actor.id
  if (!isStudentOwner && !isTutorOwner) {
    throw new ApiError(403, 'You are not allowed to cancel this booking.')
  }

  if (existing.status !== 'CONFIRMED') {
    throw new ApiError(409, 'Only confirmed bookings can be cancelled.')
  }

  const start = new Date(existing.startTime)
  const end = new Date(existing.endTime)
  if (start.getTime() <= now.getTime()) {
    throw new ApiError(400, 'You can only cancel a booking before the lesson starts.')
  }

  if (reason !== undefined && reason.trim().length > 300) {
    throw new ApiError(400, 'Invalid cancellation reason.')
  }

  const refund = isStudentOwner
    ? calculateStudentRefund(existing.totalPrice, start, now)
    : {
        refundPercentage: 100 as const,
        refundAmount: existing.totalPrice,
        paymentStatus: 'REFUNDED_FULL' as const,
      }

  const stamp = now.toISOString()
  const updatedBooking: Booking = {
    ...existing,
    status: 'CANCELLED',
    paymentStatus: refund.paymentStatus,
    cancelledBy: actor.role,
    cancelledAt: stamp,
    refundPercentage: refund.refundPercentage,
    refundAmount: refund.refundAmount,
    updatedAt: stamp,
  }

  let nextAvailabilities = db.availabilities
  let nextAvailabilityId = db.nextIds.availability
  // BR-13: Student cancellation restores and merges availability.
  // BR-12: Tutor cancellation keeps the time slot blocked.
  if (isStudentOwner) {
    const mergedResult = mergeAdjacentAvailabilities(
      db.availabilities,
      existing.tutorId,
      { start, end },
      db.nextIds.availability,
      stamp,
    )
    nextAvailabilities = mergedResult.availabilities
    nextAvailabilityId = mergedResult.nextAvailabilityId
  }

  return {
    db: {
      ...db,
      bookings: db.bookings.map((b) => (b.id === existing.id ? updatedBooking : b)),
      availabilities: nextAvailabilities,
      nextIds: { ...db.nextIds, availability: nextAvailabilityId },
    },
    data: {
      message: 'Booking cancelled successfully.',
      refundPercentage: refund.refundPercentage,
      refundAmount: refund.refundAmount,
      booking: updatedBooking,
    },
  }
}

// ---------------------------------------------------------------------------
// Discovery (SDS §4.2 GET /api/availability)
// ---------------------------------------------------------------------------

export interface TutorListing {
  user: User
  profile: TutorProfile
  subjects: RatedSubject[]
  availabilities: Availability[]
}

export interface TutorDirectoryFilter {
  now: Date
  subjectId?: number
  tutorId?: number
  /** YYYY-MM-DD, local calendar day. */
  date?: string
  /**
   * Keeps tutors who teach some subject (the chosen one, if any) at this level.
   * Not in SDS §4.2's query params yet (backend-api-guide.md §5.2).
   */
  level?: TeachingLevel
}

export function listTutorDirectory(
  db: MockDb,
  { now, subjectId, tutorId, date, level }: TutorDirectoryFilter,
): TutorListing[] {
  return db.users
    .filter((u) => u.role === 'TUTOR' && u.isApproved && (tutorId === undefined || u.id === tutorId))
    .flatMap((user) => {
      // A tutor without a profile has no rate, so they cannot be booked yet.
      const profile = db.tutorProfiles.find((p) => p.userId === user.id)
      if (!profile) return []
      return [
        {
          user,
          profile,
          subjects: subjectsOfTutor(db, user.id),
          availabilities: db.availabilities
            .filter(
              (a) =>
                a.tutorId === user.id && getValidStartSlots(a, now).length > 0 && (!date || dayKey(a.startTime) === date),
            )
            .sort(byStartTime),
        },
      ]
    })
    .filter(
      (t) =>
        (subjectId === undefined && level === undefined) ||
        t.subjects.some(
          (s) => (subjectId === undefined || s.id === subjectId) && (level === undefined || s.levels.includes(level)),
        ),
    )
    // Searching by date means "who can I book that day": tutors with nothing open drop out.
    .filter((t) => !date || t.availabilities.length > 0)
}
