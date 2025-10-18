import { WebSocketServer, WebSocket } from "ws";
import http from "http";

interface Message {
  type: "join" | "chat" | "leave" | "system";
  payload: any;
}

const server = http.createServer();
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ server });

console.log(`✅ WebSocket Server starting on port ${PORT}...`);

const rooms: Map<string, Set<WebSocket>> = new Map();
const userInfo: Map<WebSocket, { username: string; roomId: string }> = new Map();

function broadcast(roomId: string, data: any, excludeSocket?: WebSocket) {
  const clients = rooms.get(roomId);
  if (!clients) return;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN && client !== excludeSocket) {
      client.send(JSON.stringify(data));
    }
  }
}

wss.on("connection", (socket) => {
  let currentRoom: string | null = null;
  let currentUser: string | null = null;

  socket.on("message", (message) => {
    let parsed: Message;
    try {
      parsed = JSON.parse(message.toString());
    } catch {
      socket.send(JSON.stringify({ type: "error", payload: "Invalid JSON" }));
      return;
    }

    switch (parsed.type) {
      case "join": {
        const { roomId, username } = parsed.payload;

        if (!rooms.has(roomId)) rooms.set(roomId, new Set());
        rooms.get(roomId)!.add(socket);
        currentRoom = roomId;
        currentUser = username;
        userInfo.set(socket, { username, roomId });

        console.log(`👤 ${username} joined room ${roomId}`);

        broadcast(roomId, {
          type: "system",
          payload: `${username} joined the room.`,
        });

        break;
      }

      case "chat": {
        if (!currentRoom) {
          socket.send(JSON.stringify({ type: "error", payload: "Join a room first." }));
          return;
        }

        const { username, message } = parsed.payload;
        console.log(`💬 ${username}: ${message}`);

        broadcast(currentRoom, {
          type: "chat",
          payload: { username, message },
        });

        break;
      }

      case "leave": {
        const { username, roomId } = parsed.payload;
        if (rooms.has(roomId)) {
          rooms.get(roomId)!.delete(socket);
          broadcast(roomId, {
            type: "system",
            payload: `${username} has left the room.`,
          });
          userInfo.delete(socket);
          if (rooms.get(roomId)!.size === 0) rooms.delete(roomId);
        }
        socket.close();
        break;
      }

      default:
        socket.send(JSON.stringify({ type: "error", payload: "Unknown message type." }));
    }
  });

  socket.on("close", () => {
    const info = userInfo.get(socket);
    if (info && rooms.has(info.roomId)) {
      rooms.get(info.roomId)!.delete(socket);
      broadcast(info.roomId, {
        type: "system",
        payload: `${info.username} has left the room.`,
      });
      userInfo.delete(socket);
      if (rooms.get(info.roomId)!.size === 0) {
        rooms.delete(info.roomId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket Server running on port ${PORT}`);
});
