import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getIdentity = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const identity = await ctx.db
      .query("identities")
      .withIndex("by_username", q => q.eq("username", username))
      .unique();

    return identity?.publicKey ?? null;
  },
});

export const registerIdentity = internalMutation({
  args: {
    username: v.string(),
    publicKey: v.string(),
  },
  handler: async (ctx, { username, publicKey }) => {
    const existing = await ctx.db
      .query("identities")
      .withIndex("by_username", q => q.eq("username", username))
      .unique();

    if (existing) {
      if (existing.publicKey !== publicKey) {
        throw new Error("Username belongs to another identity");
      }
      return;
    }

    await ctx.db.insert("identities", {
      username,
      publicKey,
      createdAt: Date.now(),
    });
  },
});

export const saveMessage = internalMutation({
  args: {
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    text: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_message_id", q =>
        q.eq("messageId", args.messageId)
      )
      .unique();

    if (existing) {
      if (
        existing.from !== args.from ||
        existing.to !== args.to ||
        existing.text !== args.text
      ) {
        throw new Error("Message ID conflict");
      }
      return;
    }

    await ctx.db.insert("messages", {
      ...args,
      delivered: false,
    });
  },
});

export const getPendingMessages = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_recipient_status", q =>
        q.eq("to", username).eq("delivered", false)
      )
      .collect();
  },
});

export const acknowledgeMessage = internalMutation({
  args: {
    messageId: v.string(),
    username: v.string(),
  },
  handler: async (ctx, { messageId, username }) => {
    const message = await ctx.db
      .query("messages")
      .withIndex("by_message_id", q =>
        q.eq("messageId", messageId)
      )
      .unique();

    if (!message || message.to !== username || message.delivered) {
      return false;
    }

    await ctx.db.patch(message._id, { delivered: true });
    return true;
  },
});

export const getInbox = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_recipient", q => q.eq("to", username))
      .collect();
  },
});
