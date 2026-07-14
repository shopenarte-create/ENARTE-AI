/**
 * AI Adapter probe — NLU signal interface only.
 * Every workflow path may call this; results never own routing decisions.
 * Sprint 9: free-text chat uses `assistant.converse`; this NLU probe still
 * degrades until dedicated NLU prompt/provider kinds are authored.
 */

import { invokeCapability } from "../capabilities/registry.js";

/**
 * @param {object} ctx
 * @param {object} [input]
 * @param {string} [workflowId]
 */
export async function probeAiSignal(ctx, input = {}, workflowId = null) {
  try {
    const result = await invokeCapability("ai.nlu", ctx, {
      kind: "nlu",
      message: input.message || null,
      workflowId,
      conversationId: ctx?.conversationId,
      shop: ctx?.shop,
      locale: ctx?.locale,
      input: Object.freeze({
        message: input.message || null,
        workflowId,
        actionId: input.actionId || null,
      }),
    });

    return Object.freeze({
      probed: true,
      capabilityId: "ai.nlu",
      ok: Boolean(result?.ok),
      status: result?.status || "degraded",
      usedForDecision: false,
      note:
        "AI Adapter interface only — Decision Engine + Knowledge remain authoritative.",
    });
  } catch (error) {
    return Object.freeze({
      probed: true,
      capabilityId: "ai.nlu",
      ok: false,
      status: "degraded",
      usedForDecision: false,
      error: error instanceof Error ? error.message : String(error),
      note: "AI probe failed safely — assistant continues without AI.",
    });
  }
}
