import { ApiError, type ApiStatus, type RatedSubject, type TutorListing } from './mockApi'
import type {
  AdminSummary,
  Availability,
  Booking,
  BookingAttachment,
  CancelBookingResponse,
  CreateAvailabilityRequest,
  CreateBookingRequest,
  CreateSubjectRequest,
  PendingTutor,
  RegisterRequest,
  Role,
  Subject,
  TeachingLevel,
  TutorProfile,
  UpdateSubjectRequest,
  UpdateTutorProfileRequest,
  User,
} from '../types/types'

export const AUTH_TOKEN_KEY = 'tutorhub.auth.token'

export interface PublicTutorOption {
  id: number
  name: string
}

export interface ApiTutorListing {
  user: Pick<User, 'id' | 'name' | 'role' | 'isApproved'>
  profile: TutorProfile
  subjects: RatedSubject[]
  availabilities: Availability[]
}

export interface TutorProfileResponse {
  user: { id: number; name: string; role: Role; isApproved: boolean }
  profile: TutorProfile
  subjects: RatedSubject[]
}

export interface TutorScheduleResponse {
  availabilities: Availability[]
  bookings: Booking[]
}

export interface DiscoveryQuery {
  subjectId?: number
  tutorId?: number
  date?: string
  level?: TeachingLevel
  startHour?: string
  endHour?: string
}

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getStoredToken(): string | null {
  return getStorage()?.getItem(AUTH_TOKEN_KEY) ?? null
}

export function setStoredToken(token: string | null): void {
  const storage = getStorage()
  if (!storage) return
  if (token === null) {
    storage.removeItem(AUTH_TOKEN_KEY)
  } else {
    storage.setItem(AUTH_TOKEN_KEY, token)
  }
}

function toApiStatus(status: number): ApiStatus {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409) {
    return status
  }
  return 400
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getStoredToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, { ...init, headers })

  if (!response.ok) {
    let message = 'Something went wrong. Try again.'
    try {
      const payload = (await response.json()) as { message?: unknown }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        message = payload.message
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new ApiError(toApiStatus(response.status), message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const httpClient = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setStoredToken(data.token)
    return data
  },

  async registerStudent(req: RegisterRequest): Promise<{ message: string; userId: number; token: string; user: User }> {
    const data = await request<{ message: string; userId: number; token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(req),
    })
    setStoredToken(data.token)
    return data
  },

  async getCurrentUser(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me')
  },

  async verifyEmail(): Promise<{ message: string; isEmailVerified: boolean; user: User }> {
    return request<{ message: string; isEmailVerified: boolean; user: User }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  async resetPassword(email: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, newPassword }),
    })
  },

  logout(): void {
    setStoredToken(null)
  },

  async getSubjects(): Promise<Subject[]> {
    return request<Subject[]>('/api/subjects')
  },

  async getApprovedTutors(): Promise<PublicTutorOption[]> {
    return request<PublicTutorOption[]>('/api/tutors')
  },

  async listTutorDirectory(query: DiscoveryQuery = {}): Promise<TutorListing[]> {
    const params = new URLSearchParams()
    if (query.subjectId !== undefined) params.set('subjectId', String(query.subjectId))
    if (query.tutorId !== undefined) params.set('tutorId', String(query.tutorId))
    if (query.date) params.set('date', query.date)
    if (query.level) params.set('level', query.level)
    if (query.startHour) params.set('startHour', query.startHour)
    if (query.endHour) params.set('endHour', query.endHour)
    const qs = params.toString()
    const listings = await request<ApiTutorListing[]>(`/api/availability${qs ? `?${qs}` : ''}`)
    return listings.map((entry) => ({
      ...entry,
      user: {
        email: '',
        isEmailVerified: true,
        createdAt: entry.profile.createdAt,
        updatedAt: entry.profile.updatedAt,
        ...entry.user,
      },
    }))
  },

  async getTutorProfile(): Promise<TutorProfileResponse> {
    return request<TutorProfileResponse>('/api/tutor/profile')
  },

  async updateTutorProfile(req: UpdateTutorProfileRequest): Promise<TutorProfileResponse> {
    return request<TutorProfileResponse>('/api/tutor/profile', {
      method: 'PUT',
      body: JSON.stringify(req),
    })
  },

  async getTutorAvailability(): Promise<TutorScheduleResponse> {
    return request<TutorScheduleResponse>('/api/tutor/availability')
  },

  async createAvailability(req: CreateAvailabilityRequest): Promise<Availability> {
    return request<Availability>('/api/tutor/availability', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  async deleteAvailability(availabilityId: number): Promise<void> {
    await request<{ message: string }>(`/api/tutor/availability/${availabilityId}`, {
      method: 'DELETE',
    })
  },

  async updateAvailability(availabilityId: number, req: CreateAvailabilityRequest): Promise<Availability> {
    return request<Availability>(`/api/tutor/availability/${availabilityId}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    })
  },

  async uploadAttachment(file: File | BookingAttachment): Promise<Required<BookingAttachment>> {
    if (file instanceof File) {
      const formData = new FormData()
      formData.append('file', file)
      return request<Required<BookingAttachment>>('/api/attachments', {
        method: 'POST',
        body: formData,
      })
    }

    return request<Required<BookingAttachment>>('/api/attachments', {
      method: 'POST',
      body: JSON.stringify(file),
    })
  },

  async downloadAttachment(attachmentId: number, fileName: string): Promise<void> {
    const headers = new Headers()
    const token = getStoredToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const response = await fetch(`/api/attachments/${attachmentId}`, { headers })
    if (!response.ok) {
      let message = 'Unable to download attachment.'
      try {
        const payload = (await response.json()) as { message?: unknown }
        if (typeof payload?.message === 'string') message = payload.message
      } catch {
        // Ignore parse error.
      }
      throw new ApiError(toApiStatus(response.status), message)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },

  async createBooking(req: Omit<CreateBookingRequest, 'attachmentFiles'>): Promise<Booking> {
    return request<Booking>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  async listBookings(): Promise<Booking[]> {
    return request<Booking[]>('/api/bookings')
  },

  async getBookingById(bookingId: number): Promise<Booking> {
    return request<Booking>(`/api/bookings/${bookingId}`)
  },

  async cancelBooking(bookingId: number, reason?: string): Promise<CancelBookingResponse> {
    return request<CancelBookingResponse>(`/api/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify(reason !== undefined ? { reason } : {}),
    })
  },

  async completeBooking(bookingId: number, lessonSummary: string): Promise<Booking> {
    const res = await request<{ message: string; booking: Booking }>(`/api/bookings/${bookingId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ lessonSummary }),
    })
    return res.booking
  },

  async getAdminSummary(): Promise<AdminSummary> {
    return request<AdminSummary>('/api/admin/summary')
  },

  async getPendingTutors(): Promise<PendingTutor[]> {
    return request<PendingTutor[]>('/api/admin/tutors/pending')
  },

  async approveTutor(tutorId: number): Promise<{ message: string; tutor: User }> {
    return request<{ message: string; tutor: User }>(`/api/admin/tutors/${tutorId}/approve`, {
      method: 'PATCH',
    })
  },

  async createSubject(req: CreateSubjectRequest): Promise<Subject> {
    return request<Subject>('/api/admin/subjects', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  async updateSubject(subjectId: number, req: UpdateSubjectRequest): Promise<Subject> {
    return request<Subject>(`/api/admin/subjects/${subjectId}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    })
  },
}

