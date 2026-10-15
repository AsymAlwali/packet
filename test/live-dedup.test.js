const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const WebSocket = require("ws");

test("Live CLI displays duplicate once and ACKs twice", {
  timeout: 15000
}, async () => {
  const server = new WebSocket.Server({
    host: "127.0.0.1",
    port: 0
  });

  const address = await new Promise((resolve, reject) => {
    if (server.address()) return resolve(server.address());
    server.once("listening", () => resolve(server.address()));
    server.once("error", reject);
  });

  const port = address.port;
  const acks = [];
  const challenge = crypto.randomBytes(32).toString("hex");
  const messageId = crypto.randomUUID();

  let output = "";
  let child;

  try {
    const finished = new Promise((resolve, reject) => {
      server.on("connection", socket => {
        socket.on("message", raw => {
          const packet = JSON.parse(raw.toString());

          if (packet.type === "auth.begin") {
            socket.send(JSON.stringify({
              type: "auth.challenge",
              challenge
            }));
          }

          if (packet.type === "auth.prove") {
            socket.send(JSON.stringify({
              type: "authenticated",
              username: "testbob"
            }));

            const message = JSON.stringify({
              type: "chat.message",
              id: messageId,
              from: "testalice",
              text: "PACKET_DEDUP_TEST"
            });

            socket.send(message);
            socket.send(message);
          }

          if (packet.type === "chat.ack") {
            acks.push(packet.id);

            if (acks.length === 2) {
              resolve();
            }
          }
        });
      });
    });

    child = spawn(
      process.execPath,
      ["src/cli.js", "listen", "testbob"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PACKET_SERVER: `ws://127.0.0.1:${port}`
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    child.stdout.on("data", chunk => {
      output += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      output += chunk.toString();
    });

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(
        "Timed out waiting for two ACKs. CLI output:\n" + output
      )), 10000);
    });

    await Promise.race([finished, timeout]);

    await new Promise(resolve => setTimeout(resolve, 100));

    const displays =
      output.match(/PACKET_DEDUP_TEST/g) || [];

    assert.equal(displays.length, 1,
      "Message should display exactly once");

    assert.deepEqual(acks, [messageId, messageId],
      "Both deliveries should receive ACKs");

  } finally {
    if (child) child.kill();
    await new Promise(resolve => server.close(resolve));
  }
});
