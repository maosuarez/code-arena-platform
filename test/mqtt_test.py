#!/usr/bin/env python3
"""
Test de conexión MQTT sobre WebSocket (WSS).
Publica un mensaje en el topic de ranking y escucha la respuesta.

Uso:
    pip install paho-mqtt
    python mqtt_test.py

Variables de entorno (o editar directamente abajo):
    MQTT_WS_URL   — wss://mqtt.tudominio.com/mqtt
    MQTT_USER     — usuario EMQX
    MQTT_PASS     — password EMQX
    MQTT_TOPIC    — topic a probar (default: code-arena/ranking/test)
"""

import json
import os
import ssl
import time
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

WS_URL   = os.getenv("MQTT_WS_URL",  "wss://mqtt.maosuarez.com/mqtt")
USER     = os.getenv("MQTT_USER",    "")
PASS     = os.getenv("MQTT_PASS",    "")
TOPIC    = os.getenv("MQTT_TOPIC",   "code-arena/ranking/test")

received = []


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0 or str(reason_code) == "Success":
        print(f"[+] Conectado a {WS_URL}")
        client.subscribe(TOPIC)
        print(f"[+] Suscrito a: {TOPIC}")
    else:
        print(f"[-] Fallo de conexión: {reason_code}")


def on_message(client, userdata, msg):
    payload = msg.payload.decode()
    received.append(payload)
    print(f"[+] Mensaje recibido en '{msg.topic}': {payload}")


def on_disconnect(client, userdata, flags, reason_code=None, properties=None):
    if reason_code and str(reason_code) != "Normal disconnection":
        print(f"[!] Desconexión inesperada: {reason_code}")


def main():
    # Parsear URL → host, port, path
    url = WS_URL
    scheme = "wss" if url.startswith("wss://") else "ws"
    url = url.removeprefix("wss://").removeprefix("ws://")
    host, _, rest = url.partition("/")
    path = "/" + rest if rest else "/mqtt"
    port = 443 if scheme == "wss" else 8083

    print(f"[*] Host: {host}  Port: {port}  Path: {path}  TLS: {scheme == 'wss'}")

    client = mqtt.Client(
        callback_api_version=CallbackAPIVersion.VERSION2,
        client_id="code-arena-test-py",
        transport="websockets",
        protocol=mqtt.MQTTv311,
    )
    client.ws_set_options(path=path, headers={"Host": host})

    if scheme == "wss":
        ctx = ssl.create_default_context()
        client.tls_set_context(ctx)

    if USER:
        client.username_pw_set(USER, PASS)

    client.on_connect    = on_connect
    client.on_message    = on_message
    client.on_disconnect = on_disconnect

    client.connect(host, port, keepalive=30)
    client.loop_start()

    # Esperar conexión
    time.sleep(2)

    if not client.is_connected():
        print("[-] No se pudo conectar. Revisa URL, credenciales y que EMQX esté corriendo.")
        client.loop_stop()
        return

    # Publicar mensaje de prueba
    payload = json.dumps({
        "event": "ranking_update",
        "data":  {"test": True, "source": "mqtt_test.py"},
    })
    result = client.publish(TOPIC, payload, qos=1)
    result.wait_for_publish(timeout=5)
    print(f"[+] Mensaje publicado (mid={result.mid})")

    # Esperar para recibir el propio mensaje (necesita que el broker haga eco o
    # que otro cliente esté suscrito; aquí verificamos que llegue al menos uno)
    time.sleep(2)

    client.loop_stop()
    client.disconnect()

    if received:
        print(f"\n[OK] Test PASADO — {len(received)} mensaje(s) recibido(s)")
    else:
        print("\n[!] No se recibieron mensajes. La publicación fue exitosa pero")
        print("    el broker no devolvió el mensaje a este cliente.")
        print("    Esto es normal si el broker no tiene 'retain' o el loop fue muy corto.")


if __name__ == "__main__":
    main()
