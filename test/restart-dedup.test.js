const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const WebSocket = require("ws");

test("CLI suppresses duplicate after restart", {
  timeout: 12000
}, async () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "packet-restart-")
  );

  const id = crypto.randomUUID();
  const marker = "PACKET_RESTART_TEST";
  const sockets = new Set();

  const server = new WebSocket.Server({
    host: "127.0.0.1",
    port: 0
  });

  server.on("connection", socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  try {
    await new Promise((resolve, reject) => {
      if (server.address()) return resolve();
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const port = server.address().port;

    async function runOnce() {
      let output = "";
      let ackCount = 0;
      let child;

      try {
        const ack = new Promise((resolve, reject) => {
          server.once("connection", socket => {
            socket.on("message", raw => {
              const packet = JSON.parse(raw.toString());

              if (packet.type === "auth.begin") {
                socket.send(JSON.stringify({
                  type: "auth.challenge",
                  challenge: crypto.randomBytes(32).toString("hex")
                }));
              }

              if (packet.type === "auth.prove") {
                socket.send(JSON.stringify({
                  type: "authenticated",
                  username: "testbob"
                }));

                socket.send(JSON.stringify({
                  type: "chat.message",
                  id,
                  from: "testalice",
                  text: marker
                }));
              }

              if (packet.type === "chat.ack") {
                ackCount++;
                resolve();
              }
            });

            socket.on("error", reject);
          });
        });

        child = spawn(
          process.execPath,
          ["src/cli.js", "--as", "testbob", "listen"],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              PACKET_SERVER: `ws://127.0.0.1:${port}`,
              PACKET_RECEIPTS_DIR: dir
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
          setTimeout(() => reject(
            new Error("ACK timeout. CLI output:\n" + output)
          ), 4000);
        });

        await Promise.race([ack, timeout]);

        await new Promise(resolve => setTimeout(resolve, 100));

        return { output, ackCount };
      } finally {
        if (child && child.exitCode === null) {
          child.kill("SIGKILL");
        }

        for (const socket of sockets) {
          socket.terminate();
        }
      }
    }

    const first = await runOnce();
    const second = await runOnce();

    const displays = (
      first.output + second.output
    ).split(marker).length - 1;

    assert.equal(displays, 1);
    assert.equal(first.ackCount, 1);
    assert.equal(second.ackCount, 1);

  } finally {
    for (const socket of sockets) {
      socket.terminate();
    }

    await new Promise(resolve => server.close(resolve));

    fs.rmSync(dir, {
      recursive: true,
      force: true
    });
  }
});
