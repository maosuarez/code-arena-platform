"use client"
import { useEffect, useRef } from "react"
import mqtt from "mqtt"
import { toast } from "sonner"

const TOAST_ID = "ws-health"

// Errores de los que NO sirve reintentar: las credenciales/permisos no van a
// cambiar solos. Seguir reintentando solo dispara el ban por flapping de EMQX
// (que se manifiesta luego como "connack timeout").
function isFatalMqttError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("not authorized") || m.includes("bad username or password")
}

export function useWsHealth() {
  const hasShownToast = useRef(false)

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_MQTT_WS_URL || "wss://localhost:8083/mqtt"

    const client = mqtt.connect(wsUrl, {
      reconnectPeriod: 10000,
      connectTimeout: 8000,
      clean: true,
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME || undefined,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || undefined,
    })

    client.on("connect", () => {
      console.debug("[WsHealth] MQTT connected")
      if (hasShownToast.current) {
        toast.dismiss(TOAST_ID)
        toast.success("Actualizaciones en tiempo real restauradas.", {
          id: "ws-health-restored",
          duration: 3000,
        })
        hasShownToast.current = false
      }
    })

    client.on("error", (err) => {
      console.warn("[WsHealth] MQTT error:", err.message)
      if (isFatalMqttError(err.message)) {
        // No reconectar: evita el bucle de intentos que provoca el ban de EMQX.
        console.error("[WsHealth] MQTT auth no recuperable, deteniendo reconexión.")
        client.end(true)
        toast.error("Actualizaciones en tiempo real no disponibles (auth).", {
          id: TOAST_ID,
          duration: Infinity,
        })
        return
      }
      if (!hasShownToast.current) {
        hasShownToast.current = true
        toast.error("Actualizaciones en tiempo real no disponibles. Reintentando...", {
          id: TOAST_ID,
          duration: Infinity,
        })
      }
    })

    client.on("close", () => {
      console.warn("[WsHealth] MQTT connection closed")
      if (!hasShownToast.current) {
        hasShownToast.current = true
        toast.error("Actualizaciones en tiempo real no disponibles. Reintentando...", {
          id: TOAST_ID,
          duration: Infinity,
        })
      }
    })

    client.on("reconnect", () => {
      console.debug("[WsHealth] MQTT reconnecting...")
    })

    return () => {
      toast.dismiss(TOAST_ID)
      client.end()
    }
  }, [])
}
