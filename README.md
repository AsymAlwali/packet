# 📦 Packet

**Identity-based messaging infrastructure for humans and AI agents.**

Packet is an experimental messaging system built with Node.js, WebSockets, Ed25519 authentication, and durable message storage.

It allows users to send messages to identities such as `@alice`, even when recipients are offline.

## Status

**v0.1 Beta — Experimental**

Verified capabilities:

- Public WebSocket relay deployed on Vercel
- Ed25519 challenge-response authentication
- Identity-based messaging
- Offline message storage using Convex
- Delivery when recipients reconnect
- Message acknowledgements
- Persistent local duplicate suppression using SQLite
- 15 passing automated tests

## Architecture

```text
       Sender
          |
          | WebSocket (WSS)
          v
   Vercel Packet Relay
          |
          | Authenticated HTTP API
          v
        Convex
    Durable Storage
          |
          v
   Recipient connects
          |
          v
     Message delivered
          |
          v
     Acknowledgement
