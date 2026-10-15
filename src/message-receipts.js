const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function createMessageReceipts(username, options = {}) {
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(username)) {
    throw new Error("Invalid receipt store username");
  }

  const dir = options.dir ||
    process.env.PACKET_RECEIPTS_DIR ||
    path.join(os.homedir(), ".packet", "receipts");

  fs.mkdirSync(dir, {
    recursive: true,
    mode: 0o700
  });

  const file = path.join(dir, `${username}.sqlite`);
  const db = new DatabaseSync(file);

  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      received_at INTEGER NOT NULL
    )
  `);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO receipts (id, received_at)
    VALUES (?, ?)
  `);

  return {
    isDuplicate(id) {
      if (typeof id !== "string" || !id || id.length > 256) {
        throw new Error("Invalid message ID");
      }

      const result = insert.run(id, Date.now());
      return result.changes === 0;
    },

    close() {
      db.close();
    }
  };
}

module.exports = { createMessageReceipts };
