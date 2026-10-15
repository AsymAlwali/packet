#!/usr/bin/env node

const WebSocket = require("ws");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const CONFIG_DIR = path.join(os.homedir(), ".packet");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const URL = process.env.PACKET_SERVER || "ws://127.0.0.1:8787";


const argv = process.argv.slice(2);
let selectedIdentity = null;

if (argv[0] === "--as") {
  selectedIdentity = argv[1];

  if (!selectedIdentity) {
    console.error("Usage: packet --as <identity> <command>");
    process.exit(1);
  }

  argv.splice(0, 2);
}

const [command, ...args] = argv;


function config() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function username() {
  try {
    return require("./identity").loadIdentity(selectedIdentity).username;
  } catch {
    return undefined;
  }
}

function validName(name) {
  return typeof name === "string" &&
    /^[a-zA-Z0-9_-]{1,32}$/.test(name);
}


function connect(onReady, onPacket) {
  const identity = require("./identity").loadIdentity(selectedIdentity);

  const socket = new WebSocket(URL);

  const { createMessageReceipts } = require("./message-receipts");
  const dedup = createMessageReceipts(identity.username);

  socket.on("close", () => {
    dedup.close();
  });

  socket.on("open", () => {
    socket.send(JSON.stringify({
      type: "auth.begin",
      username: identity.username,
      publicKey: identity.publicKey
    }));
  });

  socket.on("message", (raw) => {
    let packet;

    try {
      packet = JSON.parse(raw.toString());
    } catch {
      console.error("Invalid server response");
      return;
    }

    if (packet.type === "auth.challenge") {
      const signature =
        require("./identity").signChallenge(packet.challenge, selectedIdentity);

      socket.send(JSON.stringify({
        type: "auth.prove",
        signature
      }));

      return;
    }

    if (packet.type === "authenticated") {
      onReady(socket);
      return;
    }

    if (packet.type === "error") {
      console.error("❌", packet.message);
      process.exitCode = 1;
      socket.close();
      return;
    }

    if (packet.type === "chat.message" &&
        typeof packet.id === "string") {
      if (dedup.isDuplicate(packet.id)) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "chat.ack",
            id: packet.id
          }));
        }
        return;
      }
    }

    onPacket(packet, socket);
  });

  socket.on("error", (error) => {
    console.error("❌", error.message);
    process.exitCode = 1;
  });

  return socket;
}

switch (command) {

  case "identity": {
    const { createIdentity, listIdentities } =
      require("./identity");

    const action = args[0];

    if (action === "create") {
      const name = args[1];

      if (!name) {
        console.error("Usage: packet identity create <name>");
        process.exit(1);
      }

      try {
        createIdentity(name);
        console.log(`📦 Identity @${name} created!`);
      } catch (error) {
        console.error("❌", error.message);
        process.exitCode = 1;
      }

    } else if (action === "list") {
      console.log("📦 Packet identities:");

      for (const name of listIdentities()) {
        console.log(`  @${name}`);
      }

    } else {
      console.log("Usage: packet identity create <name>");
      console.log("       packet identity list");
    }

    break;
  }

  case "hello":
    console.log("📦 Hello from Packet!");
    break;

  case "server":
    require("./server");
    break;

  case "login": {
    const name = args[0];

    if (!validName(name)) {
      console.error("Usage: packet login <username>");
      process.exit(1);
    }

    fs.mkdirSync(CONFIG_DIR, {
      recursive: true,
      mode: 0o700
    });

    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ username: name }, null, 2),
      { mode: 0o600 }
    );

    console.log(`📦 Logged in locally as @${name}`);
    break;
  }

  case "whoami":
    console.log(username() ? `@${username()}` : "Not logged in");
    break;

  case "send": {
    const to = args[0]?.replace(/^@/, "");
    const text = args.slice(1).join(" ");

    if (!validName(to) || !text.trim()) {
      console.error('Usage: packet send <user> "message"');
      process.exit(1);
    }

    if (!username()) {
      console.error("Run: packet login <username>");
      process.exit(1);
    }

    connect(
      (socket) => {
        socket.send(JSON.stringify({
          type: "chat.message",
          to,
          text
        }));
      },
      (packet, socket) => {
        if (packet.type === "queued") {
          console.log(`📦 Message saved for @${packet.to}`);
          socket.close();
        }
      }
    );
    break;
  }

  case "listen": {
    if (!username()) {
      console.error("Run: packet login <username>");
      process.exit(1);
    }

    connect(
      () => {
        console.log(`📦 Listening as @${username()}`);
      },
      (packet, socket) => {
        if (packet.type === "chat.message") {
          console.log(`📨 @${packet.from}: ${packet.text}`);
          socket.send(JSON.stringify({
            type: "chat.ack",
            id: packet.id
          }));
        }
      }
    );
    break;
  }

  case "inbox": {
    if (!username()) {
      console.error("Run: packet login <username>");
      process.exit(1);
    }

    connect(
      (socket) => {
        socket.send(JSON.stringify({ type: "inbox" }));
      },
      (packet, socket) => {
        if (packet.type === "inbox") {
          console.log(`\n📥 Inbox for @${username()}\n`);

          if (!packet.messages.length) {
            console.log("No messages yet.");
          }

          for (const message of packet.messages) {
            console.log(
              `@${message.from}: ${message.text}`
            );
          }

          socket.close();
        }
      }
    );
    break;
  }

  case "chat": {
    const to = args[0]?.replace(/^@/, "");

    if (!validName(to) || !username()) {
      console.error(
        "Usage: packet chat <user> (login first)"
      );
      process.exit(1);
    }

    const socket = connect(
      () => {
        console.log(`📦 Chatting with @${to}`);
        console.log("Type /exit to leave.\n");

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          prompt: "you> "
        });

        rl.prompt();

        rl.on("line", (line) => {
          if (line.trim() === "/exit") {
            rl.close();
            socket.close();
            return;
          }

          if (line.trim()) {
            socket.send(JSON.stringify({
              type: "chat.message",
              to,
              text: line
            }));
          }

          rl.prompt();
        });
      },
      (packet, socket) => {
        if (packet.type === "chat.message") {
          console.log(`\n@${packet.from}> ${packet.text}`);
          socket.send(JSON.stringify({
            type: "chat.ack",
            id: packet.id
          }));
          process.stdout.write("you> ");
        }

        if (packet.type === "queued") {
          console.log(`\n✓ Sent to @${packet.to}`);
          process.stdout.write("you> ");
        }
      }
    );

    break;
  }

  case "--help":
  case "help":
  default:
    console.log(`
📦 Packet CLI v0.3

Commands:
  packet login <username>
  packet whoami
  packet server
  packet send <user> "message"
  packet listen
  packet inbox
  packet chat <user>
  packet hello

Environment:
  PACKET_SERVER   Server WebSocket URL
  PACKET_USER     Override local username
`);
}
