import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { areCredentialsValid } from './auth-credentials'

const SESSION_KEY = 'gente-boa-auth-session'
const PERSISTENT_KEY = 'gente-boa-auth-persistent'

interface AuthContextValue {
  isAuthenticated: boolean
  login: (username: string, password: string, remember: boolean) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(() =>
    sessionStorage.getItem(SESSION_KEY) === 'authenticated' ||
    localStorage.getItem(PERSISTENT_KEY) === 'authenticated',
  )

  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated,
    login: (username, password, remember) => {
      const credentialsMatch = areCredentialsValid(username, password)
      if (!credentialsMatch) return false

      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(PERSISTENT_KEY)
      if (remember) localStorage.setItem(PERSISTENT_KEY, 'authenticated')
      else sessionStorage.setItem(SESSION_KEY, 'authenticated')
      setAuthenticated(true)
      return true
    },
    logout: () => {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(PERSISTENT_KEY)
      setAuthenticated(false)
    },
  }), [isAuthenticated])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa ser usado dentro de AuthProvider')
  return value
}
