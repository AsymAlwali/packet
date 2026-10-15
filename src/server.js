const WebSocket = require("ws");
const crypto = require("crypto");
const path = require("path");
const { createStorage } = require("./storage");

const PORT = Number(process.env.PORT || 8787);
const STORAGE_FILE = process.env.PACKET_DB ||
  path.join(__dirname, "../packet.sqlite");

const storage =
  process.env.PACKET_STORAGE === "convex"
    ? require("./convex-storage").createConvexStorage(
        process.env.CONVEX_SITE_URL,
        process.env.PACKET_RELAY_SECRET
      )
    : createStorage(STORAGE_FILE);
const clients = new Map();
const delivering = new Set();

function send(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

async function deliver(username) {
  if (delivering.has(username)) return;

  const socket = clients.get(username);
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  delivering.add(username);

  try {
    const messages = await storage.getPendingMessages(username);

    for (const message of messages) {
      if (
        clients.get(username) !== socket ||
        socket.readyState !== WebSocket.OPEN
      ) {
        break;
      }

      send(socket, {
        type: "chat.message",
        id: message.id,
        from: message.from,
        text: message.text,
        timestamp: message.timestamp
      });
    }
  } finally {
    delivering.delete(username);
  }
}

const express = require("express");
const http = require("node:http");

const app = express();

app.get("*health", (req, res) => {
  res.json({
    name: "Packet",
    status: "ok",
    version: "0.1"
  });
});

const httpServer = http.createServer(app);

const server = new WebSocket.Server({
  server: httpServer,
  maxPayload: 16384
});

server.on("connection", (socket) => {
  let username = null;
  let pending = null;

  const timer = setTimeout(() => {
    if (!username) socket.close(1008, "Authentication timeout");
  }, 15000);

  let queue = Promise.resolve();

  socket.on("message", (raw) => {
    queue = queue.then(
      () => handlePacket(raw)
    ).catch(error => {
      console.error("Packet handler error:", error);
      send(socket, {
        type: "error",
        message: "Internal server error"
      });
      socket.close();
    });
  });

  async function handlePacket(raw) {
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

    if (packet.type === "auth.begin") {
      if (username || pending) {
        send(socket, {
          type: "error",
          message: "Authentication already started"
        });
        return;
      }

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

      if (
        clients.has(name) &&
        clients.get(name) !== socket
      ) {
        send(socket, {
          type: "error",
          message: "Username already connected"
        });
        return;
      }

      let publicKey;

      try {
        publicKey = crypto.createPublicKey(packet.publicKey);

        if (publicKey.asymmetricKeyType !== "ed25519") {
          throw new Error("Expected Ed25519 key");
        }
      } catch {
        send(socket, {
          type: "error",
          message: "Invalid public key"
        });
        return;
      }

      const normalized = publicKey.export({
        type: "spki",
        format: "pem"
      });

      if (
        (await storage.getIdentity(name)) &&
        (await storage.getIdentity(name)) !== normalized
      ) {
        send(socket, {
          type: "error",
          message: "Username belongs to another identity"
        });
        return;
      }

      pending = {
        username: name,
        publicKey: normalized,
        challenge: crypto.randomBytes(32).toString("hex"),
        expires: Date.now() + 10000
      };

      send(socket, {
        type: "auth.challenge",
        challenge: pending.challenge
      });

      return;
    }

    if (packet.type === "auth.prove") {
      if (!pending || username) {
        send(socket, {
          type: "error",
          message: "No pending authentication"
        });
        return;
      }

      if (Date.now() > pending.expires) {
        pending = null;
        send(socket, {
          type: "error",
          message: "Challenge expired"
        });
        socket.close();
        return;
      }

      let valid = false;

      try {
        const signature = Buffer.from(
          packet.signature,
          "base64"
        );

        valid = crypto.verify(
          null,
          Buffer.from(pending.challenge),
          pending.publicKey,
          signature
        );
      } catch {
        valid = false;
      }

      if (!valid) {
        pending = null;
        send(socket, {
          type: "error",
          message: "Invalid signature"
        });
        socket.close();
        return;
      }

      const name = pending.username;

      if (
        clients.has(name) &&
        clients.get(name) !== socket
      ) {
        send(socket, {
          type: "error",
          message: "Username already connected"
        });
        socket.close();
        return;
      }

      try {
        await storage.registerIdentity(name, pending.publicKey);
      } catch {
        send(socket, {
          type: "error",
          message: "Identity registration failed"
        });
        socket.close();
        return;
      }

      username = name;
      pending = null;
      clearTimeout(timer);

      clients.set(username, socket);

      send(socket, {
        type: "authenticated",
        username
      });

      await deliver(username);

      console.log(`🔐 @${username} authenticated`);
      return;
    }

    if (!username) {
      send(socket, {
        type: "error",
        message: "Authentication required"
      });
      return;
    }

    if (packet.type === "chat.message") {
      if (
        typeof packet.to !== "string" ||
        !/^[a-zA-Z0-9_-]{1,32}$/.test(packet.to) ||
        typeof packet.text !== "string" ||
        !packet.text.trim() ||
        packet.text.length > 4096
      ) {
        send(socket, {
          type: "error",
          message: "Invalid message"
        });
        return;
      }

      const message = {
        id: crypto.randomUUID(),
        from: username,
        to: packet.to,
        text: packet.text,
        timestamp: Date.now(),
        delivered: false
      };

      await storage.saveMessage(message);

      send(socket, {
        type: "queued",
        to: packet.to,
        id: message.id
      });

      await deliver(packet.to);
      return;
    }

    if (packet.type === "chat.ack") {
      if (typeof packet.id !== "string") return;

      if (await storage.acknowledgeMessage(packet.id, username)) {
        console.log("✓ Acknowledged:", packet.id);
      }
      return;
    }

    if (packet.type === "inbox") {
      send(socket, {
        type: "inbox",
        messages: await storage.getInbox(username)
      });
    }
  }

  socket.on("close", () => {
    clearTimeout(timer);

    if (username && clients.get(username) === socket) {
      clients.delete(username);
      console.log(`📦 @${username} disconnected`);
    }
  });
});

if (require.main === module) {
  httpServer.listen(PORT, process.env.HOST || "0.0.0.0", () => {
    console.log("📦 Packet listening on port " + PORT);
  });
}

module.exports = httpServer;

const reconciliationTimer = setInterval(() => {
  for (const username of clients.keys()) {
    deliver(username).catch(error => {
      console.error(
        `Delivery reconciliation failed for @${username}:`,
        error
      );
    });
  }
}, 3000);

reconciliationTimer.unref();
