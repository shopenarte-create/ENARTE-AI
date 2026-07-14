/**
 * AI gateway — timeout, retry, provider chain, validation, telemetry.
 * All model traffic (future) must pass through here via the AI Adapter.
 */

import {
  AI_FALLBACK_STRATEGY,
  AI_REQUEST_STATUS,
} from "./constants.js";
import { createAiResult, createDegradedAiResult } from "./contracts.js";
import { resolveProviderChain } from "./providers/registry.js";
import { getPrompt } from "./prompts/registry.js";
import { validateAiResponse } from "./validation/validate.js";
import { recordTokenUsage } from "./telemetry/usage-tracker.js";
import { estimateCost, recordCost } from "./telemetry/cost-tracker.js";
import {
  isAiSuccess,
  resolveAiFallback,
  toDegradedFallbackResult,
} from "./fallback.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) return promise;

  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error("ai_timeout");
          err.code = "ai_timeout";
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {object} request createAiRequest result
 * @param {object} [options]
 */
export async function executeAiGateway(request, options = {}) {
  const started = Date.now();
  const enabled = options.enabled === true;
  const timeoutMs =
    request.timeoutMs ?? options.timeoutMs ?? 8_000;
  const maxRetries = options.maxRetries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 150;
  const strategy =
    options.fallbackStrategy || AI_FALLBACK_STRATEGY.RETRY_THEN_DEGRADE;

  if (!enabled) {
    return createDegradedAiResult({
      kind: request.kind,
      reason: "ai_feature_disabled",
      note: "ASSISTANT_FEATURE_LLM is false — AI gateway returns degraded (no provider call).",
    });
  }

  // Prompt metadata lookup (content never executed in Sprint 6).
  if (request.prompt?.promptId) {
    const prompt = getPrompt(
      request.prompt.promptId,
      request.prompt.version || null,
    );
    if (!prompt) {
      return createAiResult({
        ok: false,
        status: AI_REQUEST_STATUS.VALIDATION_FAILED,
        kind: request.kind,
        note: "Unknown prompt id in registry.",
        error: "unknown_prompt",
        durationMs: Date.now() - started,
      });
    }
    if (!prompt.contentReady) {
      return createDegradedAiResult({
        kind: request.kind,
        reason: "prompt_content_not_ready",
        note: "Prompt slot exists but content is not authored (Sprint 6).",
      });
    }
  }

  const chain = [
    ...resolveProviderChain({
      preferredId: request.providerId || options.preferredProviderId,
      fallbackIds: options.fallbackProviderIds,
    }),
  ];

  const attempts = [];
  let attempt = 0;
  let providerIndex = 0;

  while (providerIndex < chain.length) {
    const provider = chain[providerIndex];
    const remaining = chain.slice(providerIndex + 1);

    if (!provider.isAvailable?.()) {
      attempts.push(
        Object.freeze({
          providerId: provider.id,
          status: AI_REQUEST_STATUS.UNAVAILABLE,
          note: "Provider reported unavailable.",
        }),
      );

      const fb = resolveAiFallback({
        strategy,
        attempt,
        maxRetries,
        remainingProviders: remaining,
      });

      if (fb.action === "next_provider") {
        providerIndex += 1;
        attempt = 0;
        continue;
      }
      break;
    }

    try {
      const raw = await withTimeout(provider.invoke(request, options), timeoutMs);
      attempts.push(
        Object.freeze({
          providerId: provider.id,
          status: raw?.status || AI_REQUEST_STATUS.PROVIDER_ERROR,
        }),
      );

      if (!isAiSuccess(raw)) {
        const fb = resolveAiFallback({
          result: raw,
          strategy,
          attempt,
          maxRetries,
          remainingProviders: remaining,
        });
        if (fb.action === "retry") {
          attempt = fb.attempt;
          if (retryDelayMs) await sleep(retryDelayMs);
          continue;
        }
        if (fb.action === "next_provider") {
          providerIndex += 1;
          attempt = 0;
          continue;
        }
        break;
      }

      const validation = validateAiResponse(
        raw.data,
        request.schemaId || request.kind,
      );
      if (!validation.ok) {
        return createAiResult({
          ok: false,
          status: AI_REQUEST_STATUS.VALIDATION_FAILED,
          kind: request.kind,
          providerId: provider.id,
          data: raw.data,
          validation,
          attempts,
          durationMs: Date.now() - started,
          note: "AI response failed schema validation.",
          error: "validation_failed",
        });
      }

      const usage = raw.usage || null;
      const cost =
        raw.cost ||
        estimateCost({ model: options.model || raw.cost?.model, usage });

      if (usage) {
        recordTokenUsage({
          providerId: provider.id,
          kind: request.kind,
          usage,
        });
      }
      recordCost({
        providerId: provider.id,
        model: cost.model || options.model,
        usage,
        cost,
      });

      return createAiResult({
        ok: true,
        status: AI_REQUEST_STATUS.SUCCESS,
        kind: request.kind,
        providerId: provider.id,
        data: raw.data,
        usage,
        cost,
        validation,
        attempts,
        durationMs: Date.now() - started,
        note: raw.note || null,
      });
    } catch (error) {
      const timedOut = error?.code === "ai_timeout" || error?.message === "ai_timeout";
      attempts.push(
        Object.freeze({
          providerId: provider.id,
          status: timedOut
            ? AI_REQUEST_STATUS.TIMEOUT
            : AI_REQUEST_STATUS.PROVIDER_ERROR,
          error: timedOut ? "timeout" : error?.message || "provider_error",
        }),
      );

      const fb = resolveAiFallback({
        strategy,
        attempt,
        maxRetries,
        remainingProviders: remaining,
      });
      if (fb.action === "retry") {
        attempt = fb.attempt;
        if (retryDelayMs) await sleep(retryDelayMs);
        continue;
      }
      if (fb.action === "next_provider") {
        providerIndex += 1;
        attempt = 0;
        continue;
      }
      break;
    }
  }

  const degraded = toDegradedFallbackResult({
    kind: request.kind,
    reason: "provider_chain_exhausted",
    providerId: chain[0]?.id,
  });

  return createAiResult({
    ...degraded,
    attempts: Object.freeze(attempts),
    durationMs: Date.now() - started,
  });
}
