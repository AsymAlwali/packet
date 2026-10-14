const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = path.join(os.homedir(), ".packet");
const IDENTITIES = path.join(DIR, "identities");
const LEGACY = path.join(DIR, "identity.json");

function validName(name) {
  return typeof name === "string" &&
    /^[a-zA-Z0-9_-]{1,32}$/.test(name);
}

function identityPath(name) {
  if (!validName(name)) throw new Error("Invalid username");
  return path.join(IDENTITIES, `${name}.json`);
}

function createIdentity(username) {
  const file = identityPath(username);

  fs.mkdirSync(IDENTITIES, {
    recursive: true,
    mode: 0o700
  });

  if (fs.existsSync(file)) {
    throw new Error("Identity already exists");
  }

  const { publicKey, privateKey } =
    crypto.generateKeyPairSync("ed25519");

  const identity = {
    username,
    publicKey: publicKey.export({
      type: "spki",
      format: "pem"
    }),
    privateKey: privateKey.export({
      type: "pkcs8",
      format: "pem"
    })
  };

  fs.writeFileSync(
    file,
    JSON.stringify(identity, null, 2),
    { mode: 0o600, flag: "wx" }
  );

  return identity;
}

function loadIdentity(name) {
  if (!name) {
    const config = path.join(DIR, "config.json");

    try {
      name = JSON.parse(fs.readFileSync(config)).username;
    } catch {
      name = "asym";
    }
  }

  const file = identityPath(name);

  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  // Preserve the original identity.
  if (fs.existsSync(LEGACY)) {
    const legacy = JSON.parse(fs.readFileSync(LEGACY, "utf8"));

    if (legacy.username === name) {
      return legacy;
    }
  }

  throw new Error(`Identity @${name} not found`);
}

function listIdentities() {
  const names = new Set();

  if (fs.existsSync(IDENTITIES)) {
    for (const file of fs.readdirSync(IDENTITIES)) {
      if (file.endsWith(".json")) {
        names.add(file.slice(0, -5));
      }
    }
  }

  if (fs.existsSync(LEGACY)) {
    try {
      names.add(JSON.parse(fs.readFileSync(LEGACY)).username);
    } catch {}
  }

  return [...names].sort();
}

function signChallenge(challenge, name) {
  const identity = loadIdentity(name);

  return crypto.sign(
    null,
    Buffer.from(challenge),
    identity.privateKey
  ).toString("base64");
}

module.exports = {
  createIdentity,
  loadIdentity,
  listIdentities,
  signChallenge
};
