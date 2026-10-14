#!/usr/bin/env node

const WebSocket = require("ws");

const URL = process.env.PACKET_SERVER || "ws://127.0.0.1:8787";

const [command, ...args] = process.argv.slice(2);

function connect(onOpen, onMessage) {
  const socket = new WebSocket(URL);

  socket.on("open", () => onOpen(socket));

  socket.on("message", (raw) => {
    try {
      onMessage(JSON.parse(raw.toString()), socket);
    } catch {
      console.error("Invalid server response");
    }
  });

  socket.on("error", (error) => {
    console.error("❌ Connection failed:", error.message);
    process.exitCode = 1;
  });

  return socket;
}

switch (command) {
  case "hello":
    console.log("📦 Hello from Packet!");
    console.log("Communication where work happens.");
    break;

  case "server":
    require("./server");
    break;

  case "listen": {
    const username = args[0]?.replace(/^@/, "");

    if (!username) {
      console.error("Usage: packet listen <username>");
      process.exit(1);
    }

    connect(
      (socket) => {
        socket.send(JSON.stringify({
          type: "register",
          username
        }));
      },
      (packet) => {
        if (packet.type === "registered") {
          console.log(`📦 Listening as @${packet.username}`);
          console.log("Waiting for messages...\n");
        }

        if (packet.type === "chat.message") {
          console.log(
            `\n📨 @${packet.from}: ${packet.text}`
          );
        }

        if (packet.type === "error") {
          console.error("❌", packet.message);
        }
      }
    );

    break;
  }

  case "send": {
    const to = args[0]?.replace(/^@/, "");
    const message = args.slice(1).join(" ");

    if (!to || !message.trim()) {
      console.error(
        'Usage: packet send <username> "message"'
      );
      process.exit(1);
    }

    const sender = process.env.PACKET_USER || "anonymous";

    let registered = false;

    const socket = connect(
      (socket) => {
        socket.send(JSON.stringify({
          type: "register",
          username: sender
        }));
      },
      (packet, socket) => {
        if (packet.type === "registered" && !registered) {
          registered = true;

          socket.send(JSON.stringify({
            type: "chat.message",
            to,
            text: message
          }));
        }

        if (packet.type === "delivered") {
          console.log(`📦 Delivered to @${packet.to}`);
          socket.close();
        }

        if (packet.type === "error") {
          console.error("❌", packet.message);
          process.exitCode = 1;
          socket.close();
        }
      }
    );

    break;
  }

  case "help":
  case "--help":
  default:
    console.log(`
📦 Packet CLI v0.2

Commands:
  packet hello
  packet server
  packet listen <username>
  packet send <username> "message"

Environment:
  PACKET_SERVER  WebSocket server URL
  PACKET_USER    Your sender username

Built for developers and AI agents.
`);
}
