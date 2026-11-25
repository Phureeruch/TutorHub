import type { AdminSummary, MockDb } from '../../types/types'

export type { AdminSummary }

export function computeAdminSummary(db: MockDb): AdminSummary {
  const students = db.users.filter((u) => u.role === 'STUDENT')
  return {
    totalBookings: db.bookings.length,
    // Revenue is what was actually kept: confirmed lessons, plus retained portion of cancelled lessons (DEF-08).
    mockRevenue: db.bookings.reduce((sum, b) => {
      if (b.status !== 'CANCELLED') return sum + b.totalPrice
      const refund = b.refundAmount !== undefined && b.refundAmount !== null ? b.refundAmount : b.totalPrice
      return sum + Math.max(0, b.totalPrice - refund)
    }, 0),
    activeTutors: db.users.filter((u) => u.role === 'TUTOR' && u.isApproved).length,
    verifiedStudents: students.filter((u) => u.isEmailVerified).length,
    totalStudents: students.length,
  }
}
