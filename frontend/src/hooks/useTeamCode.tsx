// hooks/useTeamCode.ts
import { useState, useEffect } from "react"

export function useTeamCode() {
  const [teamCode, setTeamCode] = useState('')

  useEffect(() => {
    // Simula verificación de autenticación
    const authStatus = localStorage.getItem("teamCode") || ''
    setTeamCode(authStatus)
  }, [])

  return { teamCode, setTeamCode }
}
