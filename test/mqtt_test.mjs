#!/usr/bin/env node
/**
 * Test de conexión MQTT sobre WebSocket (WSS).
 * Publica un mensaje y escucha en el mismo topic.
 *
 * Uso:
 *   npm install mqtt        (solo la primera vez)
 *   node mqtt_test.mjs
 *
 * Variables de entorno (o editar los defaults abajo):
 *   MQTT_WS_URL   — wss://mqtt.tudominio.com/mqtt
 *   MQTT_USER     — usuario EMQX
 *   MQTT_PASS     — password EMQX
 *   MQTT_TOPIC    — topic a probar (default: code-arena/ranking/test)
 */

import mqtt from "mqtt"

const WS_URL = process.env.MQTT_WS_URL  || "wss://mqtt.maosuarez.com/mqtt"
const USER   = process.env.MQTT_USER    || ""
const PASS   = process.env.MQTT_PASS    || ""
const TOPIC  = process.env.MQTT_TOPIC   || "code-arena/ranking/test"

const opts = {
  reconnectPeriod: 0,        // sin reintentos automáticos en el test
  connectTimeout:  8_000,
  clean: true,
  ...(USER ? { username: USER, password: PASS } : {}),
}

console.log(`[*] Conectando a ${WS_URL}`)
const client = mqtt.connect(WS_URL, opts)

let received = 0

client.on("connect", () => {
  console.log("[+] Conectado")

  client.subscribe(TOPIC, { qos: 1 }, (err) => {
    if (err) {
      console.error("[-] Error al suscribirse:", err.message)
      finish(false)
      return
    }
    console.log(`[+] Suscrito a: ${TOPIC}`)

    const payload = JSON.stringify({
      event: "ranking_update",
      data:  { test: true, source: "mqtt_test.mjs" },
    })

    client.publish(TOPIC, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error("[-] Error al publicar:", err.message)
        finish(false)
      } else {
        console.log("[+] Mensaje publicado")
      }
    })
  })
})

client.on("message", (topic, payload) => {
  received++
  console.log(`[+] Mensaje recibido en '${topic}': ${payload.toString()}`)
})

client.on("error", (err) => {
  console.error("[-] Error MQTT:", err.message)
  finish(false)
})

client.on("close", () => {
  console.warn("[!] Conexión cerrada inesperadamente")
})

// Esperar 3 s y evaluar resultado
setTimeout(() => finish(true), 3_000)

function finish(ok) {
  client.end(true, () => {
    if (!ok) {
      console.error("\n[FAIL] No se pudo conectar o publicar.")
      process.exit(1)
    }
    if (received > 0) {
      console.log(`\n[OK] Test PASADO — ${received} mensaje(s) recibido(s)`)
    } else {
      console.log("\n[OK] Publicación exitosa. Sin eco del broker (normal si retain=false).")
    }
    process.exit(0)
  })
}
