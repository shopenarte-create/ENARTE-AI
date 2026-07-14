/**
 * Memory boundary — conversation history access.
 * Phase 1: in-memory stub keyed by conversation id (process-local).
 * Production persistence will plug in via the persistence adapter.
 */

/** @type {Map<string, object[]>} */
const store = new Map();

export function readMemory(conversationId, { limit } = {}) {
  if (!conversationId) return [];
  const items = store.get(conversationId) || [];
  if (!limit || limit <= 0) return [...items];
  return items.slice(-limit);
}

export function appendMemory(conversationId, entry) {
  if (!conversationId) {
    return { ok: false, error: "conversation_id_required" };
  }
  const list = store.get(conversationId) || [];
  const record = Object.freeze({
    ...entry,
    at: entry?.at || new Date().toISOString(),
  });
  list.push(record);
  store.set(conversationId, list);
  return Object.freeze({ ok: true, size: list.length });
}

export function clearMemory(conversationId) {
  if (!conversationId) return false;
  return store.delete(conversationId);
}

export function resetMemoryStore() {
  store.clear();
}
