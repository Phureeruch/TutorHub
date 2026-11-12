import { useState } from 'react'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import type { AppPath } from '../../routing/routes'
import type { Role } from '../../types/types'
import { AppLink } from '../ui/AppLink'

const NAV_ITEMS: Record<Role, { to: AppPath; label: string }[]> = {
  STUDENT: [
    { to: '/student/discover', label: 'Find a tutor' },
    { to: '/student/bookings', label: 'My bookings' },
  ],
  TUTOR: [
    { to: '/tutor/dashboard', label: 'Availability' },
    { to: '/tutor/profile', label: 'Profile & rate' },
    { to: '/tutor/appointments', label: 'Appointments' },
  ],
  ADMIN: [{ to: '/admin/bookings', label: 'All bookings' }],
}

const ROLE_LABEL: Record<Role, string> = { STUDENT: 'Student', TUTOR: 'Tutor', ADMIN: 'Admin' }

export function AppNavbar({ currentPath }: { currentPath: string }) {
  const user = useCurrentUser()
  const { logout } = useMockApp()
  const [open, setOpen] = useState(false)

  return (
    <header className="th-nav">
      <nav className="th-nav-inner" aria-label="Main">
        <AppLink to={NAV_ITEMS[user.role][0].to} className="th-wordmark">
          TutorHub
        </AppLink>
        <button
          type="button"
          className="btn btn-outline-ink btn-sm d-md-none ms-auto"
          aria-expanded={open}
          aria-controls="th-nav-menu"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
        <div id="th-nav-menu" className={`th-nav-menu${open ? ' is-open' : ''}`}>
          <ul className="th-nav-links">
            {NAV_ITEMS[user.role].map((item) => (
              <li key={item.to}>
                <AppLink
                  to={item.to}
                  className="th-nav-link"
                  aria-current={currentPath === item.to ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </AppLink>
              </li>
            ))}
          </ul>
          <div className="th-nav-user">
            <span>
              {user.name} <span className="th-tag ms-1">{ROLE_LABEL[user.role]}</span>
            </span>
            <button type="button" className="btn btn-outline-ink btn-sm" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}
