const test = require("node:test");
const assert = require("node:assert/strict");
const { createMessageDeduplicator } =
  require("../src/message-dedup");

function simulateDelivery(dedup, packets) {
  const displayed = [];
  const acknowledgements = [];

  for (const packet of packets) {
    const duplicate = dedup.isDuplicate(packet.id);

    acknowledgements.push(packet.id);

    if (!duplicate) {
      displayed.push(packet.text);
    }
  }

  return { displayed, acknowledgements };
}

test("First delivery is accepted", () => {
  const dedup = createMessageDeduplicator();

  assert.equal(dedup.isDuplicate("msg-001"), false);
});

test("Second delivery of same ID is rejected", () => {
  const dedup = createMessageDeduplicator();

  dedup.isDuplicate("msg-001");

  assert.equal(dedup.isDuplicate("msg-001"), true);
});

test("Different message IDs are accepted", () => {
  const dedup = createMessageDeduplicator();

  assert.equal(dedup.isDuplicate("msg-001"), false);
  assert.equal(dedup.isDuplicate("msg-002"), false);
});

test("Duplicate message displays once but ACKs twice", () => {
  const dedup = createMessageDeduplicator();

  const result = simulateDelivery(dedup, [
    { id: "abc", text: "Hello Bob!" },
    { id: "abc", text: "Hello Bob!" }
  ]);

  assert.deepEqual(result.displayed, ["Hello Bob!"]);
  assert.deepEqual(result.acknowledgements, ["abc", "abc"]);
});

test("Cache evicts oldest IDs when full", () => {
  const dedup = createMessageDeduplicator(2);

  dedup.isDuplicate("A");
  dedup.isDuplicate("B");
  dedup.isDuplicate("C");

  assert.equal(dedup.isDuplicate("B"), true);
  assert.equal(dedup.isDuplicate("A"), false);
});

test("Fresh connection loses in-memory dedup history", () => {
  const firstConnection = createMessageDeduplicator();
  firstConnection.isDuplicate("abc");

  const secondConnection = createMessageDeduplicator();

  assert.equal(secondConnection.isDuplicate("abc"), false);
});
