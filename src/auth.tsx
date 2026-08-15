import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api/services'
import { AUTH_EXPIRED_EVENT } from './api/client'
import { clearStoredToken, getStoredToken, storeToken } from './api/storage'
import { queryClient } from './query-client'
import type { AppUser } from './types'

interface AuthContextValue {
  isAuthenticated: boolean
  initializing: boolean
  user: AppUser | null
  login: (login: string, password: string, remember: boolean) => Promise<void>
  logout: () => void
}

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
