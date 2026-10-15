# Packet v0.1 Beta

## Features

- Ed25519 challenge-response authentication
- WebSocket messaging relay
- SQLite local storage
- Convex shared durable storage
- Offline message queue
- Recipient acknowledgements
- Persistent client-side duplicate suppression
- CLI chat, listen, send, and inbox

## Required production environment

- PACKET_STORAGE=convex
- CONVEX_SITE_URL
- PACKET_RELAY_SECRET
- PORT (default 8787)
- HOST=0.0.0.0

Never commit relay secrets or private identity keys.

## Release verification

Run:

    sh scripts/release-check.sh

## Deployment

Build the Docker image:

    docker build -t packet-relay:0.1 .

Deploy it to a platform that supports persistent WebSocket
connections and configure the production environment variables.

## Known limitations

- Persistent receipts suppress duplicate displays but do not
  guarantee exactly-once processing.
- Reconnection and automatic retries require further validation.
- Convex network failures may delay message delivery.
- Distributed session ownership is not enforced across relays.
- No independent security audit has been completed.

## Beta release acceptance

- All automated tests pass.
- No secrets are committed.
- Cloud relay starts successfully.
- Two remote clients authenticate.
- Messages survive recipient disconnection.
- Recipient ACK removes pending delivery.
- Relay restart preserves queued messages.
- Network interruption and recovery are tested.
