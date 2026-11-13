import { createContext, useContext } from 'react'
import type {
  Availability,
  Booking,
  CreateAvailabilityRequest,
  CreateBookingRequest,
  MockDb,
  RegisterRequest,
  TutorProfile,
  UpdateTutorProfileRequest,
  User,
} from '../types/types'

/**
 * The surface components use. Every action is async and rejects with ApiError,
 * matching what the fetch-based client will do once the Express API exists.
 */
export interface MockAppValue {
  db: MockDb
  currentUser: User | null
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
  deleteAvailability(availabilityId: number): Promise<void>

  createBookingWithMockPayment(req: CreateBookingRequest): Promise<Booking>
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
