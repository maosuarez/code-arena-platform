"use client"

// hooks/useAuth.tsx
import { createContext, useContext, useState, useEffect } from "react"
import type React from "react"
import { apiRequest } from "@/lib/api"

export interface AuthUser {
  id: string
  username: string
  email: string
  teamCode: string | null
  is_admin: boolean
}

interface AuthContextValue {
  isAuthenticated: boolean
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>
  isLoading: boolean
  currentUser: AuthUser | null
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setIsAuthenticated(false)
      setIsLoading(false)
      return
    }

    apiRequest<AuthUser>("/auth/verify", { method: "GET", token: true })
      .then((user) => {
        setIsAuthenticated(true)
        setCurrentUser(user)
      })
      .catch(() => {
        localStorage.removeItem("token")
        localStorage.removeItem("auth")
        setIsAuthenticated(false)
        setCurrentUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated, isLoading, currentUser, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>")
  }
  return ctx
}
