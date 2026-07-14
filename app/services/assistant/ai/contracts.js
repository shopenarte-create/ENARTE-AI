/**
 * AI layer contracts — request/response shapes (no vendor SDK).
 */

import {
  AI_CAPABILITY_KIND,
  AI_FALLBACK_STRATEGY,
  AI_PROVIDER_ID,
  AI_REQUEST_STATUS,
} from "./constants.js";

/**
 * @typedef {object} AiUsage
 * @property {number} promptTokens
 * @property {number} completionTokens
 * @property {number} totalTokens
 */

/**
 * @typedef {object} AiCost
 * @property {string} currency
 * @property {number|null} amount
 * @property {string|null} model
 */

/**
 * @typedef {object} AiPromptRef
 * @property {string} promptId
 * @property {string} [version]
 * @property {string} [packId]
 */

/**
 * Build a normalized AI request for the adapter gateway.
 * Callers must never pass business rules as invented facts — only signals.
 *
 * @param {object} partial
 */
export function createAiRequest(partial = {}) {
  const kind = partial.kind || AI_CAPABILITY_KIND.NLU;
  if (!Object.values(AI_CAPABILITY_KIND).includes(kind)) {
    throw new Error(`Unknown AI capability kind: ${kind}`);
  }

  return Object.freeze({
    id: partial.id || `ai_req_${Date.now().toString(36)}`,
    kind,
    providerId: partial.providerId || null,
    prompt: partial.prompt
      ? Object.freeze({
          promptId: partial.prompt.promptId || null,
          version: partial.prompt.version || null,
          packId: partial.prompt.packId || null,
        })
      : null,
    /** Opaque payload for a future provider — never executed in Sprint 6. */
    input: Object.freeze({ ...(partial.input || {}) }),
    schemaId: partial.schemaId || null,
    locale: partial.locale || "ar",
    conversationId: partial.conversationId || null,
    shop: partial.shop || null,
    timeoutMs: typeof partial.timeoutMs === "number" ? partial.timeoutMs : null,
    metadata: Object.freeze({ ...(partial.metadata || {}) }),
  });
}

/**
 * @param {object} partial
 */
export function createAiResult(partial = {}) {
  return Object.freeze({
    ok: Boolean(partial.ok),
    status: partial.status || AI_REQUEST_STATUS.NOT_IMPLEMENTED,
    kind: partial.kind || null,
    providerId: partial.providerId || null,
    data: partial.data != null ? Object.freeze(partial.data) : null,
    raw: partial.raw != null ? Object.freeze(partial.raw) : null,
    usage: partial.usage
      ? Object.freeze({
          promptTokens: partial.usage.promptTokens ?? 0,
          completionTokens: partial.usage.completionTokens ?? 0,
          totalTokens: partial.usage.totalTokens ?? 0,
        })
      : null,
    cost: partial.cost
      ? Object.freeze({
          currency: partial.cost.currency || "USD",
          amount: partial.cost.amount ?? null,
          model: partial.cost.model ?? null,
        })
      : null,
    validation: partial.validation
      ? Object.freeze({ ...partial.validation })
      : null,
    fallback: partial.fallback
      ? Object.freeze({ ...partial.fallback })
      : null,
    attempts: Array.isArray(partial.attempts)
      ? Object.freeze([...partial.attempts])
      : Object.freeze([]),
    durationMs: partial.durationMs ?? null,
    note: partial.note || null,
    error: partial.error || null,
  });
}

export function createDegradedAiResult({
  kind,
  reason = "ai_unavailable",
  note = "AI provider unavailable — assistant continues without AI.",
  providerId = AI_PROVIDER_ID.STUB,
  fallbackStrategy = AI_FALLBACK_STRATEGY.DEGRADE,
} = {}) {
  return createAiResult({
    ok: false,
    status: AI_REQUEST_STATUS.DEGRADED,
    kind,
    providerId,
    fallback: Object.freeze({
      strategy: fallbackStrategy,
      reason,
      usePatternRouter: true,
      useKnowledgeOnly: true,
    }),
    note,
    error: reason,
  });
}

export function createEmptyUsage() {
  return Object.freeze({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });
}

export function createEmptyCost(model = null) {
  return Object.freeze({
    currency: "USD",
    amount: 0,
    model,
  });
}
