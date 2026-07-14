/**
 * Decision Engine / conversation-state constants.
 * Orchestration vocabulary only — no ENARTE business rules.
 */

export const CONVERSATION_PHASE = Object.freeze({
  WELCOME: "welcome",
  AWAITING_CLARIFICATION: "awaiting_clarification",
  IN_WORKFLOW: "in_workflow",
  PRODUCT_SEARCH: "product_search",
  PRODUCT_FOUND: "product_found",
  SIMILAR_PRODUCTS: "similar_products",
  SOURCING: "sourcing",
  IMAGE_SEARCH: "image_search",
  IMAGE_NO_MATCH: "image_no_match",
  RECOMMENDATION: "recommendation",
  CHECKOUT: "checkout",
  ROOM_ANALYSIS: "room_analysis",
  DELIVERY: "delivery",
  INSTALLATION: "installation",
  FEEDBACK: "feedback",
  GENERAL: "general",
  ESCALATED: "escalated",
  IDLE: "idle",
});

/** High-level decision kinds from the Decision Engine. */
export const DECISION_KIND = Object.freeze({
  RUN_WORKFLOW: "run_workflow",
  CLARIFY: "clarify",
  SHOW_ACTIONS: "show_actions",
  ESCALATE: "escalate",
  CONTINUE: "continue",
  TRANSITION: "transition",
});

/** Events that advance the conversation graph (workflow outcomes / UX). */
export const TRANSITION_EVENT = Object.freeze({
  SESSION_STARTED: "session_started",
  ACTION_SELECTED: "action_selected",
  USER_MESSAGE: "user_message",
  PRODUCTS_FOUND: "products_found",
  SIMILAR_PRODUCTS: "similar_products",
  NO_MATCH: "no_match",
  SOURCING_TRIGGERED: "sourcing_triggered",
  PLACEHOLDER_DONE: "placeholder_done",
  CLARIFY: "clarify",
  OUT_OF_DOMAIN: "out_of_domain",
  REPLY: "reply",
  RECOMMEND: "recommend",
  CHECKOUT: "checkout",
  IMAGE_NO_MATCH: "image_no_match",
  ESCALATE: "escalate",
  RESET: "reset",
});

export const SMART_BUTTON_SET = Object.freeze({
  NONE: "none",
  WELCOME: "welcome",
  AFTER_PRODUCTS: "after_products",
  AFTER_NO_MATCH: "after_no_match",
  AFTER_IMAGE_NO_MATCH: "after_image_no_match",
  AFTER_CLARIFY: "after_clarify",
});

export const ESCALATION_REASON = Object.freeze({
  NONE: null,
  REPEATED_CLARIFICATION: "repeated_clarification",
  EXPLICIT_REQUEST: "explicit_request",
  WORKFLOW_FAILURE: "workflow_failure",
  OUT_OF_SCOPE_PERSISTENCE: "out_of_scope_persistence",
});
