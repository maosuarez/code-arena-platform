// hooks/useAuth.ts
import { useState, useEffect } from "react"
import { apiRequest } from "@/lib/api"

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setIsAuthenticated(false)
      setIsLoading(false)
      return
    }

    apiRequest("/auth/verify", { method: "GET", token: true })
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        localStorage.removeItem("token")
        localStorage.removeItem("auth")
        setIsAuthenticated(false)
      })
      .finally(() => setIsLoading(false))
  }, [])

  return { isAuthenticated, setIsAuthenticated, isLoading }
}
