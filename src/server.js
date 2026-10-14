const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const DB = path.join(__dirname, "../packet-db.json");

let database = { messages: [] };

if (fs.existsSync(DB)) {
  try {
    database = JSON.parse(fs.readFileSync(DB, "utf8"));
    if (!Array.isArray(database.messages)) {
      throw new Error("Invalid database");
    }
  } catch (error) {
    console.error("Cannot load Packet database:", error.message);
    process.exit(1);
  }
}

function save() {
  const temporary = DB + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(database, null, 2), {
    mode: 0o600
  });
  fs.renameSync(temporary, DB);
}

const clients = new Map();

const server = new WebSocket.Server({
  port: PORT,
  host: "127.0.0.1"
});

function send(socket, packet) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(packet));
  }
}

function deliver(username) {
  const socket = clients.get(username);
  if (!socket) return;

  for (const message of database.messages) {
    if (message.to !== username || message.delivered) continue;

    send(socket, {
      type: "chat.message",
      id: message.id,
      from: message.from,
      text: message.text,
      timestamp: message.timestamp
    });

    // Marked as sent, not yet confirmed by the recipient.
    message.delivered = true;
  }

  save();
}

server.on("connection", (socket) => {
  let username = null;

  socket.on("message", (raw) => {
    let packet;

    try {
      packet = JSON.parse(raw.toString());
    } catch {
      send(socket, {
        type: "error",
        message: "Invalid JSON"
      });
      return;
    }

    if (packet.type === "register") {
      const name = packet.username;

      if (
        typeof name !== "string" ||
        !/^[a-zA-Z0-9_-]{1,32}$/.test(name)
      ) {
        send(socket, {
          type: "error",
          message: "Invalid username"
        });
        return;
      }

      if (clients.has(name) && clients.get(name) !== socket) {
        send(socket, {
          type: "error",
          message: "Username already connected"
        });
        return;
      }

      if (username && clients.get(username) === socket) {
        clients.delete(username);
      }

      username = name;
      clients.set(username, socket);

      send(socket, {
        type: "registered",
        username
      });

      deliver(username);

      console.log(`📦 @${username} connected`);
      return;
    }

    if (packet.type === "chat.message") {
      if (!username) {
        send(socket, {
          type: "error",
          message: "Register first"
        });
        return;
      }

      if (
        typeof packet.to !== "string" ||
        !/^[a-zA-Z0-9_-]{1,32}$/.test(packet.to) ||
        typeof packet.text !== "string" ||
        !packet.text.trim() ||
        packet.text.length > 4096
      ) {
        send(socket, {
          type: "error",
          message: "Invalid recipient or message"
        });
        return;
      }

      const message = {
        id: require("crypto").randomUUID(),
        from: username,
        to: packet.to,
        text: packet.text,
        timestamp: Date.now(),
        delivered: false
      };

      database.messages.push(message);
      save();

      send(socket, {
        type: "queued",
        to: packet.to,
        id: message.id
      });

      deliver(packet.to);
      return;
    }

    if (packet.type === "inbox") {
      if (!username) {
        send(socket, {
          type: "error",
          message: "Register first"
        });
        return;
      }

      const messages = database.messages.filter(
        (message) => message.to === username
      );

      send(socket, {
        type: "inbox",
        messages
      });
    }
  });

  socket.on("close", () => {
    if (username && clients.get(username) === socket) {
      clients.delete(username);
      console.log(`📦 @${username} disconnected`);
    }
  });
});

console.log(`📦 Packet server running on 127.0.0.1:${PORT}`);
