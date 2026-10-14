import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  identities: defineTable({
    username: v.string(),
    publicKey: v.string(),
    createdAt: v.number(),
  }).index("by_username", ["username"]),

  messages: defineTable({
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    text: v.string(),
    timestamp: v.number(),
    delivered: v.boolean(),
  })
    .index("by_message_id", ["messageId"])
    .index("by_recipient_status", ["to", "delivered"])
    .index("by_recipient", ["to"]),
});
