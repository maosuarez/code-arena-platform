// hooks/useToken.ts
import { useState, useEffect } from "react"

export function useToken() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    setToken(storedToken)
  }, [])

  return { token, setToken }
}
