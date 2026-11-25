import { describe, expect, it } from 'vitest'
import { createSeedDb } from '../../data/seedData'
import { computeAdminSummary } from './adminSummary'

const db = createSeedDb(new Date(2026, 10, 12, 8))

describe('computeAdminSummary (F-07)', () => {
  it('summarises the seed school', () => {
    // Seed: 2 bookings (฿400 + ฿600), 2 approved tutors, Charlie verified, Diana not.
    expect(computeAdminSummary(db)).toEqual({
      totalBookings: 2,
      mockRevenue: 1000,
      activeTutors: 2,
      verifiedStudents: 1,
      totalStudents: 2,
    })
  })

  it('leaves cancelled bookings out of revenue but still counts them', () => {
    const withCancelled = {
      ...db,
      bookings: db.bookings.map((b, i) => (i === 0 ? { ...b, status: 'CANCELLED' as const } : b)),
    }
    const summary = computeAdminSummary(withCancelled)
    expect(summary.totalBookings).toBe(2)
    expect(summary.mockRevenue).toBe(600)
  })

  it('does not count unapproved tutors as active', () => {
    const pending = { ...db, users: db.users.map((u) => (u.name === 'Bob' ? { ...u, isApproved: false } : u)) }
    expect(computeAdminSummary(pending).activeTutors).toBe(1)
  })

  it('retains revenue for cancelled bookings with 50% or 0% refunds (DEF-08, F-15, STS-15.3)', () => {
    const withPartialRefunds = {
      ...db,
      bookings: [
        { ...db.bookings[0], id: 101, status: 'CONFIRMED' as const, totalPrice: 400 },
        { ...db.bookings[0], id: 102, status: 'CANCELLED' as const, totalPrice: 400, refundAmount: 200, refundPercentage: 50 },
        { ...db.bookings[0], id: 103, status: 'CANCELLED' as const, totalPrice: 400, refundAmount: 0, refundPercentage: 0 },
        { ...db.bookings[0], id: 104, status: 'CANCELLED' as const, totalPrice: 400, refundAmount: 400, refundPercentage: 100 },
      ],
    }
    const summary = computeAdminSummary(withPartialRefunds)
    expect(summary.totalBookings).toBe(4)
    expect(summary.mockRevenue).toBe(1000)
  })
})
