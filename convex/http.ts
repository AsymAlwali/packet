import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/packet/storage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.PACKET_RELAY_SECRET;
    const provided = request.headers.get("Authorization");

    if (!expected || provided !== `Bearer ${expected}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = await request.json();
      let result: unknown;

      switch (body.operation) {
        case "getIdentity":
          result = await ctx.runQuery(internal.packet.getIdentity, {
            username: body.username
          });
          break;

        case "registerIdentity":
          result = await ctx.runMutation(internal.packet.registerIdentity, {
            username: body.username,
            publicKey: body.publicKey
          });
          break;

        case "saveMessage":
          result = await ctx.runMutation(internal.packet.saveMessage, {
            messageId: body.message.id,
            from: body.message.from,
            to: body.message.to,
            text: body.message.text,
            timestamp: body.message.timestamp
          });
          break;

        case "getPendingMessages":
          result = await ctx.runQuery(
            internal.packet.getPendingMessages,
            { username: body.username }
          );
          break;

        case "getInbox":
          result = await ctx.runQuery(internal.packet.getInbox, {
            username: body.username
          });
          break;

        case "acknowledgeMessage":
          result = await ctx.runMutation(
            internal.packet.acknowledgeMessage,
            {
              messageId: body.id,
              username: body.username
            }
          );
          break;

        default:
          return new Response("Unknown operation", { status: 400 });
      }

      return Response.json({ result: result ?? null });
    } catch (error) {
      console.error("Packet storage operation failed:", error);
      return new Response("Storage operation failed", { status: 500 });
    }
  })
});

export default http;
