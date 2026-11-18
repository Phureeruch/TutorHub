import { describe, expect, it } from 'vitest'
import { createSeedDb } from '../data/seedData'
import { homePathFor, resolveRoute } from './routes'

const db = createSeedDb(new Date(2026, 10, 12, 8))
const user = (name: string) => db.users.find((u) => u.name === name)!

describe('homePathFor', () => {
  it.each([
    ['Charlie', '/student/discover'],
    ['Alice', '/tutor/dashboard'],
    ['Admin User', '/admin/bookings'],
  ])('sends %s to %s', (name, path) => {
    expect(homePathFor(user(name).role)).toBe(path)
  })
})

describe('resolveRoute (FR-03, BR-03)', () => {
  it('lets a signed-out visitor see the public pages', () => {
    expect(resolveRoute('/login', null)).toBe('/login')
    expect(resolveRoute('/register', null)).toBe('/register')
  })

  it('sends a signed-out visitor on a protected page to sign in', () => {
    expect(resolveRoute('/student/bookings', null)).toBe('/login')
  })

  it('sends a signed-in user away from sign-in to their home', () => {
    expect(resolveRoute('/login', user('Alice'))).toBe('/tutor/dashboard')
  })

  it('keeps a user on a page their role owns', () => {
    expect(resolveRoute('/student/bookings', user('Charlie'))).toBe('/student/bookings')
    expect(resolveRoute('/tutor/appointments', user('Bob'))).toBe('/tutor/appointments')
  })

  it.each([
    ['Charlie', '/admin/bookings', '/student/discover'],
    ['Alice', '/student/discover', '/tutor/dashboard'],
    ['Admin User', '/tutor/profile', '/admin/bookings'],
  ])('redirects %s away from %s', (name, path, expected) => {
    expect(resolveRoute(path, user(name))).toBe(expected)
  })

  it('treats unknown paths as home, or sign-in when signed out', () => {
    expect(resolveRoute('/nope', user('Charlie'))).toBe('/student/discover')
    expect(resolveRoute('/', null)).toBe('/login')
  })

  it('ignores a trailing slash', () => {
    expect(resolveRoute('/student/bookings/', user('Charlie'))).toBe('/student/bookings')
  })
})
