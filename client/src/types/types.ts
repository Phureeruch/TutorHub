// Mirrors the Prisma schema in docs/system-sds.md §2. Date columns are ISO-8601
// strings because that is how the REST API serialises them.

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

export interface TutorProfile {
  id: number
  userId: number
  bio: string | null
  createdAt: string
  updatedAt: string
}

/** Who a tutor teaches a subject to (SRS v2.1, SDS §2). */
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

/** Lecture file a student attaches to a booking (SRS v2.1 §4.1, SDS §2). */
export interface BookingAttachment {
  id?: number
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

export interface NamedEntity {
  id: number
  name: string
}

export interface Booking {
  id: number
  studentId: number
  tutorId: number
  subjectId: number
  student?: NamedEntity
  tutor?: NamedEntity
  subject?: NamedEntity
  startTime: string
  endTime: string
  durationHours: number
  hourlyPriceSnapshot: number
  totalPrice: number
  currentHourlyPrice?: number | null
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

export interface AdminSummary {
  totalBookings: number
  mockRevenue: number
  activeTutors: number
  verifiedStudents: number
  totalStudents: number
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
  attachmentIds?: number[]
  /** Raw browser File objects selected in the modal for multipart upload. */
  attachmentFiles?: File[]
}

export interface CancelBookingResponse {
  message: string
  refundPercentage: 100 | 50 | 0
  refundAmount: number
  booking: Booking
}

// Client-side mock database standing in for PostgreSQL during unit/UI tests.
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
