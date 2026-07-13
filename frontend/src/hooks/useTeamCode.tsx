"use client"

// hooks/useTeamCode.tsx
import { createContext, useContext, useState, useEffect } from "react"
import type React from "react"

interface TeamCodeContextValue {
  teamCode: string
  setTeamCode: React.Dispatch<React.SetStateAction<string>>
}

const TeamCodeContext = createContext<TeamCodeContextValue | null>(null)

export function TeamCodeProvider({ children }: { children: React.ReactNode }) {
  const [teamCode, setTeamCode] = useState('')

  useEffect(() => {
    const storedTeamCode = localStorage.getItem("teamCode") || ''
    setTeamCode(storedTeamCode)
  }, [])

  return (
    <TeamCodeContext.Provider value={{ teamCode, setTeamCode }}>
      {children}
    </TeamCodeContext.Provider>
  )
}

export function useTeamCode(): TeamCodeContextValue {
  const ctx = useContext(TeamCodeContext)
  if (!ctx) {
    throw new Error("useTeamCode must be used inside <TeamCodeProvider>")
  }
  return ctx
}
