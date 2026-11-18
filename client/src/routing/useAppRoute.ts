import { useSyncExternalStore } from 'react'
import type { AppPath } from './routes'

// pushState does not fire popstate, so in-app navigation announces itself.
const NAVIGATE_EVENT = 'tutorhub:navigate'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

const getPathname = () => window.location.pathname

export function navigate(path: AppPath, { replace = false }: { replace?: boolean } = {}): void {
  if (window.location.pathname === path) return
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
  if (!replace) window.scrollTo(0, 0)
}

/** Minimal typed router over the History API (plan §3.1). */
export function useAppRoute(): { pathname: string; navigate: typeof navigate } {
  const pathname = useSyncExternalStore(subscribe, getPathname, () => '/')
  return { pathname, navigate }
}
