const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const cli = fs.readFileSync("src/cli.js", "utf8");

test("CLI uses persistent message receipts", () => {
  assert.match(cli, /require\(["']\.\/message-receipts["']\)/);
  assert.match(cli, /createMessageReceipts\(identity\.username\)/);
});

test("CLI checks duplicates before displaying messages", () => {
  const check = cli.indexOf("dedup.isDuplicate(packet.id)");
  const handler = cli.indexOf("onPacket(packet, socket)");

  assert.ok(check >= 0);
  assert.ok(handler > check);
});

test("CLI acknowledges duplicate deliveries", () => {
  const start = cli.indexOf("dedup.isDuplicate(packet.id)");
  const end = cli.indexOf("onPacket(packet, socket)", start);

  const handler = cli.slice(start, end);
  assert.match(handler, /chat\.ack/);
  assert.match(handler, /return;/);
});

test("CLI syntax is valid", () => {
  const result = spawnSync(
    process.execPath,
    ["--check", "src/cli.js"],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
});
