import { WebSocketServer, WebSocket } from "ws";

interface Message {
  type: "join" | "chat" | "leave" | "system";
  payload: any;
}

const wss = new WebSocketServer({ port: 8080 });
console.log("✅ WebSocket Server started on port 8080");

const rooms: Map<string, Set<WebSocket>> = new Map();

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

        console.log(`👤 ${username || "User"} joined room ${roomId}`);

        broadcast(roomId, {
          type: "system",
          payload: `${username || "A user"} joined the room.`,
        });

        break;
      }

      case "chat": {
        if (!currentRoom) {
          socket.send(JSON.stringify({ type: "error", payload: "Join a room first." }));
          return;
        }

        const { username, message } = parsed.payload;
        console.log(`💬 ${username || "User"}: ${message}`);

        broadcast(currentRoom, {
          type: "chat",
          payload: { username, message },
        });

        break;
      }

      default:
        socket.send(JSON.stringify({ type: "error", payload: "Unknown message type." }));
    }
  });

  socket.on("close", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom)!.delete(socket);
      broadcast(currentRoom, {
        type: "system",
        payload: "A user has left the room.",
      });

      if (rooms.get(currentRoom)!.size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });
});
