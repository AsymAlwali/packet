function createConvexStorage(url, secret) {
  if (!url || !secret) {
    throw new Error("Missing Convex URL or relay secret");
  }

  const endpoint = url.replace(/\/$/, "") + "/packet/storage";

  async function call(operation, args = {}) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`
      },
      body: JSON.stringify({ operation, ...args }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(
        `Convex storage ${operation} failed: HTTP ${response.status}`
      );
    }

    const data = await response.json();
    return data.result;
  }

  function mapMessage(message) {
    return {
      id: message.messageId,
      from: message.from,
      to: message.to,
      text: message.text,
      timestamp: message.timestamp,
      delivered: message.delivered
    };
  }

  return {
    getIdentity(username) {
      return call("getIdentity", { username });
    },

    registerIdentity(username, publicKey) {
      return call("registerIdentity", { username, publicKey });
    },

    saveMessage(message) {
      return call("saveMessage", { message });
    },

    async getPendingMessages(username) {
      return (await call("getPendingMessages", { username }))
        .map(mapMessage);
    },

    async getInbox(username) {
      return (await call("getInbox", { username }))
        .map(mapMessage);
    },

    acknowledgeMessage(id, username) {
      return call("acknowledgeMessage", { id, username });
    },

    close() {}
  };
}

module.exports = { createConvexStorage };
