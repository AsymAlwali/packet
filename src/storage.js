const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

function createStorage(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const db = new DatabaseSync(filename);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS identities (
      username TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL,
      recipient TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_messages_pending
    ON messages(recipient, delivered);
  `);

  const getIdentityStmt = db.prepare(
    "SELECT public_key FROM identities WHERE username = ?"
  );

  const insertIdentityStmt = db.prepare(`
    INSERT OR IGNORE INTO identities
    (username, public_key, created_at)
    VALUES (?, ?, ?)
  `);

  const insertMessageStmt = db.prepare(`
    INSERT INTO messages
    (id, sender, recipient, text, timestamp, delivered)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const pendingStmt = db.prepare(`
    SELECT id, sender AS "from", recipient AS "to",
           text, timestamp, delivered
    FROM messages
    WHERE recipient = ? AND delivered = 0
    ORDER BY timestamp
  `);

  const inboxStmt = db.prepare(`
    SELECT id, sender AS "from", recipient AS "to",
           text, timestamp, delivered
    FROM messages
    WHERE recipient = ?
    ORDER BY timestamp
  `);

  const ackStmt = db.prepare(`
    UPDATE messages
    SET delivered = 1
    WHERE id = ? AND recipient = ? AND delivered = 0
  `);

  function getIdentity(username) {
    return getIdentityStmt.get(username)?.public_key || null;
  }

  function registerIdentity(username, publicKey) {
    insertIdentityStmt.run(username, publicKey, Date.now());

    if (getIdentity(username) !== publicKey) {
      throw new Error("Username belongs to another identity");
    }
  }

  function saveMessage(message) {
    insertMessageStmt.run(
      message.id,
      message.from,
      message.to,
      message.text,
      message.timestamp,
      message.delivered ? 1 : 0
    );
  }

  function mapMessage(message) {
    return {
      ...message,
      delivered: Boolean(message.delivered)
    };
  }

  function getPendingMessages(username) {
    return pendingStmt.all(username).map(mapMessage);
  }

  function getInbox(username) {
    return inboxStmt.all(username).map(mapMessage);
  }

  function acknowledgeMessage(id, username) {
    return ackStmt.run(id, username).changes > 0;
  }

  function close() {
    db.close();
  }

  return {
    getIdentity,
    registerIdentity,
    saveMessage,
    getPendingMessages,
    getInbox,
    acknowledgeMessage,
    close
  };
}

module.exports = { createStorage };
