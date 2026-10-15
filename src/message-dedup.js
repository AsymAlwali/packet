function createMessageDeduplicator(maxSize = 10000) {
  const receivedIds = new Set();

  return {
    isDuplicate(id) {
      if (receivedIds.has(id)) {
        return true;
      }

      receivedIds.add(id);

      if (receivedIds.size > maxSize) {
        const oldest = receivedIds.values().next().value;
        receivedIds.delete(oldest);
      }

      return false;
    }
  };
}

module.exports = { createMessageDeduplicator };
