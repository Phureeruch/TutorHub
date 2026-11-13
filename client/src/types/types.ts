// Mirrors the Prisma schema in docs/system-sds.md §2. Date columns are ISO-8601
// strings because that is how the REST API serialises them, so swapping the
// mock store for real fetch calls does not change any component.

export type Role = 'STUDENT' | 'TUTOR' | 'ADMIN'
export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
export type PaymentStatus = 'SUCCESS' | 'REFUNDED_PARTIAL' | 'REFUNDED_FULL'

export interface User {
  id: number
  email: string
  name: string
  role: Role
  isEmailVerified: boolean
  isApproved: boolean
  createdAt: string
  updatedAt: string
}

export interface Subject {
  id: number
  name: string
  description: string | null
  createdAt: string
}

// Rates are set per subject, so hourlyPrice lives on TutorSubject. SDS §2 still
// has TutorProfile.hourlyPrice; docs/backend-api-guide.md §2 covers the migration.
export interface TutorProfile {
  id: number
  userId: number
  bio: string | null
  createdAt: string
  updatedAt: string
}

/** Who a tutor teaches a subject to. Not in SRS Draft 2 or SDS §2 yet (backend-api-guide.md §2, R3). */
export type TeachingLevel = 'HIGH_SCHOOL' | 'UNDERGRADUATE' | 'GRADUATE'

export interface TutorSubject {
  id: number
  tutorProfileId: number
  subjectId: number
  hourlyPrice: number
  levels: TeachingLevel[]
  /** What the tutor covers in this subject, shown to students. */
  topics: string | null
}

/** Lecture file a student attaches to a booking. Not in SRS Draft 2 (§4.2 lists attachments as out of scope). */
export interface BookingAttachment {
  name: string
  size: number
  type: string
}

export interface Availability {
  id: number
  tutorId: number
  startTime: string
  endTime: string
  createdAt: string
  updatedAt: string
}

export interface Booking {
  id: number
  studentId: number
  tutorId: number
  subjectId: number
  startTime: string
  endTime: string
  durationHours: number
  hourlyPriceSnapshot: number
  totalPrice: number
  notes: string | null
  attachments: BookingAttachment[]
  lessonSummary: string | null
  status: BookingStatus
  paymentStatus: PaymentStatus
  cancelledBy: Role | null
  cancelledAt: string | null
  refundPercentage: number | null
  refundAmount: number | null
  createdAt: string
  updatedAt: string
}

// Request payloads, matching docs/system-sds.md §4.
export interface RegisterRequest {
  email: string
  password: string
  name: string
}

/** One subject a tutor teaches, as sent by the profile form. */
export interface TaughtSubjectInput {
  subjectId: number
  hourlyPrice: number
  levels?: TeachingLevel[]
  topics?: string
}

// Replaces SDS §4.2 `{ bio?, hourlyPrice, subjectIds }`: rate, levels and topics are per subject.
export interface UpdateTutorProfileRequest {
  bio?: string
  subjects: TaughtSubjectInput[]
}

export interface CreateAvailabilityRequest {
  startTime: string
  endTime: string
}

export interface CreateBookingRequest {
  tutorId: number
  subjectId: number
  startTime: string
  durationHours: number
  notes?: string
  attachments?: BookingAttachment[]
}

// Client-side mock database standing in for PostgreSQL during Sprint 1 UI work.
export interface MockDb {
  users: User[]
  // Dev-only plaintext credentials; the real backend stores bcrypt hashes (NFR-01).
  credentials: Record<number, string>
  subjects: Subject[]
  tutorProfiles: TutorProfile[]
  tutorSubjects: TutorSubject[]
  availabilities: Availability[]
  bookings: Booking[]
  nextIds: {
    user: number
    tutorProfile: number
    tutorSubject: number
    availability: number
    booking: number
  }
}
