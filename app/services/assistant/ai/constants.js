/**
 * AI layer constants — architecture only (Sprint 6).
 * OpenAI is a provider behind the AI Adapter; never the assistant.
 */

export const AI_LAYER_ID = "enarte.ai.assistant.ai";
export const AI_LAYER_VERSION = "ai.architecture.sprint6";

/** Provider ids — extensible for future vendors. */
export const AI_PROVIDER_ID = Object.freeze({
  STUB: "stub",
  OPENAI: "openai",
  /** Reserved for future providers */
  ANTHROPIC: "anthropic",
  AZURE_OPENAI: "azure_openai",
});

export const AI_PROVIDER_STATUS = Object.freeze({
  REGISTERED: "registered",
  PLANNED: "planned",
  STUB: "stub",
  READY: "ready",
  DISABLED: "disabled",
  UNAVAILABLE: "unavailable",
});

/**
 * Capability kinds the AI Adapter may serve.
 * Decision Engine / Intent Router consume signals — AI never owns routing.
 */
export const AI_CAPABILITY_KIND = Object.freeze({
  /** Full conversational assistant turn with tool calling. */
  ASSISTANT_CHAT: "assistant_chat",
  NLU: "nlu",
  INTENT_CLASSIFICATION: "intent_classification",
  ENTITY_EXTRACTION: "entity_extraction",
  IMAGE_UNDERSTANDING: "image_understanding",
  ROOM_ANALYSIS: "room_analysis",
  RESPONSE_REWRITING: "response_rewriting",
  STRUCTURED_JSON: "structured_json",
});

export const AI_REQUEST_STATUS = Object.freeze({
  SUCCESS: "success",
  DEGRADED: "degraded",
  TIMEOUT: "timeout",
  VALIDATION_FAILED: "validation_failed",
  PROVIDER_ERROR: "provider_error",
  UNAVAILABLE: "unavailable",
  NOT_IMPLEMENTED: "not_implemented",
  DISABLED: "disabled",
});

export const AI_FALLBACK_STRATEGY = Object.freeze({
  /** Return degraded result; caller uses Intent Router patterns / Knowledge. */
  DEGRADE: "degrade",
  /** Try next provider in the chain. */
  NEXT_PROVIDER: "next_provider",
  /** Retry same provider then degrade. */
  RETRY_THEN_DEGRADE: "retry_then_degrade",
});

export const AI_ADAPTER_ID = "ai.adapter";
export const LLM_STUB_ADAPTER_ID = "llm.stub";
