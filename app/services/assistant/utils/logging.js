/**
 * Lightweight structured logging for assistant turns (no PII beyond ids).
 */

export function logAssistant(event, payload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    scope: "assistant",
    event,
    ...payload,
  };
  try {
    // eslint-disable-next-line no-console
    console.info("[assistant]", JSON.stringify(entry));
  } catch {
    // ignore logging failures
  }
  return entry;
}

export function logAssistantError(event, error, payload = {}) {
  return logAssistant(event, {
    ...payload,
    error:
      error instanceof Error
        ? { message: error.message, name: error.name }
        : String(error || "unknown"),
  });
}
