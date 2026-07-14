/**
 * AI provider registry — abstraction for current + future vendors.
 */

import { AI_PROVIDER_ID } from "../constants.js";
import { createStubAiProvider } from "./stub.js";
import { createOpenAiProvider } from "./openai.js";
import { defineAiProvider } from "./types.js";
import { AI_PROVIDER_STATUS, AI_CAPABILITY_KIND } from "../constants.js";

/** @type {Map<string, import("./types.js").AiProviderDefinition>} */
const providers = new Map();

export function registerAiProvider(provider) {
  const defined =
    provider?.id && typeof provider.invoke === "function"
      ? provider
      : defineAiProvider(provider);
  providers.set(defined.id, defined);
  return defined;
}

export function getAiProvider(id) {
  return providers.get(id) || null;
}

export function listAiProviders() {
  return [...providers.values()].map((p) =>
    Object.freeze({
      id: p.id,
      status: p.status,
      description: p.description,
      supports: p.supports,
      available: Boolean(p.isAvailable?.()),
    }),
  );
}

/**
 * Resolve provider chain: preferred → fallbacks → stub.
 * @param {object} [options]
 * @param {string} [options.preferredId]
 * @param {string[]} [options.fallbackIds]
 */
export function resolveProviderChain(options = {}) {
  const preferred =
    options.preferredId || AI_PROVIDER_ID.OPENAI;
  const fallbackIds = Array.isArray(options.fallbackIds)
    ? options.fallbackIds
    : [AI_PROVIDER_ID.STUB];

  const chain = [];
  const seen = new Set();

  for (const id of [preferred, ...fallbackIds, AI_PROVIDER_ID.STUB]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const provider = providers.get(id);
    if (provider) chain.push(provider);
  }

  return Object.freeze(chain);
}

function registerPlannedProviders() {
  registerAiProvider({
    id: AI_PROVIDER_ID.ANTHROPIC,
    status: AI_PROVIDER_STATUS.PLANNED,
    description: "Anthropic provider — planned (multi-provider future).",
    supports: Object.freeze([
      AI_CAPABILITY_KIND.NLU,
      AI_CAPABILITY_KIND.INTENT_CLASSIFICATION,
      AI_CAPABILITY_KIND.ENTITY_EXTRACTION,
      AI_CAPABILITY_KIND.RESPONSE_REWRITING,
      AI_CAPABILITY_KIND.STRUCTURED_JSON,
    ]),
    isAvailable: () => false,
    async invoke() {
      throw new Error("Anthropic provider not implemented.");
    },
  });

  registerAiProvider({
    id: AI_PROVIDER_ID.AZURE_OPENAI,
    status: AI_PROVIDER_STATUS.PLANNED,
    description: "Azure OpenAI provider — planned.",
    supports: Object.freeze(Object.values(AI_CAPABILITY_KIND)),
    isAvailable: () => false,
    async invoke() {
      throw new Error("Azure OpenAI provider not implemented.");
    },
  });
}

export function resetAiProviders() {
  providers.clear();
  registerAiProvider(createStubAiProvider());
  registerAiProvider(
    createOpenAiProvider({ enabled: Boolean(process.env.OPENAI_API_KEY) }),
  );
  registerPlannedProviders();
}

resetAiProviders();

export { AI_PROVIDER_ID };
