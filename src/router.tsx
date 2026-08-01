import { createContext, type AnchorHTMLAttributes, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

interface RouterContextValue {
  pathname: string
  navigate: (to: string, options?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

const currentPath = () => window.location.pathname.replace(/\/$/, '') || '/'

export function RouterProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(currentPath)

  useEffect(() => {
    const onPopState = () => setPathname(currentPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const normalized = to.replace(/\/$/, '') || '/'
    if (normalized === currentPath()) return
    window.history[options?.replace ? 'replaceState' : 'pushState']({}, '', normalized)
    setPathname(normalized)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const value = useMemo(() => ({ pathname, navigate }), [navigate, pathname])
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
