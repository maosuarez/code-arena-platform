"use client"

import type React from "react"
import { AuthProvider } from "@/hooks/useAuth"
import { TeamCodeProvider } from "@/hooks/useTeamCode"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TeamCodeProvider>{children}</TeamCodeProvider>
    </AuthProvider>
  )
}
