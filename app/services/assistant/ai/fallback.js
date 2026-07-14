/**
 * Fallback strategy — assistant must keep working when AI is unavailable.
 */

import { AI_FALLBACK_STRATEGY, AI_REQUEST_STATUS } from "./constants.js";
import { createDegradedAiResult } from "./contracts.js";

/**
 * Decide next action after a provider attempt fails.
 *
 * @param {object} input
 * @param {object} input.result last provider result
 * @param {object[]} input.remainingProviders
 * @param {string} [input.strategy]
 * @param {number} [input.attempt]
 * @param {number} [input.maxRetries]
 */
export function resolveAiFallback(input = {}) {
  const strategy = input.strategy || AI_FALLBACK_STRATEGY.RETRY_THEN_DEGRADE;
  const attempt = input.attempt || 0;
  const maxRetries = input.maxRetries ?? 1;
  const remaining = input.remainingProviders || [];

  if (strategy === AI_FALLBACK_STRATEGY.NEXT_PROVIDER && remaining.length) {
    return Object.freeze({
      action: "next_provider",
      strategy,
      nextProviderId: remaining[0].id,
    });
  }

  if (
    strategy === AI_FALLBACK_STRATEGY.RETRY_THEN_DEGRADE &&
    attempt < maxRetries
  ) {
    return Object.freeze({
      action: "retry",
      strategy,
      attempt: attempt + 1,
    });
  }

  if (
    strategy === AI_FALLBACK_STRATEGY.RETRY_THEN_DEGRADE &&
    remaining.length
  ) {
    return Object.freeze({
      action: "next_provider",
      strategy,
      nextProviderId: remaining[0].id,
    });
  }

  return Object.freeze({
    action: "degrade",
    strategy: AI_FALLBACK_STRATEGY.DEGRADE,
  });
}

export function toDegradedFallbackResult({ kind, reason, providerId } = {}) {
  return createDegradedAiResult({
    kind,
    reason: reason || "fallback_degraded",
    providerId,
    note:
      "AI fallback activated. Intent Router patterns + Knowledge Layer continue to serve the customer.",
  });
}

export function isAiSuccess(result) {
  return Boolean(
    result?.ok && result?.status === AI_REQUEST_STATUS.SUCCESS,
  );
}
