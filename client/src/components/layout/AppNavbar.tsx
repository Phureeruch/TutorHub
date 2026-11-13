import { useEffect, useRef, useState } from 'react'
import { useCurrentUser, useMockApp } from '../../context/appContext'
import type { AppPath } from '../../routing/routes'
import type { Role } from '../../types/types'
import { initialsOf } from '../../utils/format'
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

/**
 * Profile icon that discloses who is signed in and the sign-out action. A
 * disclosure rather than an ARIA menu: it holds text as well as a button, and
 * Tab order stays natural.
 */
function AccountMenu() {
  const user = useCurrentUser()
  const { logout } = useMockApp()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      className="th-account"
      ref={rootRef}
      onBlur={(e) => {
        // Tabbing out of the panel closes it. A null relatedTarget is a click on
        // non-focusable text (inside or out); the pointerdown listener owns that.
        const next = e.relatedTarget as Node | null
        if (open && next && !rootRef.current?.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="th-avatar"
        aria-expanded={open}
        aria-controls={open ? 'th-account-panel' : undefined}
        aria-label={`Account: ${user.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{initialsOf(user.name)}</span>
      </button>
      {open && (
        <div id="th-account-panel" className="th-account-panel">
          <div className="th-account-who">
            <span className="th-avatar th-avatar-lg" aria-hidden="true">
              {initialsOf(user.name)}
            </span>
            <div>
              <p className="th-account-name">{user.name}</p>
              <p className="th-account-email">{user.email}</p>
              <span className="th-tag">{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
          <button type="button" className="btn btn-outline-ink w-100" onClick={logout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function AppNavbar({ currentPath }: { currentPath: string }) {
  const user = useCurrentUser()
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
        </div>
        <AccountMenu />
      </nav>
    </header>
  )
}
