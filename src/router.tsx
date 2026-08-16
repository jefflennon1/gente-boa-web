import { createContext, type AnchorHTMLAttributes, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

interface RouterContextValue {
  pathname: string
  search: string
  navigate: (to: string, options?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

const normalizePathname = (pathname: string) => pathname.replace(/\/$/, '') || '/'
const currentLocation = () => ({ pathname: normalizePathname(window.location.pathname), search: window.location.search })

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(currentLocation)

  useEffect(() => {
    const onPopState = () => setLocation(currentLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const target = new URL(to, window.location.origin)
    const next = { pathname: normalizePathname(target.pathname), search: target.search }
    const current = currentLocation()
    if (next.pathname === current.pathname && next.search === current.search && target.hash === window.location.hash) return
    window.history[options?.replace ? 'replaceState' : 'pushState']({}, '', `${next.pathname}${next.search}${target.hash}`)
    setLocation(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const value = useMemo(() => ({ pathname: location.pathname, search: location.search, navigate }), [location, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const value = useContext(RouterContext)
  if (!value) throw new Error('useRouter precisa ser usado dentro de RouterProvider')
  return value
}

export function NavLink({ to, end = false, className, children, onClick, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & { to: string; end?: boolean; className?: string | ((state: { isActive: boolean }) => string) }) {
  const { pathname, navigate } = useRouter()
  const isActive = end ? pathname === to : (pathname === to || (to !== '/' && pathname.startsWith(`${to}/`)))
  const resolvedClassName = typeof className === 'function' ? className({ isActive }) : className
  return (
    <a
      {...props}
      href={to}
      className={resolvedClassName}
      aria-current={isActive ? 'page' : undefined}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
