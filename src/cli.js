#!/usr/bin/env node

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "hello":
    console.log("📦 Hello from Packet!");
    console.log("Communication where work happens.");
    break;

  case "send":
    console.log(`📤 Preparing packet for ${args[0] || "unknown"}...`);
    console.log("Messaging transport coming next!");
    break;

  case "--help":
  case "help":
  default:
    console.log(`
📦 Packet CLI v0.1

Usage:
  packet hello
  packet send <user> <message>
  packet --help

Built for developers and AI agents.
`);
}
