const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8787);

const server = new WebSocket.Server({ port: PORT });
const clients = new Map();

server.on("connection", (socket) => {
  let username = null;

  socket.on("message", (raw) => {
    let packet;

    try {
      packet = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (packet.type === "register") {
      if (
        typeof packet.username !== "string" ||
        !/^[a-zA-Z0-9_-]{1,32}$/.test(packet.username)
      ) {
        socket.send(JSON.stringify({
          type: "error",
          message: "Invalid username"
        }));
        return;
      }

      if (
        clients.has(packet.username) &&
        clients.get(packet.username) !== socket
      ) {
        socket.send(JSON.stringify({
          type: "error",
          message: "Username already connected"
        }));
        return;
      }

      if (username) clients.delete(username);

      username = packet.username;
      clients.set(username, socket);

      socket.send(JSON.stringify({
        type: "registered",
        username
      }));

      console.log(`📦 ${username} connected`);
    }

    if (packet.type === "chat.message") {
      const recipient = clients.get(packet.to);

      if (!username) {
        socket.send(JSON.stringify({
          type: "error",
          message: "Register before sending"
        }));
        return;
      }

      if (
        typeof packet.text !== "string" ||
        !packet.text.trim() ||
        packet.text.length > 4096
      ) {
        socket.send(JSON.stringify({
          type: "error",
          message: "Invalid message"
        }));
        return;
      }

      if (recipient && recipient.readyState === WebSocket.OPEN) {
        recipient.send(JSON.stringify({
          type: "chat.message",
          from: username,
          text: packet.text,
          timestamp: Date.now()
        }));

        socket.send(JSON.stringify({
          type: "delivered",
          to: packet.to
        }));
      } else {
        socket.send(JSON.stringify({
          type: "error",
          message: "Recipient is offline"
        }));
      }
    }
  });

  socket.on("close", () => {
    if (username && clients.get(username) === socket) {
      clients.delete(username);
      console.log(`📦 ${username} disconnected`);
    }
  });
});

console.log(`📦 Packet server listening on port ${PORT}`);
