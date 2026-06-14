import json
import os
import ssl
import aiomqtt

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_WS_PORT = int(os.getenv("MQTT_WS_PORT", "443"))
MQTT_WS_PATH = os.getenv("MQTT_WS_PATH", "/mqtt")
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_TOPIC_PREFIX = os.getenv("MQTT_TOPIC_PREFIX", "code-arena")

# Contexto TLS reutilizable para wss://
_tls_context = ssl.create_default_context()


class MQTTManager:
    async def broadcast(self, competition_id: str, message: dict):
        try:
            async with aiomqtt.Client(
                hostname=MQTT_HOST,
                port=MQTT_WS_PORT,
                transport="websockets",
                websocket_path=MQTT_WS_PATH,
                websocket_headers={"Host": MQTT_HOST},
                tls_context=_tls_context,
                username=MQTT_USERNAME,
                password=MQTT_PASSWORD,
            ) as client:
                topic = f"{MQTT_TOPIC_PREFIX}/ranking/{competition_id}"
                await client.publish(topic, json.dumps(message), qos=1)
        except Exception:
            # No bloquear la petición HTTP si MQTT no está disponible
            pass


manager = MQTTManager()
