from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/ranking/{competition_id}")
async def websocket_ranking(websocket: WebSocket, competition_id: str):
    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()  # Mantener conexión viva
    except WebSocketDisconnect:
        pass
