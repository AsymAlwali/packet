const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createMessageReceipts } =
  require("../src/message-receipts");

test("Receipts survive database reopening", () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "packet-receipts-")
  );

  try {
    const first = createMessageReceipts("testbob", { dir });

    assert.equal(first.isDuplicate("msg-001"), false);
    assert.equal(first.isDuplicate("msg-001"), true);

    first.close();

    const second = createMessageReceipts("testbob", { dir });

    assert.equal(second.isDuplicate("msg-001"), true);
    assert.equal(second.isDuplicate("msg-002"), false);

    second.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Receipts are isolated between identities", () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "packet-receipts-")
  );

  try {
    const alice = createMessageReceipts("testalice", { dir });
    const bob = createMessageReceipts("testbob", { dir });

    assert.equal(alice.isDuplicate("same-id"), false);
    assert.equal(bob.isDuplicate("same-id"), false);
    assert.equal(alice.isDuplicate("same-id"), true);

    alice.close();
    bob.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Invalid usernames are rejected", () => {
  assert.throws(() =>
    createMessageReceipts("../escape")
  );
});
