/**
 * Workflow transition graph — orchestration only.
 *
 * Defines how conversation phases move given transition events.
 * Does NOT encode prices, policies, or other business rules.
 */

import { CONVERSATION_PHASE, TRANSITION_EVENT } from "./constants.js";

/**
 * Each edge: fromPhase + event → toPhase + optional nextWorkflow hint.
 */
export const TRANSITION_GRAPH = Object.freeze([
  {
    from: CONVERSATION_PHASE.WELCOME,
    event: TRANSITION_EVENT.ACTION_SELECTED,
    to: CONVERSATION_PHASE.IN_WORKFLOW,
  },
  {
    from: CONVERSATION_PHASE.WELCOME,
    event: TRANSITION_EVENT.USER_MESSAGE,
    to: CONVERSATION_PHASE.IN_WORKFLOW,
  },

  // Product search path
  {
    from: CONVERSATION_PHASE.PRODUCT_SEARCH,
    event: TRANSITION_EVENT.PRODUCTS_FOUND,
    to: CONVERSATION_PHASE.PRODUCT_FOUND,
    nextWorkflowHint: null,
  },
  {
    from: CONVERSATION_PHASE.PRODUCT_SEARCH,
    event: TRANSITION_EVENT.SIMILAR_PRODUCTS,
    to: CONVERSATION_PHASE.SIMILAR_PRODUCTS,
  },
  {
    from: CONVERSATION_PHASE.PRODUCT_SEARCH,
    event: TRANSITION_EVENT.NO_MATCH,
    to: CONVERSATION_PHASE.SOURCING,
    nextWorkflowHint: "product_sourcing",
  },
  {
    from: CONVERSATION_PHASE.PRODUCT_SEARCH,
    event: TRANSITION_EVENT.SOURCING_TRIGGERED,
    to: CONVERSATION_PHASE.SOURCING,
  },

  // After products → recommendation → checkout
  {
    from: CONVERSATION_PHASE.PRODUCT_FOUND,
    event: TRANSITION_EVENT.RECOMMEND,
    to: CONVERSATION_PHASE.RECOMMENDATION,
    nextWorkflowHint: "product_recommendations",
  },
  {
    from: CONVERSATION_PHASE.SIMILAR_PRODUCTS,
    event: TRANSITION_EVENT.RECOMMEND,
    to: CONVERSATION_PHASE.RECOMMENDATION,
    nextWorkflowHint: "product_recommendations",
  },
  {
    from: CONVERSATION_PHASE.PRODUCT_FOUND,
    event: TRANSITION_EVENT.CHECKOUT,
    to: CONVERSATION_PHASE.CHECKOUT,
    nextWorkflowHint: "checkout",
  },
  {
    from: CONVERSATION_PHASE.RECOMMENDATION,
    event: TRANSITION_EVENT.CHECKOUT,
    to: CONVERSATION_PHASE.CHECKOUT,
    nextWorkflowHint: "checkout",
  },
  {
    from: CONVERSATION_PHASE.SIMILAR_PRODUCTS,
    event: TRANSITION_EVENT.CHECKOUT,
    to: CONVERSATION_PHASE.CHECKOUT,
    nextWorkflowHint: "checkout",
  },

  // Image search → no match
  {
    from: CONVERSATION_PHASE.IMAGE_SEARCH,
    event: TRANSITION_EVENT.IMAGE_NO_MATCH,
    to: CONVERSATION_PHASE.IMAGE_NO_MATCH,
  },
  {
    from: CONVERSATION_PHASE.IMAGE_SEARCH,
    event: TRANSITION_EVENT.NO_MATCH,
    to: CONVERSATION_PHASE.IMAGE_NO_MATCH,
  },
  {
    from: CONVERSATION_PHASE.IMAGE_NO_MATCH,
    event: TRANSITION_EVENT.SOURCING_TRIGGERED,
    to: CONVERSATION_PHASE.SOURCING,
    nextWorkflowHint: "product_sourcing",
  },

  // Clarification / domain
  {
    from: "*",
    event: TRANSITION_EVENT.CLARIFY,
    to: CONVERSATION_PHASE.AWAITING_CLARIFICATION,
  },
  {
    from: CONVERSATION_PHASE.AWAITING_CLARIFICATION,
    event: TRANSITION_EVENT.ACTION_SELECTED,
    to: CONVERSATION_PHASE.IN_WORKFLOW,
  },
  {
    from: CONVERSATION_PHASE.AWAITING_CLARIFICATION,
    event: TRANSITION_EVENT.USER_MESSAGE,
    to: CONVERSATION_PHASE.IN_WORKFLOW,
  },
  {
    from: "*",
    event: TRANSITION_EVENT.ESCALATE,
    to: CONVERSATION_PHASE.ESCALATED,
    nextWorkflowHint: "admin_notifications",
  },
  {
    from: "*",
    event: TRANSITION_EVENT.RESET,
    to: CONVERSATION_PHASE.WELCOME,
  },
]);

/** Map workflow ids → starting phase when that workflow begins. */
export const WORKFLOW_ENTRY_PHASE = Object.freeze({
  chandelier: CONVERSATION_PHASE.PRODUCT_SEARCH,
  fan: CONVERSATION_PHASE.PRODUCT_SEARCH,
  outdoor_lighting: CONVERSATION_PHASE.PRODUCT_SEARCH,
  product_search: CONVERSATION_PHASE.PRODUCT_SEARCH,
  image_search: CONVERSATION_PHASE.IMAGE_SEARCH,
  product_recommendations: CONVERSATION_PHASE.RECOMMENDATION,
  checkout: CONVERSATION_PHASE.CHECKOUT,
  product_sourcing: CONVERSATION_PHASE.SOURCING,
  room_analysis: CONVERSATION_PHASE.ROOM_ANALYSIS,
  delivery: CONVERSATION_PHASE.DELIVERY,
  installation: CONVERSATION_PHASE.INSTALLATION,
  maintenance: CONVERSATION_PHASE.INSTALLATION,
  site_inspection: CONVERSATION_PHASE.INSTALLATION,
  suggestions_feedback: CONVERSATION_PHASE.FEEDBACK,
  general_chat: CONVERSATION_PHASE.GENERAL,
  describe_looking_for: CONVERSATION_PHASE.GENERAL,
  ai_assisted_chat: CONVERSATION_PHASE.GENERAL,
});

/**
 * Resolve next phase from graph.
 * @returns {{ to: string, nextWorkflowHint: string|null, matched: boolean }}
 */
export function resolveTransition(fromPhase, event) {
  const exact = TRANSITION_GRAPH.find(
    (edge) => edge.from === fromPhase && edge.event === event,
  );
  if (exact) {
    return Object.freeze({
      to: exact.to,
      nextWorkflowHint: exact.nextWorkflowHint || null,
      matched: true,
      edge: exact,
    });
  }

  const wildcard = TRANSITION_GRAPH.find(
    (edge) => edge.from === "*" && edge.event === event,
  );
  if (wildcard) {
    return Object.freeze({
      to: wildcard.to,
      nextWorkflowHint: wildcard.nextWorkflowHint || null,
      matched: true,
      edge: wildcard,
    });
  }

  return Object.freeze({
    to: fromPhase,
    nextWorkflowHint: null,
    matched: false,
    edge: null,
  });
}

/**
 * Map a workflow leaf action to a transition event.
 */
export function eventFromWorkflowAction(action) {
  switch (action) {
    case "products_found":
      return TRANSITION_EVENT.PRODUCTS_FOUND;
    case "similar_products":
      return TRANSITION_EVENT.SIMILAR_PRODUCTS;
    case "sourcing_triggered":
    case "sourcing_queued":
      return TRANSITION_EVENT.SOURCING_TRIGGERED;
    case "clarify":
      return TRANSITION_EVENT.CLARIFY;
    case "out_of_domain":
      return TRANSITION_EVENT.OUT_OF_DOMAIN;
    case "reply":
      return TRANSITION_EVENT.REPLY;
    case "placeholder":
      return TRANSITION_EVENT.PLACEHOLDER_DONE;
    case "error":
      // Recoverable workflow errors must not force conversation escalation.
      return null;
    default:
      return null;
  }
}
