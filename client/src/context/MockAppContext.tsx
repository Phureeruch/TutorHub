import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getStoredToken, httpClient, setStoredToken, type PublicTutorOption, type TutorProfileResponse } from '../api/httpClient'
import * as api from '../api/mockApi'
import { computeAdminSummary } from '../components/admin/adminSummary'
import { createSeedDb } from '../data/seedData'
import type { AdminSummary, Availability, Booking, MockDb, TutorProfile, TutorSubject, User } from '../types/types'
import { attachmentKey } from '../utils/attachments'
import { MockAppContext, type DirectoryFilters, type MockAppValue } from './appContext'
import { loadState, readLatestDb, saveState, STORAGE_KEY, type AppState, type KeyValueStore } from './persistence'

// Long enough to show the "processing payment" state, short enough not to annoy.
const MOCK_PAYMENT_DELAY_MS = 700

const EMPTY_ADMIN_SUMMARY: AdminSummary = {
  totalBookings: 0,
  mockRevenue: 0,
  activeTutors: 0,
  verifiedStudents: 0,
  totalStudents: 0,
}

function emptyDb(): MockDb {
  return {
    users: [],
    credentials: {},
    subjects: [],
    tutorProfiles: [],
    tutorSubjects: [],
    availabilities: [],
    bookings: [],
    nextIds: { user: 1, tutorProfile: 1, tutorSubject: 1, availability: 1, booking: 1 },
  }
}

function browserStore(): KeyValueStore {
  try {
    return window.localStorage
  } catch {
    const memory = new Map<string, string>()
    return { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) }
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function defaultMode(): 'api' | 'mock' {
  if (import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_MOCK === 'true') {
    return 'mock'
  }
  return 'api'
}

function buildDbFromApi(params: {
  currentUser: User | null
  subjects: MockDb['subjects']
  approvedTutors: PublicTutorOption[]
  listings: api.TutorListing[]
  bookings: Booking[]
  tutorProfileRes: TutorProfileResponse | null
  tutorSchedule: { availabilities: Availability[]; bookings: Booking[] } | null
}): MockDb {
  const userMap = new Map<number, User>()
  const stamp = new Date().toISOString()

  for (const t of params.approvedTutors) {
    userMap.set(t.id, {
      id: t.id,
      name: t.name,
      email: '',
      role: 'TUTOR',
      isEmailVerified: true,
      isApproved: true,
      createdAt: stamp,
      updatedAt: stamp,
    })
  }
  for (const l of params.listings) {
    userMap.set(l.user.id, l.user)
  }
  for (const b of params.bookings) {
    if (b.student && !userMap.has(b.student.id)) {
      userMap.set(b.student.id, {
        id: b.student.id,
        name: b.student.name,
        email: '',
        role: 'STUDENT',
        isEmailVerified: true,
        isApproved: false,
        createdAt: stamp,
        updatedAt: stamp,
      })
    }
    if (b.tutor && !userMap.has(b.tutor.id)) {
      userMap.set(b.tutor.id, {
        id: b.tutor.id,
        name: b.tutor.name,
        email: '',
        role: 'TUTOR',
        isEmailVerified: true,
        isApproved: true,
        createdAt: stamp,
        updatedAt: stamp,
      })
    }
  }
  if (params.currentUser) {
    userMap.set(params.currentUser.id, params.currentUser)
  }

  const profileMap = new Map<number, TutorProfile>()
  const tutorSubjects: TutorSubject[] = []
  let nextTutorSubjectId = 1

  for (const l of params.listings) {
    profileMap.set(l.profile.userId, l.profile)
    for (const s of l.subjects) {
      tutorSubjects.push({
        id: nextTutorSubjectId++,
        tutorProfileId: l.profile.id,
        subjectId: s.id,
        hourlyPrice: s.hourlyPrice,
        levels: s.levels,
        topics: s.topics,
      })
    }
  }

  if (params.tutorProfileRes) {
    const ownProfile = params.tutorProfileRes.profile
    profileMap.set(ownProfile.userId, ownProfile)
    // Replace any directory copy for this tutor with their authoritative profile subjects.
    const filtered = tutorSubjects.filter((ts) => ts.tutorProfileId !== ownProfile.id)
    tutorSubjects.length = 0
    tutorSubjects.push(...filtered)
    for (const s of params.tutorProfileRes.subjects) {
      tutorSubjects.push({
        id: nextTutorSubjectId++,
        tutorProfileId: ownProfile.id,
        subjectId: s.id,
        hourlyPrice: s.hourlyPrice,
        levels: s.levels,
        topics: s.topics,
      })
    }
  }

  const availabilityMap = new Map<number, Availability>()
  for (const l of params.listings) {
    for (const a of l.availabilities) {
      availabilityMap.set(a.id, a)
    }
  }
  if (params.tutorSchedule && params.currentUser) {
    for (const [id, a] of availabilityMap.entries()) {
      if (a.tutorId === params.currentUser.id) availabilityMap.delete(id)
    }
    for (const a of params.tutorSchedule.availabilities) {
      availabilityMap.set(a.id, a)
    }
  }

  const bookings =
    params.tutorSchedule && params.bookings.length === 0 ? params.tutorSchedule.bookings : params.bookings

  return {
    users: [...userMap.values()],
    credentials: {},
    subjects: params.subjects,
    tutorProfiles: [...profileMap.values()],
    tutorSubjects,
    availabilities: [...availabilityMap.values()],
    bookings,
    nextIds: { user: 1, tutorProfile: 1, tutorSubject: nextTutorSubjectId, availability: 1, booking: 1 },
  }
}

export function MockAppProvider({
  children,
  mode = defaultMode(),
}: {
  children: ReactNode
  mode?: 'api' | 'mock'
}) {
  const store = useMemo(() => browserStore(), [])
  const [state, setState] = useState<AppState>(() =>
    mode === 'mock' ? loadState(store, new Date()) : { db: emptyDb(), currentUserId: null },
  )
  const [apiUser, setApiUser] = useState<User | null>(null)
  const [apiSummary, setApiSummary] = useState<AdminSummary>(EMPTY_ADMIN_SUMMARY)
  const [authReady, setAuthReady] = useState(() => mode === 'mock' || !getStoredToken())
  const [simulateConflict, setSimulateConflict] = useState(false)

  // Actions read the latest state from here so back-to-back async calls never
  // compute from a stale render's snapshot.
  const stateRef = useRef(state)
  const apiUserRef = useRef(apiUser)

  const commit = useCallback(
    (next: AppState) => {
      stateRef.current = next
      setState(next)
      if (mode === 'mock') {
        saveState(store, next)
      }
    },
    [mode, store],
  )

  const hydrateFromApi = useCallback(
    async (user: User | null) => {
      const [subjects, approvedTutors, listings, bookings, tutorProfileRes, tutorSchedule, summary] = await Promise.all([
        httpClient.getSubjects().catch(() => [] as MockDb['subjects']),
        httpClient.getApprovedTutors().catch(() => [] as PublicTutorOption[]),
        httpClient.listTutorDirectory({}).catch(() => [] as api.TutorListing[]),
        user ? httpClient.listBookings().catch(() => [] as Booking[]) : Promise.resolve([] as Booking[]),
        user?.role === 'TUTOR' ? httpClient.getTutorProfile().catch(() => null) : Promise.resolve(null),
        user?.role === 'TUTOR' ? httpClient.getTutorAvailability().catch(() => null) : Promise.resolve(null),
        user?.role === 'ADMIN' ? httpClient.getAdminSummary().catch(() => EMPTY_ADMIN_SUMMARY) : Promise.resolve(EMPTY_ADMIN_SUMMARY),
      ])

      const nextDb = buildDbFromApi({
        currentUser: user,
        subjects,
        approvedTutors,
        listings,
        bookings,
        tutorProfileRes,
        tutorSchedule,
      })

      apiUserRef.current = user
      setApiUser(user)
      setApiSummary(summary)
      commit({ db: nextDb, currentUserId: user?.id ?? null })
    },
    [commit],
  )

  // Restore JWT session (or hydrate public directory data) on initial load in API mode.
  useEffect(() => {
    if (mode !== 'api') return
    let active = true
    const token = getStoredToken()
    ;(async () => {
      if (!token) {
        await hydrateFromApi(null)
        return
      }
      try {
        const { user } = await httpClient.getCurrentUser()
        if (!active) return
        await hydrateFromApi(user)
      } catch {
        setStoredToken(null)
        if (!active) return
        apiUserRef.current = null
        setApiUser(null)
        setApiSummary(EMPTY_ADMIN_SUMMARY)
        commit({ db: emptyDb(), currentUserId: null })
      } finally {
        if (active) setAuthReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [mode, hydrateFromApi, commit])

  // Another tab committed in mock mode: show its data here. The signed-in user stays per tab.
  useEffect(() => {
    if (mode !== 'mock') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const db = readLatestDb(store, stateRef.current.db)
      if (db === stateRef.current.db) return
      const next = { ...stateRef.current, db }
      stateRef.current = next
      setState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [mode, store])

  const actor = useCallback((): User => {
    if (mode === 'api') {
      if (!apiUserRef.current) throw new api.ApiError(401, 'Sign in to continue.')
      return apiUserRef.current
    }
    const { db, currentUserId } = stateRef.current
    const user = db.users.find((u) => u.id === currentUserId)
    if (!user) throw new api.ApiError(401, 'Sign in to continue.')
    return user
  }, [mode])

  const mutate = useCallback(
    <T,>(fn: (db: MockDb) => api.Mutation<T>): T => {
      const result = fn(readLatestDb(store, stateRef.current.db))
      commit({ ...stateRef.current, db: result.db })
      return result.data
    },
    [commit, store],
  )

  const value = useMemo<MockAppValue>(() => {
    const currentUser =
      mode === 'api' ? apiUser : (state.db.users.find((u) => u.id === state.currentUserId) ?? null)
    const adminSummary = mode === 'api' ? apiSummary : computeAdminSummary(state.db)

    return {
      mode,
      authReady,
      db: state.db,
      currentUser,
      adminSummary,
      simulateConflict,
      setSimulateConflict,

      login: async (email, password) => {
        if (mode === 'api') {
          const { user } = await httpClient.login(email, password)
          await hydrateFromApi(user)
          return user
        }
        const user = api.login(readLatestDb(store, stateRef.current.db), email, password)
        commit({ ...stateRef.current, currentUserId: user.id })
        return user
      },
      logout: () => {
        if (mode === 'api') {
          httpClient.logout()
          apiUserRef.current = null
          setApiUser(null)
          setApiSummary(EMPTY_ADMIN_SUMMARY)
          commit({ db: emptyDb(), currentUserId: null })
          return
        }
        commit({ ...stateRef.current, currentUserId: null })
      },
      registerStudent: async (req) => {
        if (mode === 'api') {
          const { user } = await httpClient.registerStudent(req)
          await hydrateFromApi(user)
          return user
        }
        const user = mutate((db) => api.registerStudent(db, req, new Date()))
        commit({ ...stateRef.current, currentUserId: user.id })
        return user
      },
      verifyEmail: async () => {
        if (mode === 'api') {
          actor()
          const { user } = await httpClient.verifyEmail()
          await hydrateFromApi(user)
          return user
        }
        const me = actor()
        return mutate((db) => api.verifyEmail(db, me.id, new Date()))
      },
      resetPassword: async (email, newPassword) => {
        if (mode === 'api') {
          await httpClient.resetPassword(email, newPassword)
          return
        }
        mutate((db) => api.resetPassword(db, email, newPassword))
      },
      switchDemoUser: (userId) => commit({ ...stateRef.current, currentUserId: userId }),

      updateTutorProfile: async (req) => {
        if (mode === 'api') {
          const me = actor()
          const res = await httpClient.updateTutorProfile(req)
          await hydrateFromApi(me)
          return res.profile
        }
        const me = actor()
        return mutate((db) => api.updateTutorProfile(db, me, req, new Date()))
      },
      createAvailability: async (req) => {
        if (mode === 'api') {
          const me = actor()
          const created = await httpClient.createAvailability(req)
          await hydrateFromApi(me)
          return created
        }
        const me = actor()
        return mutate((db) => api.createAvailability(db, me, req, new Date()))
      },
      deleteAvailability: async (id) => {
        if (mode === 'api') {
          const me = actor()
          await httpClient.deleteAvailability(id)
          await hydrateFromApi(me)
          return
        }
        const me = actor()
        mutate((db) => api.deleteAvailability(db, me, id))
      },

      createBookingWithMockPayment: async (req) => {
        if (mode === 'api') {
          const me = actor()
          await wait(MOCK_PAYMENT_DELAY_MS)
          if (simulateConflict) {
            throw new api.ApiError(409, api.CONFLICT_MESSAGE)
          }

          const rawMap = new Map(
            (req.attachmentFiles ?? []).map((f) => [attachmentKey({ name: f.name, size: f.size, type: f.type }), f]),
          )
          const uploadedIds: number[] = [...(req.attachmentIds ?? [])]
          for (const meta of req.attachments ?? []) {
            if (meta.id !== undefined) {
              uploadedIds.push(meta.id)
              continue
            }
            const rawFile = rawMap.get(attachmentKey(meta))
            const uploaded = await httpClient.uploadAttachment(rawFile ?? meta)
            if (uploaded.id !== undefined) uploadedIds.push(uploaded.id)
          }

          const booking = await httpClient.createBooking({
            tutorId: req.tutorId,
            subjectId: req.subjectId,
            startTime: req.startTime,
            durationHours: req.durationHours,
            notes: req.notes,
            attachmentIds: uploadedIds,
          })
          await hydrateFromApi(me)
          return booking
        }
        const me = actor()
        await wait(MOCK_PAYMENT_DELAY_MS)
        // The whole check-pay-insert step runs on the state as it is *now*,
        // after the delay, like the server's serialisable transaction.
        return mutate((db) => api.createBooking(db, me, req, { now: new Date(), simulateConflict }))
      },
      fetchDirectory: async (filters: DirectoryFilters) => {
        if (mode === 'api') {
          return httpClient.listTutorDirectory(filters)
        }
        return api.listTutorDirectory(stateRef.current.db, { now: new Date(), ...filters })
      },
      fetchBookingById: async (bookingId: number) => {
        if (mode === 'api') {
          return httpClient.getBookingById(bookingId)
        }
        const me = actor()
        return api.getBookingById(stateRef.current.db, me, bookingId)
      },
      resetToSeedData: () => {
        setSimulateConflict(false)
        if (mode === 'api') {
          void hydrateFromApi(apiUserRef.current)
          return
        }
        commit({ db: createSeedDb(new Date()), currentUserId: stateRef.current.currentUserId })
      },
    }
  }, [mode, authReady, apiUser, apiSummary, state, simulateConflict, commit, mutate, actor, store, hydrateFromApi])

  return <MockAppContext.Provider value={value}>{children}</MockAppContext.Provider>
}
