"use client"
import { useApiHealth } from "@/hooks/useApiHealth"

export function ApiHealthBanner() {
  const isConnected = useApiHealth()
  if (isConnected) return null
  return (
    <div className="w-full bg-destructive text-destructive-foreground text-center text-sm py-2 px-4">
      Sin conexion con el servidor. Verifica tu conexion o intentalo mas tarde.
    </div>
  )
}
