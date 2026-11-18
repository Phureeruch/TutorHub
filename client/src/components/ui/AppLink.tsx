import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import type { AppPath } from '../../routing/routes'
import { navigate } from '../../routing/useAppRoute'

interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: AppPath
}

/** A real <a href> (so open-in-new-tab works) that navigates in-app on a plain click. */
export function AppLink({ to, onClick, ...rest }: AppLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handleClick} {...rest} />
}
