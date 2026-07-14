/**
 * Prompt system constants — Sprint 8.
 */

export const PROMPT_SYSTEM_VERSION = "prompt.system.sprint8";

export const PROMPT_ROLE = Object.freeze({
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
  TOOL: "tool",
});

export const PROMPT_KIND = Object.freeze({
  CONSTITUTION: "constitution",
  NLU: "nlu",
  INTENT_CLASSIFICATION: "intent_classification",
  ENTITY_EXTRACTION: "entity_extraction",
  IMAGE_UNDERSTANDING: "image_understanding",
  ROOM_ANALYSIS: "room_analysis",
  RESPONSE_REWRITING: "response_rewriting",
  STRUCTURED_JSON: "structured_json",
  CAPABILITY: "capability",
});

export const PROMPT_STATUS = Object.freeze({
  DRAFT: "draft",
  REGISTERED: "registered",
  ACTIVE: "active",
  DEPRECATED: "deprecated",
  CONTENT_NOT_READY: "content_not_ready",
});

/** Constitution prompt id — single governing charter for AI capabilities. */
export const AI_CONSTITUTION_PROMPT_ID = "constitution.enarte";
export const AI_CONSTITUTION_VERSION = "1.0.0";
