# Vroom - FastAPI WebSocket Chat Application

## Overview

Vroom is a real-time chat application built with FastAPI and WebSocket, allowing users to create and join chat rooms. This application supports creating rooms with passwords, joining existing rooms, and exchanging messages in real-time.

## Features

- **Create Rooms**: Users can create new chat rooms with a password.
- **Join Rooms**: Users can join existing rooms by entering the room ID and password.
- **Real-Time Messaging**: Users can send and receive messages in real-time within rooms.
- **User Management**: Each user has a unique username within a room.
- **Error Handling**: Provides user feedback in case of errors.

## Installation

### Prerequisites

Ensure you have Python 3.7+ installed on your system.

### Setup

1. **Clone the Repository**

    ```bash
    git clone https://github.com/yourusername/vroom.git
    cd vroom
    ```

2. **Install Dependencies**

    ```bash
    pip install -r requirements.txt
    ```

3. **Run the Application**

    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```

    The application will be accessible at `http://127.0.0.1:8000`.

## Usage

- **Home Page**: Accessible at the root URL (`/`). Allows users to create new rooms or join existing ones.
- **Create Room**: Fill out the username and password, then click "Create Room".
- **Join Room**: Enter the Room ID, username, and password, then click "Join Room".
- **Chat Room**: After joining, users can send and receive messages in real-time.

## Preview:

<br/>

![home](https://github.com/emvouvakis/Vroom/blob/main/static/images/home.png?raw=true)

![room](https://github.com/emvouvakis/Vroom/blob/main/static/images/room.png?raw=true)

