// hooks/useAuth.ts
import { useState, useEffect } from "react"

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Simula verificación de autenticación
    const authStatus = localStorage.getItem("auth") === "true"
    setIsAuthenticated(authStatus)
  }, [])

  return { isAuthenticated, setIsAuthenticated }
}
