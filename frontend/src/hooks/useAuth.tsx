// hooks/useAuth.ts
import { useState, useEffect } from "react"
import { apiRequest } from "@/lib/api"

interface AuthUser {
  id: string
  username: string
  email: string
  teamCode: string | null
  is_admin: boolean
}

export function useAuth() {
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

  return { isAuthenticated, setIsAuthenticated, isLoading, currentUser }
}
