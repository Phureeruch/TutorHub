import type { Role, User } from '../types/types'

export const PUBLIC_PATHS = ['/login', '/register'] as const

export const ROLE_PATHS = {
  STUDENT: ['/student/discover', '/student/bookings'],
  TUTOR: ['/tutor/dashboard', '/tutor/profile', '/tutor/appointments'],
  ADMIN: ['/admin/bookings', '/admin/tutors', '/admin/subjects'],
} as const satisfies Record<Role, readonly string[]>

export type PublicPath = (typeof PUBLIC_PATHS)[number]
export type RolePath = (typeof ROLE_PATHS)[Role][number]
export type AppPath = PublicPath | RolePath

export function homePathFor(role: Role): RolePath {
  return ROLE_PATHS[role][0]
}

const normalize = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname)

const isPublic = (path: string): path is PublicPath => (PUBLIC_PATHS as readonly string[]).includes(path)

/** FR-03 / BR-03: the page a visitor may actually see for the URL they asked for. */
export function resolveRoute(pathname: string, user: User | null): AppPath {
  const path = normalize(pathname)
  if (!user) return isPublic(path) ? path : '/login'
  const owned: readonly string[] = ROLE_PATHS[user.role]
  return owned.includes(path) ? (path as RolePath) : homePathFor(user.role)
}
