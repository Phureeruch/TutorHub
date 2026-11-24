import { useEffect, useState } from 'react'
import { AdminBookingsView } from './components/admin/AdminBookingsView'
import { AdminSubjectsView } from './components/admin/AdminSubjectsView'
import { AdminTutorsView } from './components/admin/AdminTutorsView'
import { AppErrorBoundary } from './components/layout/AppErrorBoundary'
import { AuthView } from './components/auth/AuthView'
import { EmailVerificationBanner } from './components/auth/EmailVerificationBanner'
import { AppNavbar } from './components/layout/AppNavbar'
import { DemoToolbar } from './components/layout/DemoToolbar'
import { StudentBookingsView } from './components/student/StudentBookingsView'
import { StudentDiscoveryView } from './components/student/StudentDiscoveryView'
import { TutorDashboardView } from './components/tutor/TutorDashboardView'
import { useMockApp } from './context/appContext'
import { MockAppProvider } from './context/MockAppContext'
import { STORAGE_KEY } from './context/persistence'
import { resolveRoute, type AppPath } from './routing/routes'
import { useAppRoute } from './routing/useAppRoute'

function renderView(path: AppPath) {
  switch (path) {
    case '/login':
      return <AuthView mode="login" />
    case '/register':
      return <AuthView mode="register" />
    case '/student/discover':
      return <StudentDiscoveryView />
    case '/student/bookings':
      return <StudentBookingsView />
    case '/tutor/dashboard':
      return <TutorDashboardView section="availability" />
    case '/tutor/profile':
      return <TutorDashboardView section="profile" />
    case '/tutor/appointments':
      return <TutorDashboardView section="appointments" />
    case '/admin/bookings':
      return <AdminBookingsView />
    case '/admin/tutors':
      return <AdminTutorsView />
    case '/admin/subjects':
      return <AdminSubjectsView />
  }
}

function Shell() {
  const { authReady, currentUser } = useMockApp()
  const { pathname, navigate } = useAppRoute()
  const resolved = resolveRoute(pathname, currentUser)

  // Keep the address bar honest after a guard redirect (sign-in, sign-out, wrong role),
  // waiting for initial token restoration in API mode so refreshes stay on their route.
  useEffect(() => {
    if (!authReady) return
    if (resolved !== pathname) navigate(resolved, { replace: true })
  }, [authReady, resolved, pathname, navigate])

  if (!authReady) {
    return (
      <main id="main" className="th-page">
        <p className="text-muted-ink">Loading session…</p>
      </main>
    )
  }

  const showDemoToolbar =
    !import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEMO_TOOLBAR === 'true'

  return (
    <>
      <a className="th-skip" href="#main">
        Skip to content
      </a>
      {showDemoToolbar && <DemoToolbar />}
      {currentUser && <AppNavbar currentPath={resolved} />}
      {currentUser && <EmailVerificationBanner key={currentUser.id} />}
      <div id="main">{renderView(resolved)}</div>
    </>
  )
}

export default function App() {
  // Bumping this remounts the provider, which then reloads (now empty) storage as seed data.
  const [epoch, setEpoch] = useState(0)

  const resetSavedData = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage blocked: the remount still starts from seed data in memory.
    }
    setEpoch((n) => n + 1)
  }

  return (
    <AppErrorBoundary onReset={resetSavedData}>
      <MockAppProvider key={epoch}>
        <Shell />
      </MockAppProvider>
    </AppErrorBoundary>
  )
}
