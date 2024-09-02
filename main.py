import uuid
import hashlib
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Form, Request, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from typing import List, Dict, Optional
import logging
import random
from datetime import datetime

# Configure logging to display info-level messages
logging.basicConfig(level=logging.INFO)

# Initialize the FastAPI app
app = FastAPI()

# Serve static files (e.g., CSS, JavaScript) from the 'static' directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up the Jinja2 template directory
templates = Jinja2Templates(directory="templates")

class ConnectionManager:
    """
    Manages WebSocket connections, rooms, and messages.
    Handles room creation, user connection/disconnection, and message broadcasting.
    """
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}  # Active WebSocket connections by room
        self.room_keys: Dict[str, str] = {}  # Mapping of room hashes to actual room IDs
        self.room_ids: Dict[str, str] = {}  # Mapping of room IDs to room hashes
        self.room_passwords: Dict[str, str] = {}  # Encrypted room passwords by room hash
        self.usernames: Dict[WebSocket, str] = {}  # Usernames associated with WebSocket connections
        self.pending_messages: Dict[str, List[Dict[str, str]]] = {}  # Store messages when only one user is in the room
    
    def generate_room_id(self, length=6):
        """Generate a unique room ID of specified length."""
        room_id = ''.join(random.choices('0123456789', k=length))
        logging.debug(f"Generated room ID: {room_id}")
        return room_id
    
    def create_room(self, password: str) -> str:
        """
        Create a new room with a password.
        Returns the room's hash, which serves as an identifier for joining.
        """
        room_id = self.generate_room_id()
        while room_id in self.room_ids:
            room_id = self.generate_room_id()
        
        room_hash = hashlib.sha256(room_id.encode()).hexdigest()  # Generate a unique hash for the room
        encrypted_password = hashlib.sha256(password.encode()).hexdigest()  # Encrypt the room password
        
        # Store mappings for room management
        self.room_keys[room_hash] = room_id
        self.room_ids[room_id] = room_hash
        self.room_passwords[room_hash] = encrypted_password
        self.pending_messages[room_id] = []  # Initialize an empty message list for the room

        logging.info(f"Created room with ID {room_id} and hash {room_hash}")
        
        return room_hash
    
    def get_room_id_from_hash(self, room_hash: str) -> Optional[str]:
        """Retrieve the room_id using the room_hash."""
        room_id = self.room_keys.get(room_hash)
        logging.debug(f"Retrieved room ID '{room_id}' from hash '{room_hash}'")
        return room_id

    async def connect(self, websocket: WebSocket, room_hash: str, username: str):
        """
        Connect a user to a room.
        Send any pending messages if this is the second user to join the room.
        """
        room_name = self.room_keys.get(room_hash)
        if room_name:
            if room_name not in self.rooms:
                self.rooms[room_name] = []
            self.rooms[room_name].append(websocket)
            self.usernames[websocket] = username
            
            logging.info(f"User '{username}' connected to room '{room_name}'")

            # Send pending messages if this is the second user joining
            if len(self.rooms[room_name]) == 2:
                for message in self.pending_messages[room_name]:
                    await websocket.send_text(json.dumps(message))
            
            # Clear pending messages after they are sent
            if len(self.rooms[room_name]) > 1:
                self.pending_messages[room_name] = []
            
            # Also send all pending messages to the new user
            if len(self.rooms[room_name]) == 1:
                for message in self.pending_messages[room_name]:
                    await websocket.send_text(json.dumps(message))
                self.pending_messages[room_name] = []

        else:
            logging.warning(f"Room hash '{room_hash}' not found or password incorrect.")
            await websocket.close()  # Close connection if room not found or password is incorrect

    def disconnect(self, websocket: WebSocket, room_hash: str):
        """
        Disconnect a user from a room.
        Remove them from the room and delete the room if it's empty.
        """
        room_name = self.room_keys.get(room_hash)
        if room_name:
            self.rooms[room_name].remove(websocket)
            del self.usernames[websocket]  # Remove the username mapping
            logging.info(f"User disconnected from room '{room_name}'")
            if not self.rooms[room_name]:
                del self.rooms[room_name]
                logging.info(f"Room '{room_name}' is now empty and has been deleted.")

    async def broadcast(self, message: Dict[str, str], room_hash: str):
        """
        Broadcast a message to all users in a room.
        If only one user is in the room, store the message to be sent later.
        """
        room_name = self.room_keys.get(room_hash)
        if room_name:
            timestamp = datetime.now().isoformat()  # Get the current timestamp in ISO format
            message['timestamp'] = timestamp
            logging.debug(f"Broadcasting message to room '{room_name}': {message}")
            # Store message if only one user is in the room
            if len(self.rooms[room_name]) == 1:
                self.pending_messages[room_name].append(message)
                # Also send the message to the sender
                await self.rooms[room_name][0].send_text(json.dumps(message))
            else:
                for connection in self.rooms.get(room_name, []):
                    await connection.send_text(json.dumps(message))

    def list_rooms(self) -> List[str]:
        """List all active rooms by their hashes."""
        rooms = list(self.room_keys.keys())
        logging.debug(f"Listing rooms: {rooms}")
        return rooms
    
    def get_connected_users(self, room_hash: str) -> List[str]:
        """Get a list of usernames connected to a specific room."""
        room_name = self.room_keys.get(room_hash)
        if room_name:
            users = [self.usernames.get(ws) for ws in self.rooms.get(room_name, [])]
            logging.debug(f"Users connected to room '{room_name}': {users}")
            return users
        return []

# Instantiate the connection manager
manager = ConnectionManager()

@app.get("/", response_class=HTMLResponse)
async def get_room_page(request: Request):
    """Render the home page showing a list of all active rooms."""
    rooms = manager.list_rooms()
    logging.info(f"Home page requested. Active rooms: {rooms}")
    return templates.TemplateResponse("home.html", {"request": request, "rooms": rooms})

@app.post("/create-room")
async def create_room(username: str = Form(...), password: str = Form(...)):
    """Handle the creation of a new room and redirect to the room's page."""
    room_hash = manager.create_room(password)
    logging.info(f"Room creation requested by '{username}'. Redirecting to room '{room_hash}'.")
    return RedirectResponse(url=f"/room/{room_hash}", status_code=302)

@app.get("/room/{room_hash}/users")
async def get_connected_users(room_hash: str):
    """Retrieve the list of users connected to a specific room."""
    users = manager.get_connected_users(room_hash)
    logging.info(f"Requested connected users for room '{room_hash}': {users}")
    return {"users": users}

@app.post("/join-room-by-id")
async def join_room_by_id(request: Request, room_id: str = Form(...), password: str = Form(...), username: str = Form(...)):
    """Handle the joining of a room by its ID, checking credentials and username."""
    # Validate and process the form data
    if not room_id or not password or not username:
        logging.warning("Join room form submission missing required fields.")
        return templates.TemplateResponse("home.html", {
            "request": request, 
            "error_message": "All fields are required."
        })

    # Look up the room_hash using the provided room_id
    room_hash = manager.room_ids.get(room_id)
    
    if not room_hash:
        logging.warning(f"Room ID '{room_id}' not found.")
        return templates.TemplateResponse("home.html", {
            "request": request, 
            "error_message": "Room ID not found."
        })

    encrypted_password = manager.room_passwords.get(room_hash)
    if encrypted_password != hashlib.sha256(password.encode()).hexdigest():
        logging.warning(f"Invalid password for room ID '{room_id}'.")
        return templates.TemplateResponse("home.html", {
            "request": request, 
            "error_message": "Invalid password."
        })

    # Check if the username already exists in the room
    room_name = manager.get_room_id_from_hash(room_hash)
    if room_name and any(manager.usernames.get(ws) == username for ws in manager.rooms.get(room_name, [])):
        logging.warning(f"Username '{username}' already taken in room '{room_name}'.")
        return templates.TemplateResponse("home.html", {
            "request": request, 
            "error_message": "Username already taken in this room."
        })

    # If no errors, redirect to the room
    logging.info(f"User '{username}' joining room '{room_hash}'.")
    response = RedirectResponse(url=f"/room/{room_hash}", status_code=302)
    return response

@app.get("/room/{room_hash}", response_class=HTMLResponse)
async def get_display_page(request: Request, room_hash: str):
    """Render the room page for a specific room."""
    username = request.query_params.get("username")
    logging.info(f"Room page requested. Room hash: {room_hash}, Username: {username}")

    # Retrieve room_id from room_hash using the method
    room_id = manager.get_room_id_from_hash(room_hash)
    
    if room_id is None:
        logging.warning(f"Room hash '{room_hash}' not found. Redirecting to home.")
        return RedirectResponse(url="/", status_code=302)  # Redirect if room_id is not found

    return templates.TemplateResponse("room.html", {"request": request, "room_id": room_id, "username": username, "room_hash": room_hash})

@app.websocket("/ws/{room_hash}")
async def websocket_endpoint(websocket: WebSocket, room_hash: str):
    """Handle WebSocket connections for real-time chat in rooms."""
    logging.info(f"WebSocket connection request received for room: {room_hash}")
    
    # Accept the WebSocket connection at the start
    try:
        await websocket.accept()
        logging.info("WebSocket connection accepted.")
    except Exception as e:
        logging.error(f"Error accepting WebSocket connection: {e}")
        await websocket.close(code=1011)  # Internal error
        return

    try:
        # Receive and process the authentication message
        auth_message = await websocket.receive_text()
        logging.info(f"Received authentication message: {auth_message}")
        auth_data = json.loads(auth_message)
        logging.info(f"Auth data processed: {auth_data}")

        if not isinstance(auth_data, dict):
            logging.error("Auth data is not a dictionary.")
            await websocket.close(code=1008)  # Unauthorized access
            return

        password = auth_data.get('password')
        username = auth_data.get('username')

        room_name = manager.room_keys.get(room_hash)
        if not room_name:
            logging.error("Room not found.")
            await websocket.close(code=1008)  # Room not found
            return

        encrypted_password = manager.room_passwords.get(room_hash)
        if encrypted_password != hashlib.sha256(password.encode()).hexdigest():
            logging.error("Password mismatch.")
            await websocket.close(code=1008)  # Unauthorized access
            return

        # Proceed to connect the user to the room
        await manager.connect(websocket, room_hash, username)
        logging.info(f"User '{username}' connected to room '{room_name}'.")

        # Main loop to handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                logging.info(f"Received data from WebSocket: {data}")
                message = json.loads(data)
                logging.info(f"Message processed: {message}")

                if not isinstance(message, dict):
                    logging.error("Message is not a dictionary.")
                    continue

                if message.get('type') == 'message':
                    await manager.broadcast({
                        'username': username,
                        'text': message.get('text')
                    }, room_hash)
                    logging.info(f"Broadcasted message from '{username}' to room '{room_name}'.")
            except WebSocketDisconnect:
                logging.info(f"WebSocket disconnected for room: {room_hash}")
                manager.disconnect(websocket, room_hash)
                break
            except Exception as e:
                logging.error(f"Error receiving message: {e}")
                await websocket.close(code=1011)  # Internal error
                break
    except json.JSONDecodeError:
        logging.error("Failed to decode JSON from WebSocket message.")
        await websocket.close(code=1008)  # Invalid JSON
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        await websocket.close(code=1011)  # Internal error

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
