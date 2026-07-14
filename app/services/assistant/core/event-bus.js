/**
 * Event bus — fan-out point for analytics, learning, and external modules.
 * Phase 1: in-process listeners only; persistence adapter may subscribe later.
 */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

export function subscribe(eventType, handler) {
  if (typeof handler !== "function") {
    throw new Error("Event handler must be a function.");
  }
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  listeners.get(eventType).add(handler);
  return () => listeners.get(eventType)?.delete(handler);
}

export function subscribeAny(handler) {
  return subscribe("*", handler);
}

export async function publish(eventType, payload = {}) {
  const event = Object.freeze({
    type: eventType,
    payload,
    at: new Date().toISOString(),
  });

  const specific = listeners.get(eventType);
  const wildcard = listeners.get("*");
  const handlers = [
    ...(specific ? [...specific] : []),
    ...(wildcard ? [...wildcard] : []),
  ];

  const results = [];
  for (const handler of handlers) {
    try {
      results.push(await handler(event));
    } catch (error) {
      results.push({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Object.freeze({ event, results });
}

export function listEventTypes() {
  return [...listeners.keys()];
}

export function resetEventBus() {
  listeners.clear();
}
