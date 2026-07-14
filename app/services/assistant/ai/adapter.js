/**
 * Dedicated AI Adapter — the ONLY entry point for AI provider traffic.
 *
 * Rules:
 * - Decision Engine remains the decision maker.
 * - OpenAI must never become the assistant (tools + Knowledge/Catalog for facts).
 * - When AI is disabled / unavailable, return degraded and let pattern routing continue.
 * - Sprint 9: `assistant_chat` via OpenAI Responses API; other kinds remain not implemented.
 */

import { ADAPTER_STATUS } from "../constants.js";
import {
  AI_ADAPTER_ID,
  AI_CAPABILITY_KIND,
  AI_LAYER_VERSION,
} from "./constants.js";
import { createAiRequest } from "./contracts.js";
import { executeAiGateway } from "./gateway.js";
import { getAssistantConfig } from "../config/index.js";
import { listAiProviders } from "./providers/registry.js";
import { listPrompts } from "./prompts/registry.js";
import { getTokenUsageSnapshot } from "./telemetry/usage-tracker.js";
import { getCostSnapshot } from "./telemetry/cost-tracker.js";

let singleton = null;

function resolveGatewayOptions(overrides = {}) {
  const config = getAssistantConfig();
  const ai = config.ai || {};
  const features = config.features || {};

  return {
    enabled: features.enableLlm === true && overrides.enabled !== false,
    preferredProviderId:
      overrides.preferredProviderId || ai.preferredProviderId || null,
    fallbackProviderIds:
      overrides.fallbackProviderIds || ai.fallbackProviderIds || null,
    timeoutMs: overrides.timeoutMs ?? ai.timeoutMs,
    maxRetries: overrides.maxRetries ?? ai.maxRetries,
    retryDelayMs: overrides.retryDelayMs ?? ai.retryDelayMs,
    fallbackStrategy: overrides.fallbackStrategy || ai.fallbackStrategy,
    model: overrides.model || ai.model,
  };
}

async function complete(input = {}, options = {}) {
  const request = createAiRequest({
    kind: input.kind || AI_CAPABILITY_KIND.NLU,
    providerId: input.providerId,
    prompt: input.prompt,
    input: input.input || input,
    schemaId: input.schemaId,
    locale: input.locale,
    conversationId: input.conversationId,
    shop: input.shop,
    timeoutMs: input.timeoutMs,
    metadata: input.metadata,
  });

  return executeAiGateway(request, resolveGatewayOptions(options));
}

/**
 * Typed helpers — all funnel into complete() / gateway.
 */
const capabilityHelpers = Object.fromEntries(
  Object.values(AI_CAPABILITY_KIND).map((kind) => [
    kind,
    async (input = {}, options = {}) =>
      complete({ ...input, kind }, options),
  ]),
);

export function createAiAdapter() {
  return Object.freeze({
    id: AI_ADAPTER_ID,
    status: ADAPTER_STATUS.ACTIVE,
    description:
      "Dedicated AI Adapter. Provider-agnostic gateway for NLU/signals only. Not the assistant.",
    version: AI_LAYER_VERSION,
    api: Object.freeze({
      /** Primary entry — every AI request must use this. */
      complete,
      ...capabilityHelpers,
      status: () => getAiAdapterStatus(),
    }),
  });
}

export function getAiAdapter() {
  if (!singleton) singleton = createAiAdapter();
  return singleton;
}

export function resetAiAdapter() {
  singleton = null;
}

export function getAiAdapterStatus() {
  const config = getAssistantConfig();
  return Object.freeze({
    adapterId: AI_ADAPTER_ID,
    version: AI_LAYER_VERSION,
    llmFeatureEnabled: Boolean(config.features?.enableLlm),
    preferredProviderId: config.ai?.preferredProviderId || null,
    providers: listAiProviders(),
    promptsRegistered: listPrompts().length,
    promptsWithContent: listPrompts().filter((p) => p.contentReady).length,
    usage: getTokenUsageSnapshot(),
    cost: getCostSnapshot(),
    openaiCallable: Boolean(
      config.features?.enableLlm && config.ai?.openaiSdkWired,
    ),
    imageAnalysisImplemented: false,
    decisionEngineOwnsRouting: true,
  });
}
