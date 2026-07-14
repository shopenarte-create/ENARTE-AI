/**
 * Assistant configuration surface.
 *
 * Business rules, contact info, delivery settings, services, prompts, and
 * AI behavior MUST live here (or in knowledge modules) — never inside workflows.
 */

import { loadIntentCatalog } from "./intent-catalog.js";

function envStore(env) {
  return env || process.env;
}

function readEnv(env, name, fallback = undefined) {
  const value = envStore(env)[name];
  if (value === undefined || value === "") return fallback;
  return value;
}

function readBool(env, name, fallback = false) {
  const raw = readEnv(env, name);
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function readInt(env, name, fallback) {
  const raw = readEnv(env, name);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Runtime / infrastructure settings (from environment).
 * Does not encode lighting or sales business rules.
 */
export function loadRuntimeConfig(env = process.env) {
  return Object.freeze({
    enabled: readBool(env, "ASSISTANT_ENABLED", true),
    defaultLocale: readEnv(env, "ASSISTANT_DEFAULT_LOCALE", "ar"),
    defaultChannel: readEnv(env, "ASSISTANT_DEFAULT_CHANNEL", "api"),
    /** LLM adapter id — prefer ai.adapter (Sprint 6). */
    llmAdapterId: readEnv(env, "ASSISTANT_LLM_ADAPTER", "ai.adapter"),
    persistenceAdapterId: readEnv(
      env,
      "ASSISTANT_PERSISTENCE_ADAPTER",
      "persistence.prisma",
    ),
    /** Keep short for lower LLM latency; memory still lives in session state. */
    maxHistoryMessages: readInt(env, "ASSISTANT_MAX_HISTORY_MESSAGES", 28),
    maxToolRounds: readInt(env, "ASSISTANT_MAX_TOOL_ROUNDS", 4),
    rateLimitPerMinute: readInt(env, "ASSISTANT_RATE_LIMIT_PER_MINUTE", 30),
  });
}

function readLlmEnabled(env) {
  const store = envStore(env);
  const explicit = store.ASSISTANT_FEATURE_LLM;
  if (explicit !== undefined && explicit !== "") {
    return readBool(env, "ASSISTANT_FEATURE_LLM", false);
  }
  return Boolean(String(store.OPENAI_API_KEY || "").trim());
}

/**
 * Feature flags — gate workflows/capabilities without code changes.
 */
export function loadFeatureFlags(env = process.env) {
  return Object.freeze({
    /** Phase 2 workflow engine (intent routing + placeholders). Default on. */
    workflowEngine: readBool(env, "ASSISTANT_FEATURE_WORKFLOW_ENGINE", true),
    acceptTurns: readBool(env, "ASSISTANT_FEATURE_ACCEPT_TURNS", true),
    /** On when ASSISTANT_FEATURE_LLM=true, or when OPENAI_API_KEY is set. */
    enableLlm: readLlmEnabled(env),
    enableShopifyTools: readBool(env, "ASSISTANT_FEATURE_SHOPIFY_TOOLS", true),
    enableImageTools: readBool(env, "ASSISTANT_FEATURE_IMAGE_TOOLS", false),
    enableAnalyticsHooks: readBool(
      env,
      "ASSISTANT_FEATURE_ANALYTICS_HOOKS",
      true,
    ),
    enableExternalModules: readBool(
      env,
      "ASSISTANT_FEATURE_EXTERNAL_MODULES",
      true,
    ),
  });
}

/**
 * Placeholder for brand/business settings.
 * Populate later from DB, metafields, or secure config — not from workflows.
 */
export function loadBusinessConfig() {
  return Object.freeze({
    /** Reserved keys — intentionally empty in Phase 1. */
    contact: Object.freeze({}),
    delivery: Object.freeze({}),
    services: Object.freeze({}),
    policies: Object.freeze({}),
    sales: Object.freeze({}),
  });
}

/**
 * Placeholder for AI behavior settings (prompts, tone, guardrail policy ids).
 * Workflows must read these via getAssistantConfig(), never hardcode them.
 * Sprint 6: architecture knobs only — no OpenAI calls, no prompt bodies.
 */
export function loadAiBehaviorConfig(env = process.env) {
  const fallbackRaw = readEnv(env, "ASSISTANT_AI_FALLBACK_PROVIDERS", "stub");
  const fallbackProviderIds = Object.freeze(
    String(fallbackRaw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  return Object.freeze({
    promptPackId: readEnv(env, "ASSISTANT_PROMPT_PACK_ID", "default"),
    systemPromptRef: readEnv(env, "ASSISTANT_SYSTEM_PROMPT_REF", null),
    guardrailPolicyId: readEnv(env, "ASSISTANT_GUARDRAIL_POLICY_ID", "default"),
    temperature: null,
    model: readEnv(env, "ASSISTANT_MODEL", "gpt-4.1"),
    preferredProviderId: readEnv(
      env,
      "ASSISTANT_AI_PROVIDER",
      "openai",
    ),
    fallbackProviderIds,
    timeoutMs: readInt(env, "ASSISTANT_AI_TIMEOUT_MS", 60_000),
    maxRetries: readInt(env, "ASSISTANT_AI_MAX_RETRIES", 1),
    retryDelayMs: readInt(env, "ASSISTANT_AI_RETRY_DELAY_MS", 150),
    fallbackStrategy: readEnv(
      env,
      "ASSISTANT_AI_FALLBACK_STRATEGY",
      "retry_then_degrade",
    ),
    /** Live when OpenAI Responses provider is configured. */
    promptContentReady: Boolean(readEnv(env, "OPENAI_API_KEY")),
    openaiSdkWired: Boolean(readEnv(env, "OPENAI_API_KEY")),
  });
}

let cachedConfig = null;

export function getAssistantConfig({ refresh = false, env = process.env } = {}) {
  if (cachedConfig && !refresh) return cachedConfig;

  cachedConfig = Object.freeze({
    runtime: loadRuntimeConfig(env),
    features: loadFeatureFlags(env),
    business: loadBusinessConfig(),
    ai: loadAiBehaviorConfig(env),
    intentCatalog: loadIntentCatalog(),
  });

  return cachedConfig;
}

export function resetAssistantConfigCache() {
  cachedConfig = null;
}
