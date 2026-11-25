import { createContext, useContext } from 'react'
import type { TutorListing } from '../api/mockApi'
import type {
  AdminSummary,
  Availability,
  Booking,
  CancelBookingResponse,
  CreateAvailabilityRequest,
  CreateBookingRequest,
  CreateSubjectRequest,
  MockDb,
  PendingTutor,
  RegisterRequest,
  Subject,
  TeachingLevel,
  TutorProfile,
  UpdateSubjectRequest,
  UpdateTutorProfileRequest,
  User,
} from '../types/types'

export interface DirectoryFilters {
  subjectId?: number
  tutorId?: number
  date?: string
  level?: TeachingLevel
  startHour?: string
  endHour?: string
}

/**
 * The surface components use. Every action is async and rejects with ApiError,
 * backed by the Express API in app mode and the pure mock store in Vitest tests.
 */
export interface MockAppValue {
  mode: 'api' | 'mock'
  authReady: boolean
  db: MockDb
  currentUser: User | null
  adminSummary: AdminSummary
  simulateConflict: boolean
  setSimulateConflict(value: boolean): void

  login(email: string, password: string): Promise<User>
  logout(): void
  registerStudent(req: RegisterRequest): Promise<User>
  verifyEmail(): Promise<User>
  resetPassword(email: string, newPassword: string): Promise<void>
  switchDemoUser(userId: number): void

  updateTutorProfile(req: UpdateTutorProfileRequest): Promise<TutorProfile>
  createAvailability(req: CreateAvailabilityRequest): Promise<Availability>
  updateAvailability(availabilityId: number, req: CreateAvailabilityRequest): Promise<Availability>
  deleteAvailability(availabilityId: number): Promise<void>

  createBookingWithMockPayment(req: CreateBookingRequest): Promise<Booking>
  cancelBooking(bookingId: number, reason?: string): Promise<CancelBookingResponse>
  fetchDirectory(filters: DirectoryFilters): Promise<TutorListing[]>
  fetchBookingById(bookingId: number): Promise<Booking>

  getPendingTutors(): Promise<PendingTutor[]>
  approveTutor(tutorId: number): Promise<User>
  createSubject(req: CreateSubjectRequest): Promise<Subject>
  updateSubject(subjectId: number, req: UpdateSubjectRequest): Promise<Subject>

  resetToSeedData(): void
}

export const MockAppContext = createContext<MockAppValue | null>(null)

export function useMockApp(): MockAppValue {
  const value = useContext(MockAppContext)
  if (!value) throw new Error('useMockApp must be used inside <MockAppProvider>')
  return value
}

/** Narrows to a signed-in user; views behind the route guard can rely on it. */
export function useCurrentUser(): User {
  const { currentUser } = useMockApp()
  if (!currentUser) throw new Error('useCurrentUser called without a signed-in user')
  return currentUser
}
