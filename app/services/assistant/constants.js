/**
 * ENARTE AI Assistant — shared constants (no business rules).
 */

export const ASSISTANT_MODULE_ID = "enarte.ai.assistant";
export const ASSISTANT_PHASE = "sprint9.ai_conversation";
export const ASSISTANT_VERSION = "assistant.v1.sprint9.ai_conversation";

/** Do not invent ENARTE business rules — Knowledge Layer only. */
export const ARCHITECTURE_FROZEN = true;

export const MODULE_STATUS = Object.freeze({
  FOUNDATION: "foundation",
  PLANNED: "planned",
  NOT_IMPLEMENTED: "not_implemented",
  PLACEHOLDER: "placeholder",
  ACTIVE: "active",
});

export const WORKFLOW_STATUS = Object.freeze({
  REGISTERED: "registered",
  PLANNED: "planned",
  NOT_IMPLEMENTED: "not_implemented",
  PLACEHOLDER: "placeholder",
  ACTIVE: "active",
});

export const CAPABILITY_STATUS = Object.freeze({
  RESERVED: "reserved",
  PLANNED: "planned",
  NOT_IMPLEMENTED: "not_implemented",
  ACTIVE: "active",
});

export const ADAPTER_STATUS = Object.freeze({
  STUB: "stub",
  PLANNED: "planned",
  NOT_IMPLEMENTED: "not_implemented",
  ACTIVE: "active",
});

export const MESSAGE_ROLE = Object.freeze({
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
  TOOL: "tool",
});

export const CONVERSATION_STATUS = Object.freeze({
  ACTIVE: "active",
  CLOSED: "closed",
  ARCHIVED: "archived",
});

export const CHANNEL = Object.freeze({
  API: "api",
  ADMIN: "admin",
  STOREFRONT: "storefront",
  INTERNAL: "internal",
});

export const EVENT_TYPE = Object.freeze({
  SESSION_CREATED: "session.created",
  TURN_RECEIVED: "turn.received",
  INTENT_ROUTED: "intent.routed",
  WORKFLOW_SELECTED: "workflow.selected",
  WORKFLOW_SKIPPED: "workflow.skipped",
  WORKFLOW_DELEGATED: "workflow.delegated",
  CAPABILITY_INVOKED: "capability.invoked",
  MODULE_HOOK: "module.hook",
  ERROR: "error",
});
