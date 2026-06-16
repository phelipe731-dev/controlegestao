import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getStoredToken, persistToken } from '../lib/api'
import type { CurrentUser } from '../types/api'

type AuthContextValue = {
  user: CurrentUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshSession: () => Promise<void>
  setUser: (user: CurrentUser | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function refreshSession() {
    const token = getStoredToken()

    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const { data } = await api.get<{ user: CurrentUser }>('/auth/session')
      setUser(data.user)
    } catch {
      clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshSession()
  }, [])

  async function login(email: string, password: string) {
    const { data } = await api.post<{ token: string; user: CurrentUser }>('/auth/login', { email, password })
    persistToken(data.token)
    setUser(data.user)
  }

  function logout() {
    clearToken()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshSession,
      setUser,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
