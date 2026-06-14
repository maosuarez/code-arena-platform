import { useEffect, useRef } from "react"
import mqtt, { MqttClient } from "mqtt"

type SocketMessage = {
  event: string
  data: Record<string, unknown>
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
      process.env.NEXT_PUBLIC_MQTT_WS_URL || "ws://localhost:8083/mqtt"
    const topic = `code-arena/ranking/${competitionId}`

    const client = mqtt.connect(wsUrl, {
      reconnectPeriod: 3000,
      clean: true,
    })

    client.on("connect", () => {
      client.subscribe(topic)
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
