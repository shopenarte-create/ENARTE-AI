/**
 * Conversation State Manager.
 *
 * Remembers orchestration context across turns.
 * Does not store business rules — only workflow/UX state.
 */

import { CONVERSATION_PHASE } from "./constants.js";

/** @type {Map<string, object>} */
const states = new Map();

function freezeState(state) {
  return Object.freeze({
    conversationId: state.conversationId,
    phase: state.phase,
    currentWorkflow: state.currentWorkflow,
    previousAction: state.previousAction,
    clarification: Object.freeze({
      active: Boolean(state.clarification?.active),
      count: state.clarification?.count || 0,
      lastQuestion: state.clarification?.lastQuestion || null,
    }),
    selectedProduct: state.selectedProduct
      ? Object.freeze({ ...state.selectedProduct })
      : null,
    selectedRoom: state.selectedRoom
      ? Object.freeze({ ...state.selectedRoom })
      : null,
    uploadedImages: Object.freeze([...(state.uploadedImages || [])]),
    context: Object.freeze({ ...(state.context || {}) }),
    lastDecision: state.lastDecision
      ? Object.freeze({ ...state.lastDecision })
      : null,
    transitionLog: Object.freeze([...(state.transitionLog || [])].slice(-20)),
    updatedAt: state.updatedAt || new Date().toISOString(),
  });
}

export function createConversationState(conversationId, seed = {}) {
  const state = {
    conversationId,
    phase: seed.phase || CONVERSATION_PHASE.WELCOME,
    currentWorkflow: seed.currentWorkflow || null,
    previousAction: seed.previousAction || null,
    clarification: {
      active: false,
      count: 0,
      lastQuestion: null,
      ...(seed.clarification || {}),
    },
    selectedProduct: seed.selectedProduct || null,
    selectedRoom: seed.selectedRoom || null,
    uploadedImages: [...(seed.uploadedImages || [])],
    context: { ...(seed.context || {}) },
    lastDecision: seed.lastDecision || null,
    transitionLog: [...(seed.transitionLog || [])],
    updatedAt: new Date().toISOString(),
  };
  states.set(conversationId, state);
  return freezeState(state);
}

export function getConversationState(conversationId) {
  if (!conversationId) return null;
  const state = states.get(conversationId);
  return state ? freezeState(state) : null;
}

export function ensureConversationState(conversationId, seed) {
  const existing = getConversationState(conversationId);
  if (existing) return existing;
  return createConversationState(conversationId, seed);
}

/**
 * Patch mutable fields on the conversation state.
 */
export function updateConversationState(conversationId, patch = {}) {
  const current = states.get(conversationId);
  if (!current) {
    return createConversationState(conversationId, patch);
  }

  if (patch.phase != null) current.phase = patch.phase;
  if (patch.currentWorkflow !== undefined) {
    current.currentWorkflow = patch.currentWorkflow;
  }
  if (patch.previousAction !== undefined) {
    current.previousAction = patch.previousAction;
  }
  if (patch.clarification) {
    current.clarification = {
      ...current.clarification,
      ...patch.clarification,
    };
  }
  if (patch.selectedProduct !== undefined) {
    current.selectedProduct = patch.selectedProduct;
  }
  if (patch.selectedRoom !== undefined) {
    current.selectedRoom = patch.selectedRoom;
  }
  if (patch.uploadedImages) {
    current.uploadedImages = [...patch.uploadedImages];
  }
  if (patch.appendImage) {
    current.uploadedImages = [...current.uploadedImages, patch.appendImage];
  }
  if (patch.context) {
    current.context = { ...current.context, ...patch.context };
  }
  if (patch.lastDecision !== undefined) {
    current.lastDecision = patch.lastDecision;
  }
  if (patch.transition) {
    current.transitionLog.push({
      ...patch.transition,
      at: new Date().toISOString(),
    });
    if (current.transitionLog.length > 40) {
      current.transitionLog = current.transitionLog.slice(-40);
    }
  }

  current.updatedAt = new Date().toISOString();
  states.set(conversationId, current);
  return freezeState(current);
}

/**
 * Replace / merge conversation state fields (alias used by AI chat workflow).
 */
export function setConversationState(conversationId, next = {}) {
  if (!conversationId) return null;
  if (!states.has(conversationId)) {
    return createConversationState(conversationId, next);
  }
  return updateConversationState(conversationId, {
    phase: next.phase,
    currentWorkflow: next.currentWorkflow,
    previousAction: next.previousAction,
    clarification: next.clarification,
    selectedProduct: next.selectedProduct,
    selectedRoom: next.selectedRoom,
    uploadedImages: next.uploadedImages,
    context: next.context,
    lastDecision: next.lastDecision,
  });
}

export function resetConversationState(conversationId) {
  if (conversationId) states.delete(conversationId);
  else states.clear();
}

export function listConversationStates() {
  return [...states.keys()];
}
