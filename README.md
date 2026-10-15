# 📦 Packet

**Identity-based messaging infrastructure for humans and AI agents.**

Packet is an experimental open-source messaging system built around one idea:

**Send a message to an identity, not a device.**

Packet uses Ed25519 identities, WebSockets, Convex durable storage, and SQLite receipt tracking.

## Why Packet?

Packet explores messaging infrastructure for:

- Human-to-human messaging
- Human-to-AI-agent communication
- Agent-to-agent communication
- Asynchronous software coordination

Agent integrations are planned; the current beta focuses on identity-based messaging.

## Status

**v0.1 Experimental Beta**

Verified capabilities:

- Public WebSocket relay deployed on Vercel
- Ed25519 challenge-response authentication
- Identity-based messaging
- Offline message storage using Convex
- Delivery when recipients reconnect
- Message acknowledgement protocol
- Persistent SQLite duplicate suppression
- 15 passing automated tests

Public relay:

`wss://packet-eight.vercel.app/`

Availability and compatibility are not guaranteed during beta.

## Architecture

```text
Sender CLI
    |
    | WebSocket (WSS)
    v
Vercel Packet Relay
    |
    | Authenticated HTTP API
    v
Convex Durable Storage
    |
    v
Recipient CLI
    |
    v
Message Acknowledgement
````

### Getting Started

### Requirements

* Node.js 26 (tested)

* npm

* Internet connection

### Installation

```bash
git clone https://github.com/AsymAlwali/packet.git
cd packet
npm install
```

### Create an identity

```bash
node src/cli.js identity
```

### Connect to Packet Cloud

```bash
export PACKET_SERVER=wss://packet-eight.vercel.app/
```

### Listen for messages

```bash
node src/cli.js --as alice listen
```

### Send a message

```bash
node src/cli.js --as bob send alice "Hello from Packet!"
```

Create and register the identities before sending messages.

### Testing

```bash
node --test test/*.test.js
```

Full verification:

```bash
sh scripts/release-check.sh
```

### Self-Hosting

Packet supports local SQLite storage and a Convex-backed cloud relay.

Cloud environment variables:

```text
PACKET_STORAGE=convex
CONVEX_SITE_URL=<your-convex-site-url>
PACKET_RELAY_SECRET=<your-relay-secret>
```

Configure the same relay secret in Convex and the relay host.

Never commit secrets or private identity keys.

### Known Limitations

Packet v0.1 is experimental.

* Automatic reconnection is not fully verified.

* Cross-instance delivery needs further testing.

* Cloud ACK persistence has not been independently verified.

* Persistent receipts do not guarantee exactly-once processing.

* End-to-end encryption is not implemented.

* No independent security audit has been completed.

Do not use Packet for sensitive communications yet.

### Roadmap

* Automatic reconnection and retries

* Cross-instance delivery reliability

* Agent-to-agent messaging APIs

* Developer SDK

* Delivery monitoring

* End-to-end encryption and security hardening

### Contributing

Issues, bug reports, and contributions are welcome.

### Author

Built by [Asym Alwali](https://github.com/AsymAlwali).

Part of the 30 Days, 30 Inventions experiment. EOF

### Protect local artifacts

cat >> .gitignore github.com/AsymAlwali/packet — feat/vercel-convex</Link>
