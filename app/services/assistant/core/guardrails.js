/**
 * Guardrails — policy gate before orchestration.
 * Phase 1: structural checks + config policy id only.
 * No content moderation model, no hardcoded business rules.
 */

import { getAssistantConfig } from "../config/index.js";

export function evaluateGuardrails(input = {}, ctx = {}) {
  const config = ctx.config || getAssistantConfig();

  if (!config.runtime.enabled) {
    return Object.freeze({
      allowed: false,
      code: "assistant_disabled",
      policyId: config.ai.guardrailPolicyId,
    });
  }

  if (!input.shop && !ctx.shop) {
    return Object.freeze({
      allowed: false,
      code: "shop_required",
      policyId: config.ai.guardrailPolicyId,
    });
  }

  return Object.freeze({
    allowed: true,
    code: "ok",
    policyId: config.ai.guardrailPolicyId,
    note: "Phase 1 structural guardrails only.",
  });
}
