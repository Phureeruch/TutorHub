import type { MockDb } from '../../types/types'

export interface AdminSummary {
  totalBookings: number
  mockRevenue: number
  activeTutors: number
  verifiedStudents: number
  totalStudents: number
}

export function computeAdminSummary(db: MockDb): AdminSummary {
  const students = db.users.filter((u) => u.role === 'STUDENT')
  return {
    totalBookings: db.bookings.length,
    // Revenue is what was actually kept: confirmed or completed lessons only.
    mockRevenue: db.bookings.filter((b) => b.status !== 'CANCELLED').reduce((sum, b) => sum + b.totalPrice, 0),
    activeTutors: db.users.filter((u) => u.role === 'TUTOR' && u.isApproved).length,
    verifiedStudents: students.filter((u) => u.isEmailVerified).length,
    totalStudents: students.length,
  }
}
