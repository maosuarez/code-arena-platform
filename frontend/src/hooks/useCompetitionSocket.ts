import { useEffect, useRef } from "react"
import mqtt, { MqttClient } from "mqtt"

type SocketMessage = {
  event: string
  data: Record<string, unknown>
}

// Ver useWsHealth: reintentar tras un error de auth solo dispara el ban por
// flapping del broker, que luego aparece como "connack timeout".
function isFatalMqttError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("not authorized") || m.includes("bad username or password")
}

export function useCompetitionSocket(
  competitionId: string,
  onMessage: (msg: SocketMessage) => void
) {
  const clientRef = useRef<MqttClient | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!competitionId) return

    const wsUrl =
      process.env.NEXT_PUBLIC_MQTT_WS_URL || "wss://localhost:8083/mqtt"
    const topicPrefix =
      process.env.NEXT_PUBLIC_MQTT_TOPIC_PREFIX || "code-arena"
    const topic = `${topicPrefix}/ranking/${competitionId}`

    const client = mqtt.connect(wsUrl, {
      reconnectPeriod: 10000,
      connectTimeout: 8000,
      clean: true,
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME || undefined,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || undefined,
    })

    client.on("connect", () => {
      client.subscribe(topic)
    })

    client.on("error", (err) => {
      console.warn("[CompetitionSocket] MQTT error:", err.message)
      if (isFatalMqttError(err.message)) {
        console.error("[CompetitionSocket] MQTT auth no recuperable, deteniendo reconexión.")
        client.end(true)
      }
    })

    client.on("message", (_topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString()) as SocketMessage
        onMessageRef.current(msg)
      } catch {
        // mensaje malformado, ignorar
      }
    })

    clientRef.current = client

    return () => {
      client.unsubscribe(topic)
      client.end()
    }
  }, [competitionId])
}
