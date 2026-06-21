from fastapi import WebSocket
from typing import List, Dict, Any, Union

class ConnectionManager:
    """
    Manages active WebSocket connections for the AgenticForge real-time streaming layer.
    Follows a strict, stateless 'State Broadcast' approach with least complexity.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accepts a new WebSocket connection and adds it to the active pool."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """Removes a WebSocket connection from the active pool."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: Union[str, Dict[str, Any]], websocket: WebSocket):
        """
        Sends a message to a specific client. 
        Automatically handles serializing dictionaries to JSON.
        """
        if isinstance(message, dict):
            await websocket.send_json(message)
        else:
            await websocket.send_text(message)

# Global instance to be imported and used across the websocket routes
manager = ConnectionManager()
