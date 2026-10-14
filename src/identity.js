const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = path.join(os.homedir(), ".packet");
const KEY_FILE = path.join(DIR, "identity.json");

function createIdentity(username) {
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(username)) {
    throw new Error("Invalid username");
  }

  if (fs.existsSync(KEY_FILE)) {
    throw new Error(
      "Identity already exists. Back it up before creating another."
    );
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

  fs.mkdirSync(DIR, {
    recursive: true,
    mode: 0o700
  });

  fs.writeFileSync(
    KEY_FILE,
    JSON.stringify(identity, null, 2),
    { mode: 0o600, flag: "wx" }
  );

  return identity;
}

function loadIdentity() {
  return JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
}

function signChallenge(challenge) {
  const identity = loadIdentity();

  return crypto.sign(
    null,
    Buffer.from(challenge),
    identity.privateKey
  ).toString("base64");
}

module.exports = {
  createIdentity,
  loadIdentity,
  signChallenge
};
