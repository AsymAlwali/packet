const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const DB = path.join(__dirname, "../packet-db.json");
const KEYS = path.join(__dirname, "../packet-keys.json");

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveJSON(file, data) {
  const temp = file + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), {
    mode: 0o600
  });
  fs.renameSync(temp, file);
}

const database = readJSON(DB, { messages: [] });
const identities = readJSON(KEYS, {});
const clients = new Map();

function send(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function deliver(username) {
  const socket = clients.get(username);
  if (!socket) return;

  let changed = false;

  for (const message of database.messages) {
    if (message.to !== username || message.delivered) continue;

    send(socket, {
      type: "chat.message",
      id: message.id,
      from: message.from,
      text: message.text,
      timestamp: message.timestamp
    });

    message.delivered = true;
    changed = true;
  }

  if (changed) saveJSON(DB, database);
}

const server = new WebSocket.Server({
  host: "127.0.0.1",
  port: PORT,
  maxPayload: 16384
});

server.on("connection", (socket) => {
  let username = null;
  let pending = null;

  const timer = setTimeout(() => {
    if (!username) socket.close(1008, "Authentication timeout");
  }, 15000);

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
        identities[name] &&
        identities[name] !== normalized
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

      if (!identities[name]) {
        identities[name] = pending.publicKey;
        saveJSON(KEYS, identities);
      }

      username = name;
      pending = null;
      clearTimeout(timer);

      clients.set(username, socket);

      send(socket, {
        type: "authenticated",
        username
      });

      deliver(username);

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

      database.messages.push(message);
      saveJSON(DB, database);

      send(socket, {
        type: "queued",
        to: packet.to,
        id: message.id
      });

      deliver(packet.to);
      return;
    }

    if (packet.type === "inbox") {
      send(socket, {
        type: "inbox",
        messages: database.messages.filter(
          message => message.to === username
        )
      });
    }
  });

  socket.on("close", () => {
    clearTimeout(timer);

    if (username && clients.get(username) === socket) {
      clients.delete(username);
      console.log(`📦 @${username} disconnected`);
    }
  });
});

console.log(`🔐 Packet authenticated server on 127.0.0.1:${PORT}`);
