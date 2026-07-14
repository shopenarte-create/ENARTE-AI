/**
 * Assistant Brain — Decision Engine + Conversation State Manager.
 */

export {
  CONVERSATION_PHASE,
  DECISION_KIND,
  TRANSITION_EVENT,
  SMART_BUTTON_SET,
  ESCALATION_REASON,
} from "./constants.js";

export {
  TRANSITION_GRAPH,
  WORKFLOW_ENTRY_PHASE,
  resolveTransition,
  eventFromWorkflowAction,
} from "./transitions.js";

export {
  createConversationState,
  getConversationState,
  ensureConversationState,
  updateConversationState,
  setConversationState,
  resetConversationState,
  listConversationStates,
} from "./state.js";

export {
  decide,
  commitDecisionResult,
  toTurnInput,
} from "./decision-engine.js";

export { resolveSmartButtonSet } from "./smart-button-sets.js";
