"use client"
import { useEffect, useRef, useState } from "react"
import { apiRequest } from "@/lib/api"

export function useApiHealth(intervalMs = 30000) {
  const [isConnected, setIsConnected] = useState(true)
  const failCount = useRef(0)

  useEffect(() => {
    const check = async () => {
      try {
        await apiRequest("/health")
        failCount.current = 0
        setIsConnected(true)
        console.debug("[Health] Backend connected")
      } catch (err) {
        console.warn("[Health] Backend unreachable:", err instanceof Error ? err.message : err)
        failCount.current += 1
        if (failCount.current >= 2) setIsConnected(false)
      }
    }

    // Delay the first check so the backend has time to start
    const initial = setTimeout(check, 5000)
    const id = setInterval(check, intervalMs)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [intervalMs])

  return isConnected
}
