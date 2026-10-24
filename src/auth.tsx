import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api/services'
import { AUTH_EXPIRED_EVENT } from './api/client'
import { clearStoredToken, getStoredToken, replaceStoredToken, storeToken } from './api/storage'
import { queryClient } from './query-client'
import type { AppUser } from './types'

interface AuthContextValue {
  isAuthenticated: boolean
  initializing: boolean
  user: AppUser | null
  login: (login: string, password: string, remember: boolean) => Promise<void>
  logout: () => void
}

const SESSION_REFRESH_INTERVAL_MS = 3 * 60_000

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [initializing, setInitializing] = useState(() => Boolean(getStoredToken()))

  const logout = useCallback(() => {
    clearStoredToken()
    setUser(null)
    queryClient.clear()
  }, [])

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return

    let active = true
    api.auth.me()
      .then((currentUser) => active && setUser(currentUser))
      .catch(() => active && logout())
      .finally(() => active && setInitializing(false))
    return () => { active = false }
  }, [logout])

  // Sessão deslizante: enquanto houver atividade do usuário, o token é renovado periodicamente.
  useEffect(() => {
    if (!user) return
    let lastActivity = Date.now()
    let lastRefresh = Date.now()
    const markActivity = () => { lastActivity = Date.now() }
    const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    activityEvents.forEach((name) => window.addEventListener(name, markActivity, { passive: true }))
    const timer = window.setInterval(() => {
      if (lastActivity <= lastRefresh || !getStoredToken()) return
      lastRefresh = Date.now()
      api.auth.refresh().then((response) => replaceStoredToken(response.accessToken)).catch(() => undefined)
    }, SESSION_REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
      activityEvents.forEach((name) => window.removeEventListener(name, markActivity))
    }
  }, [user])

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout)
  }, [logout])

  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated: Boolean(user),
    initializing,
    user,
    login: async (login, password, remember) => {
      const response = await api.auth.login(login.trim(), password)
      storeToken(response.accessToken, remember)
      setUser(response.user)
      setInitializing(false)
    },
    logout,
  }), [initializing, logout, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa ser usado dentro de AuthProvider')
  return value
}
