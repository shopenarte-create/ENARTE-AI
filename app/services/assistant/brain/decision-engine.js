/**
 * Decision Engine — system guardrails & orchestration.
 *
 * Owns: safety gates, photos, UX controls (main menu), escalation, and
 * LLM-unavailable deterministic fallbacks. Does NOT author or rewrite
 * customer replies when the LLM is ready.
 *
 * OpenAI (via ai_assisted_chat) owns: intent, conversation, follow-ups,
 * tool choice, reasoning, and the final customer response — ENARTE domain only.
 * Knowledge + Catalog remain truth tools, not reply authors.
 */

import { routeIntent, ROUTE_DECISION, matchesOutOfDomainMessage } from "../core/intent-router.js";
import { getSmartAction, isMainMenuRequest } from "../ux/smart-actions.js";
import {
  CONVERSATION_PHASE,
  DECISION_KIND,
  SMART_BUTTON_SET,
  ESCALATION_REASON,
  TRANSITION_EVENT,
} from "./constants.js";
import {
  ensureConversationState,
  getConversationState,
  updateConversationState,
} from "./state.js";
import {
  WORKFLOW_ENTRY_PHASE,
  eventFromWorkflowAction,
  resolveTransition,
} from "./transitions.js";
import {
  hasSearchableIntent,
  mergeConversationSlots,
} from "../workflows/_catalog-independent-consult.js";
import {
  isAiConversationReady,
  shouldRouteFreeTextToAi,
  shouldRouteSmartActionToAi,
} from "../ai/conversation.js";

const MAX_CLARIFICATIONS_BEFORE_ESCALATE = 3;

/** Service / policy workflows that should interrupt an active product consult. */
const SERVICE_OVERRIDE_WORKFLOWS = new Set([
  "delivery",
  "installation",
  "maintenance",
  "warranty",
  "returns",
  "contact",
  "admin_notifications",
  "suggestions_feedback",
  "product_sourcing",
  "custom_chandeliers",
]);

function resolveServiceRoute(message = "") {
  if (!message) return null;
  const route = routeIntent({ message });
  if (
    route.decision === ROUTE_DECISION.ROUTE &&
    route.resolved &&
    route.workflowId &&
    SERVICE_OVERRIDE_WORKFLOWS.has(route.workflowId)
  ) {
    return route;
  }
  return null;
}

function isExplicitServiceRoute(message = "") {
  return Boolean(resolveServiceRoute(message));
}

function isVagueContinuation(message = "") {
  const text = String(message || "")
    .trim()
    .toLowerCase()
    .replace(/[!.?…]+$/g, "");
  if (!text || text.length > 28) return false;
  return /^(hmm+|hm+|ok|okay|yes|yeah|yep|sure|maybe|perhaps|idk|not sure|مم+|أوك|نعم|حسنا|تمام)$/.test(
    text,
  );
}

function mergedDescribeSlots(state, message = "", extra = {}) {
  return mergeConversationSlots(
    message,
    {
      ...(state?.context?.describeSlots || {}),
      ...(extra.describeSlots || {}),
    },
  );
}

function shouldContinueProductThread(state, message = "") {
  if (!state?.context?.conversationActive) return false;
  if (isExplicitServiceRoute(message)) return false;
  const prevSlots = state?.context?.describeSlots || {};
  const slots = mergedDescribeSlots(state, message);
  if (hasSearchableIntent(slots, message)) return true;
  if (state?.context?.awaitingConsultDetail) {
    return (
      hasSlotRefinement(message, prevSlots) || isVagueContinuation(message)
    );
  }
  if (
    state?.currentWorkflow === "product_search" ||
    state?.currentWorkflow === "describe_looking_for"
  ) {
    return hasSlotRefinement(message, prevSlots);
  }
  return false;
}

function hasRememberedProductContext(state) {
  const slots = state?.context?.describeSlots || {};
  return (
    state?.context?.awaitingConsultDetail === true ||
    Boolean(slots.productType || slots.style || slots.color || slots.room)
  );
}

function buildProductSearchContinuation(input, state, extra = {}) {
  const slots = mergedDescribeSlots(state, input.message || "", extra);
  return buildDecision({
    kind: DECISION_KIND.RUN_WORKFLOW,
    workflowId: "product_search",
    intent: "product_search",
    message: input.message,
    artifacts: Object.freeze({
      ...(input.artifacts || {}),
      describeSlots: slots,
      resumeConsult: true,
      ...extra,
    }),
    needsClarification: false,
    showSmartButtons: false,
    smartButtonSet: SMART_BUTTON_SET.NONE,
    skipGeneralDispatch: true,
    transitionEvent: TRANSITION_EVENT.USER_MESSAGE,
    statePhase: CONVERSATION_PHASE.PRODUCT_SEARCH,
    contextPatch: continueConversationPatch({ freeChatMode: true }),
    note: extra.note || "Continue product consultation with remembered slots.",
  });
}

function hasSlotRefinement(message, existingSlots = {}) {
  const prev = existingSlots || {};
  const merged = mergeConversationSlots(message, prev);
  const keys = new Set([...Object.keys(prev), ...Object.keys(merged)]);
  for (const key of keys) {
    if (merged[key] && merged[key] !== prev[key]) return true;
  }
  return false;
}

function parseChoiceActionId(actionId) {
  const raw = String(actionId || "");
  const match = /^choice:([a-zA-Z]+):([a-zA-Z0-9_-]+)$/.exec(raw);
  if (!match) return null;
  return Object.freeze({ step: match[1], value: match[2], choiceId: raw });
}

function describeArtifactsFromState(state, extra = {}) {
  return Object.freeze({
    describeSlots: {
      ...(state?.context?.describeSlots || {}),
      ...(extra.describeSlots || {}),
    },
    describeStep: extra.describeStep || state?.context?.describeStep || null,
    choiceId: extra.choiceId || null,
  });
}

/** Conversation already underway — never reopen the main menu mid-flow. */
function isConversationActive(state) {
  return Boolean(
    state?.context?.conversationActive || state?.context?.freeChatMode,
  );
}

function continueConversationPatch(extra = {}) {
  return Object.freeze({
    conversationActive: true,
    ...extra,
  });
}

function leafAction(turn) {
  const wr = turn?.workflowResult;
  if (wr?.action === "delegate" && wr.delegated) {
    return wr.delegated.action;
  }
  return wr?.action || null;
}

function leafData(turn) {
  const wr = turn?.workflowResult;
  if (wr?.action === "delegate" && wr.delegated) {
    return {
      ...(wr.data || {}),
      ...(wr.delegated.data || {}),
    };
  }
  return wr?.data || {};
}

/**
 * Decide the next orchestration step for a chat turn.
 *
 * @param {object} input
 * @param {object} [input.state] conversation state snapshot
 * @param {string} [input.message]
 * @param {string} [input.actionId]
 * @param {string} [input.intent]
 * @param {string} [input.workflowId]
 * @param {object} [input.artifacts]
 * @param {object} [input.image] uploaded image descriptor
 */
export function decide(input = {}) {
  const state =
    input.state ||
    (input.conversationId
      ? ensureConversationState(input.conversationId)
      : null);

  const clarificationCount = state?.clarification?.count || 0;

  // Explicit escalation request via artifact/flag
  if (input.escalate === true) {
    return buildDecision({
      kind: DECISION_KIND.ESCALATE,
      escalate: true,
      escalationReason: ESCALATION_REASON.EXPLICIT_REQUEST,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      workflowId: "admin_notifications",
      intent: "notify_admin",
      needsClarification: false,
      statePhase: state?.phase || CONVERSATION_PHASE.ESCALATED,
      note: "Explicit escalation requested.",
    });
  }

  // Photo uploads stay deterministic (analyze → catalog / room path).
  // Must run before free-text AI routing ("Photo uploaded" is not a catalog query).
  if (input.image) {
    const hintKind =
      input.image?.photoKind ||
      state?.context?.photoKind ||
      (state?.phase === CONVERSATION_PHASE.IMAGE_SEARCH ? "product" : "room");
    const workflowId =
      state?.context?.awaitingPhoto ||
      state?.phase === CONVERSATION_PHASE.ROOM_ANALYSIS ||
      state?.phase === CONVERSATION_PHASE.IMAGE_SEARCH
        ? state?.currentWorkflow ||
          (hintKind === "product" ||
          state?.phase === CONVERSATION_PHASE.IMAGE_SEARCH
            ? "image_search"
            : "room_analysis")
        : hintKind === "product"
          ? "image_search"
          : "room_analysis";
    return buildDecision({
      kind: DECISION_KIND.RUN_WORKFLOW,
      workflowId,
      intent: workflowId === "image_search" ? "search_by_image" : "analyze_room",
      message: input.message || "",
      artifacts: { ...(input.artifacts || {}), image: input.image },
      needsClarification: false,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      skipGeneralDispatch: true,
      statePhase:
        workflowId === "image_search"
          ? CONVERSATION_PHASE.IMAGE_SEARCH
          : CONVERSATION_PHASE.ROOM_ANALYSIS,
      contextPatch: continueConversationPatch({
        awaitingPhoto: false,
        openCamera: false,
        photoReceived: true,
        photoKind: workflowId === "image_search" ? "product" : "room",
        freeChatMode: true,
      }),
      note: "Photo uploaded — analyze then search ENARTE catalog.",
    });
  }

  // Explicit main-menu request — UX control kept on Decision Engine.
  if (
    !input.actionId &&
    input.message &&
    (isMainMenuRequest(input.message) ||
      String(input.intent || "").toLowerCase() === "main_menu")
  ) {
    return buildDecision({
      kind: DECISION_KIND.SHOW_ACTIONS,
      needsClarification: false,
      showSmartButtons: true,
      smartButtonSet: SMART_BUTTON_SET.WELCOME,
      workflowId: "general_chat",
      intent: "main_menu",
      message: input.message,
      skipGeneralDispatch: false,
      statePhase: CONVERSATION_PHASE.WELCOME,
      contextPatch: Object.freeze({
        freeChatMode: false,
        conversationActive: false,
        awaitingDescribe: false,
        describeStep: null,
        describeSlots: {},
        requestMainMenu: true,
      }),
      note: "Customer requested main menu.",
    });
  }

  // Normal free-text → OpenAI is the primary decision maker (tools + reply)
  // inside the ENARTE domain. Hard-block clear off-topic first so the model
  // never reuses the previous lighting reply.
  if (shouldRouteFreeTextToAi(input) && isAiConversationReady()) {
    if (matchesOutOfDomainMessage(input.message)) {
      return buildDecision({
        kind: DECISION_KIND.CLARIFY,
        needsClarification: false,
        outOfDomain: true,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        workflowId: "general_chat",
        intent: "out_of_domain",
        message: input.message,
        skipGeneralDispatch: true,
        artifacts: Object.freeze({
          ...(input.artifacts || {}),
          forceOutOfDomain: true,
        }),
        statePhase: CONVERSATION_PHASE.GENERAL,
        contextPatch: continueConversationPatch({ freeChatMode: true }),
        note: "Out of domain — hard refuse (skip OpenAI so prior product context is not reused).",
      });
    }

    const aiSlots = mergedDescribeSlots(state, input.message || "");
    const serviceHint = resolveServiceRoute(input.message);
    return buildDecision({
      kind: DECISION_KIND.RUN_WORKFLOW,
      workflowId: "ai_assisted_chat",
      intent: "assistant_chat",
      message: input.message,
      artifacts: Object.freeze({
        ...(input.artifacts || {}),
        describeSlots: aiSlots,
        ...(serviceHint
          ? {
              suggestedKnowledgeModule: serviceHint.workflowId,
              suggestedWorkflowId: serviceHint.workflowId,
            }
          : {}),
      }),
      needsClarification: false,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      skipGeneralDispatch: true,
      transitionEvent: TRANSITION_EVENT.USER_MESSAGE,
      statePhase: CONVERSATION_PHASE.GENERAL,
      contextPatch: continueConversationPatch({
        freeChatMode: true,
        conversationActive: true,
        describeSlots: aiSlots,
      }),
      note: serviceHint
        ? `Free-text ENARTE service topic (${serviceHint.workflowId}) — OpenAI uses Knowledge/workflow tools.`
        : "Free-text ENARTE conversation — OpenAI decides tools and reply.",
    });
  }

  // LLM unavailable: deterministic Knowledge workflows for policy/service intents.
  if (!input.actionId && input.message) {
    const serviceRoute = resolveServiceRoute(input.message);
    if (serviceRoute) {
      return buildDecision({
        kind: DECISION_KIND.RUN_WORKFLOW,
        workflowId: serviceRoute.workflowId,
        intent: serviceRoute.intent,
        message: input.message,
        artifacts: input.artifacts || {},
        needsClarification: false,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        skipGeneralDispatch: true,
        route: serviceRoute,
        statePhase:
          WORKFLOW_ENTRY_PHASE[serviceRoute.workflowId] ||
          CONVERSATION_PHASE.IN_WORKFLOW,
        contextPatch: continueConversationPatch({
          freeChatMode: true,
          awaitingCategorySlot: false,
          awaitingChandelierRoom: false,
          awaitingConsultDetail: false,
        }),
        note: "Service / policy intent — Knowledge workflow (LLM unavailable).",
      });
    }
  }

  // --- LLM-off / button fallbacks below (deterministic) ---

  // Category journeys (chandelier / fan / outdoor): awaiting slot reply.
  if (
    !input.actionId &&
    input.message &&
    !resolveServiceRoute(input.message) &&
    state?.clarification?.active &&
    ["chandelier", "fan", "outdoor_lighting"].includes(state?.currentWorkflow) &&
    (state?.context?.awaitingCategorySlot ||
      state?.context?.awaitingChandelierRoom ||
      state?.previousAction === "clarify")
  ) {
    const slot = String(input.message).trim();
    const workflowId = state.currentWorkflow;
    const intentByWorkflow = {
      chandelier: "buy_chandelier",
      fan: "buy_fan",
      outdoor_lighting: "buy_outdoor",
    };
    const categoryByWorkflow = {
      chandelier: "chandeliers",
      fan: "fans",
      outdoor_lighting: "outdoor",
    };
    return buildDecision({
      kind: DECISION_KIND.RUN_WORKFLOW,
      workflowId,
      intent: intentByWorkflow[workflowId] || workflowId,
      message: input.message,
      artifacts: Object.freeze({
        ...(input.artifacts || {}),
        room: slot,
        category: categoryByWorkflow[workflowId] || null,
        keywords: Object.freeze([slot]),
      }),
      needsClarification: false,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      skipGeneralDispatch: true,
      transitionEvent: TRANSITION_EVENT.USER_MESSAGE,
      statePhase: CONVERSATION_PHASE.PRODUCT_SEARCH,
      contextPatch: Object.freeze({
        awaitingCategorySlot: false,
        awaitingChandelierRoom: false,
        selectedRoomName: slot,
        conversationActive: true,
        freeChatMode: true,
      }),
      note: `${workflowId} journey — slot identified → product search.`,
    });
  }

  // Suggestions & feedback: awaiting free-text feedback body.
  if (
    !input.actionId &&
    input.message &&
    !resolveServiceRoute(input.message) &&
    state?.clarification?.active &&
    state?.currentWorkflow === "suggestions_feedback" &&
    (state?.context?.awaitingFeedback || state?.previousAction === "clarify")
  ) {
    return buildDecision({
      kind: DECISION_KIND.RUN_WORKFLOW,
      workflowId: "suggestions_feedback",
      intent: "suggestions_feedback",
      message: input.message,
      artifacts: Object.freeze({
        ...(input.artifacts || {}),
        resumeFeedback: true,
        feedbackBody: String(input.message).trim(),
      }),
      needsClarification: false,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      skipGeneralDispatch: true,
      transitionEvent: TRANSITION_EVENT.USER_MESSAGE,
      statePhase: CONVERSATION_PHASE.FEEDBACK,
      contextPatch: Object.freeze({ awaitingFeedback: false, conversationActive: true }),
      note: "Feedback journey — collect text → acknowledge.",
    });
  }

  // Guided describe flow — continue one question at a time.
  const choice = parseChoiceActionId(input.actionId);
  if (
    choice ||
    (state?.context?.awaitingDescribe &&
      state?.currentWorkflow === "describe_looking_for" &&
      (input.message || input.actionId))
  ) {
    const artifacts = describeArtifactsFromState(state, {
      ...(input.artifacts || {}),
      ...(choice
        ? { choiceId: choice.choiceId, describeStep: choice.step }
        : {}),
    });
    return buildDecision({
      kind: DECISION_KIND.RUN_WORKFLOW,
      workflowId: "describe_looking_for",
      intent: "describe_looking_for",
      message: choice ? choice.value : input.message,
      artifacts,
      needsClarification: false,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      skipGeneralDispatch: true,
      transitionEvent: TRANSITION_EVENT.USER_MESSAGE,
      statePhase: CONVERSATION_PHASE.GENERAL,
      contextPatch: continueConversationPatch({
        freeChatMode: false,
        awaitingDescribe: true,
      }),
      note: "Describe-looking-for continuation.",
    });
  }

  // Keep product consultation continuous while a follow-up / slot refinement is in play.
  if (
    !input.actionId &&
    !input.image &&
    input.message &&
    shouldContinueProductThread(state, input.message)
  ) {
    return buildProductSearchContinuation(input, state);
  }

  // Smart action selected — map to workflow without re-inferring intent text.
  if (input.actionId) {
    const action = getSmartAction(input.actionId);
    if (!action) {
      const active = isConversationActive(state);
      return buildDecision({
        kind: DECISION_KIND.CLARIFY,
        needsClarification: true,
        showSmartButtons: !active,
        smartButtonSet: active
          ? SMART_BUTTON_SET.NONE
          : SMART_BUTTON_SET.AFTER_CLARIFY,
        note: "Unknown smart action.",
        statePhase: CONVERSATION_PHASE.AWAITING_CLARIFICATION,
        contextPatch: continueConversationPatch(),
      });
    }

    if (action.id === "main_menu") {
      return buildDecision({
        kind: DECISION_KIND.SHOW_ACTIONS,
        needsClarification: false,
        showSmartButtons: true,
        smartButtonSet: SMART_BUTTON_SET.WELCOME,
        workflowId: "general_chat",
        intent: "main_menu",
        message: action.message,
        skipGeneralDispatch: false,
        statePhase: CONVERSATION_PHASE.WELCOME,
        contextPatch: Object.freeze({
          freeChatMode: false,
          conversationActive: false,
          awaitingDescribe: false,
          requestMainMenu: true,
        }),
        note: "Main menu smart action.",
      });
    }

    // Conversational smart actions → OpenAI (tools + reply). DE only routes.
    if (isAiConversationReady() && shouldRouteSmartActionToAi(action)) {
      const aiSlots = mergedDescribeSlots(state, action.message || "");
      return buildDecision({
        kind: DECISION_KIND.RUN_WORKFLOW,
        workflowId: "ai_assisted_chat",
        intent: "assistant_chat",
        message: action.message || action.intent || action.id,
        artifacts: Object.freeze({
          ...(action.artifacts || {}),
          ...(input.artifacts || {}),
          describeSlots: aiSlots,
          smartActionId: action.id,
          suggestedWorkflowId: action.workflowId,
          suggestedKnowledgeModule: action.workflowId,
        }),
        needsClarification: false,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        skipGeneralDispatch: true,
        transitionEvent: TRANSITION_EVENT.ACTION_SELECTED,
        statePhase: CONVERSATION_PHASE.GENERAL,
        contextPatch: continueConversationPatch({
          freeChatMode: true,
          conversationActive: true,
          describeSlots: aiSlots,
        }),
        note: `Smart action ${action.id} — OpenAI uses tools and authors the reply.`,
      });
    }

    // Transition shortcuts from product_found / similar (LLM-off / orchestration).
    // Only "Similar Products" — never divert Recommend Lighting (room photo) here.
    if (
      input.actionId === "recommend_products" &&
      (state?.phase === CONVERSATION_PHASE.PRODUCT_FOUND ||
        state?.phase === CONVERSATION_PHASE.SIMILAR_PRODUCTS ||
        state?.phase === CONVERSATION_PHASE.RECOMMENDATION)
    ) {
      return buildDecision({
        kind: DECISION_KIND.RUN_WORKFLOW,
        workflowId: "product_recommendations",
        intent: "recommend_products",
        needsClarification: false,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        transitionEvent: TRANSITION_EVENT.RECOMMEND,
        message: action.message,
        artifacts: action.artifacts || {},
        skipGeneralDispatch: true,
        statePhase: CONVERSATION_PHASE.RECOMMENDATION,
        contextPatch: continueConversationPatch({ freeChatMode: true }),
        note: "Transition: products → recommendation.",
      });
    }

    const skipGeneral = action.workflowId !== "general_chat";
    const asksPhoto =
      action.workflowId === "room_analysis" ||
      action.workflowId === "image_search";
    const isFreeChat = action.id === "talk_to_assistant";
    const isDescribe = action.workflowId === "describe_looking_for";
    return buildDecision({
      kind: DECISION_KIND.RUN_WORKFLOW,
      workflowId: skipGeneral ? action.workflowId : "general_chat",
      intent: action.intent,
      message: action.message,
      artifacts: {
        ...(action.artifacts || {}),
        ...(input.artifacts || {}),
        ...(isDescribe ? describeArtifactsFromState(state, input.artifacts) : {}),
      },
      needsClarification: false,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      skipGeneralDispatch: skipGeneral,
      transitionEvent: TRANSITION_EVENT.ACTION_SELECTED,
      statePhase:
        WORKFLOW_ENTRY_PHASE[action.workflowId] || CONVERSATION_PHASE.IN_WORKFLOW,
      contextPatch: continueConversationPatch({
        ...(asksPhoto
          ? {
              awaitingPhoto: true,
              photoKind:
                action.workflowId === "room_analysis" ? "room" : "product",
              /** UI must ask first — never auto-open camera on entry. */
              openCamera: false,
            }
          : {}),
        freeChatMode: isFreeChat || !isDescribe,
        ...(isDescribe
          ? { awaitingDescribe: true, freeChatMode: false }
          : {}),
        ...(isFreeChat
          ? {
              awaitingDescribe: false,
              describeStep: null,
            }
          : {}),
      }),
      note: `Smart action "${action.id}" selected.`,
    });
  }

  // Continuation hints from state (e.g. checkout after recommend)
  if (input.transitionEvent) {
    const transition = resolveTransition(
      state?.phase || CONVERSATION_PHASE.IDLE,
      input.transitionEvent,
    );
    if (transition.matched && transition.nextWorkflowHint) {
      return buildDecision({
        kind: DECISION_KIND.RUN_WORKFLOW,
        workflowId: transition.nextWorkflowHint,
        needsClarification: false,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        skipGeneralDispatch: true,
        transitionEvent: input.transitionEvent,
        statePhase: transition.to,
        note: `Graph transition via ${input.transitionEvent}.`,
      });
    }
  }

  // Intent Router signal (no business rules here)
  const route = routeIntent({
    message: input.message,
    intent: input.intent,
    workflowId: input.workflowId,
  });

  // Once the customer engages, stay in one continuous conversation.
  const alreadyActive = isConversationActive(state);
  const typedFreeChat = Boolean(input.message && !input.actionId);
  const enterFreeChat = typedFreeChat || alreadyActive;

  if (route.decision === ROUTE_DECISION.OUT_OF_DOMAIN) {
    const escalate =
      clarificationCount >= MAX_CLARIFICATIONS_BEFORE_ESCALATE - 1 &&
      state?.previousAction === "out_of_domain";
    if (escalate) {
      return buildDecision({
        kind: DECISION_KIND.ESCALATE,
        escalate: true,
        escalationReason: ESCALATION_REASON.OUT_OF_SCOPE_PERSISTENCE,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        workflowId: "admin_notifications",
        route,
        needsClarification: false,
        statePhase: CONVERSATION_PHASE.ESCALATED,
        contextPatch: continueConversationPatch({ freeChatMode: true }),
        note: "Repeated out-of-domain — escalate.",
      });
    }
    return buildDecision({
      kind: DECISION_KIND.CLARIFY,
      needsClarification: false,
      outOfDomain: true,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      route,
      workflowId: "general_chat",
      skipGeneralDispatch: false,
      message: input.message,
      statePhase: CONVERSATION_PHASE.GENERAL,
      contextPatch: continueConversationPatch({ freeChatMode: true }),
      note: "Out of domain — specialization reply via general_chat.",
    });
  }

  if (route.decision === ROUTE_DECISION.GENERAL && alreadyActive) {
    const generalSlots = mergedDescribeSlots(state, input.message || "");
    if (hasSearchableIntent(generalSlots, input.message)) {
      return buildProductSearchContinuation(input, state, {
        describeSlots: generalSlots,
        note: "Active conversation — product intent overrides greeting/help route.",
      });
    }
    if (hasRememberedProductContext(state)) {
      return buildProductSearchContinuation(input, state, {
        describeSlots: generalSlots,
        note: "Active conversation — continue remembered product context.",
      });
    }
    return buildDecision({
      kind: DECISION_KIND.RUN_WORKFLOW,
      workflowId: "general_chat",
      intent: route.intent || "general",
      message: input.message,
      artifacts: Object.freeze({
        ...(input.artifacts || {}),
        conversationContinue: true,
        describeSlots: generalSlots,
      }),
      needsClarification: false,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      skipGeneralDispatch: true,
      route,
      statePhase: CONVERSATION_PHASE.GENERAL,
      contextPatch: continueConversationPatch({ freeChatMode: true }),
      note: "Active conversation — contextual reply, no greeting restart.",
    });
  }

  if (route.decision === ROUTE_DECISION.CLARIFY || !route.resolved) {
    // Lighting/product signals → consult immediately (no restart menu).
    const clarifySlots = mergeConversationSlots(
      input.message || "",
      state?.context?.describeSlots || {},
    );
    if (
      input.message &&
      !input.actionId &&
      hasSearchableIntent(clarifySlots, input.message)
    ) {
      return buildDecision({
        kind: DECISION_KIND.RUN_WORKFLOW,
        workflowId: "product_search",
        intent: "product_search",
        message: input.message,
        artifacts: Object.freeze({
          ...(input.artifacts || {}),
          describeSlots: clarifySlots,
        }),
        needsClarification: false,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        skipGeneralDispatch: true,
        route,
        statePhase: CONVERSATION_PHASE.PRODUCT_SEARCH,
        contextPatch: continueConversationPatch({ freeChatMode: true }),
        note: "Ambiguous route but product intent — consult without menu.",
      });
    }

    if (alreadyActive && shouldContinueProductThread(state, input.message)) {
      return buildProductSearchContinuation(input, state, {
        note: "Active conversation — continue product thread instead of menu clarify.",
      });
    }

    if (alreadyActive && hasRememberedProductContext(state)) {
      if (!isExplicitServiceRoute(input.message)) {
        return buildProductSearchContinuation(input, state, {
          describeSlots: clarifySlots,
          note: "Active conversation — vague reply, keep product consult going.",
        });
      }
    }

    if (alreadyActive) {
      return buildDecision({
        kind: DECISION_KIND.RUN_WORKFLOW,
        workflowId: "general_chat",
        intent: "general",
        message: input.message,
        artifacts: Object.freeze({
          ...(input.artifacts || {}),
          conversationContinue: true,
          describeSlots: clarifySlots,
        }),
        needsClarification: false,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        skipGeneralDispatch: true,
        route,
        statePhase: CONVERSATION_PHASE.GENERAL,
        contextPatch: continueConversationPatch({ freeChatMode: true }),
        note: "Active conversation — one natural follow-up, no menu.",
      });
    }

    if (clarificationCount + 1 >= MAX_CLARIFICATIONS_BEFORE_ESCALATE) {
      return buildDecision({
        kind: DECISION_KIND.ESCALATE,
        escalate: true,
        escalationReason: ESCALATION_REASON.REPEATED_CLARIFICATION,
        showSmartButtons: false,
        smartButtonSet: SMART_BUTTON_SET.NONE,
        workflowId: "admin_notifications",
        route,
        needsClarification: false,
        statePhase: CONVERSATION_PHASE.ESCALATED,
        contextPatch: continueConversationPatch({ freeChatMode: true }),
        note: "Too many clarifications — escalate.",
      });
    }
    // Menu only on the very first unclear message at welcome — never mid-conversation.
    const showClarifyMenu =
      !alreadyActive && state?.phase === CONVERSATION_PHASE.WELCOME;
    return buildDecision({
      kind: DECISION_KIND.CLARIFY,
      needsClarification: true,
      showSmartButtons: showClarifyMenu,
      smartButtonSet: showClarifyMenu
        ? SMART_BUTTON_SET.AFTER_CLARIFY
        : SMART_BUTTON_SET.NONE,
      route,
      workflowId: "general_chat",
      skipGeneralDispatch: false,
      message: input.message,
      statePhase: CONVERSATION_PHASE.AWAITING_CLARIFICATION,
      contextPatch: continueConversationPatch({
        // After this turn the conversation is active; subsequent turns stay menu-free.
        freeChatMode: !showClarifyMenu,
      }),
      note: "Clarification required.",
    });
  }

  // Image / room photo intents with no prior image → ask (never auto-open camera)
  if (
    (route.workflowId === "image_search" ||
      route.workflowId === "room_analysis") &&
    !input.image &&
    !(state?.uploadedImages || []).length
  ) {
    const isRoom = route.workflowId === "room_analysis";
    return buildDecision({
      kind: DECISION_KIND.RUN_WORKFLOW,
      workflowId: route.workflowId,
      intent: route.intent,
      message: input.message,
      artifacts: input.artifacts || {},
      needsClarification: false,
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
      skipGeneralDispatch: true,
      route,
      statePhase: isRoom
        ? CONVERSATION_PHASE.ROOM_ANALYSIS
        : CONVERSATION_PHASE.IMAGE_SEARCH,
      contextPatch: continueConversationPatch({
        awaitingPhoto: true,
        photoKind: isRoom ? "room" : "product",
        openCamera: false,
        freeChatMode: true,
      }),
      note: `${route.workflowId} (awaiting photo — no auto-camera).`,
    });
  }

  const entryPhase =
    WORKFLOW_ENTRY_PHASE[route.workflowId] || CONVERSATION_PHASE.IN_WORKFLOW;

  return buildDecision({
    kind: DECISION_KIND.RUN_WORKFLOW,
    workflowId: route.workflowId || "general_chat",
    intent: route.intent,
    message: input.message,
    artifacts: input.artifacts || {},
    needsClarification: false,
    showSmartButtons: false,
    smartButtonSet: SMART_BUTTON_SET.NONE,
    skipGeneralDispatch:
      Boolean(route.workflowId) && route.workflowId !== "general_chat",
    route,
    statePhase: entryPhase,
    contextPatch: continueConversationPatch({ freeChatMode: enterFreeChat }),
    note: "Intent routed to workflow.",
  });
}

/**
 * After a turn completes, update conversation state + derive follow-up UX.
 */
export function commitDecisionResult({
  conversationId,
  decision,
  turn,
  selectedProduct,
  selectedRoom,
  uploadedImage,
} = {}) {
  if (!conversationId) return null;

  ensureConversationState(conversationId);

  const action = leafAction(turn);
  const data = leafData(turn);
  const event =
    eventFromWorkflowAction(action) ||
    decision?.transitionEvent ||
    null;

  let phase = decision?.statePhase || CONVERSATION_PHASE.IDLE;
  let transitionMeta = null;

  if (event) {
    const from =
      WORKFLOW_ENTRY_PHASE[decision?.workflowId] ||
      getConversationState(conversationId)?.phase ||
      phase;
    const resolved = resolveTransition(from, event);
    if (resolved.matched) {
      phase = resolved.to;
      transitionMeta = {
        from,
        to: resolved.to,
        event,
        workflowHint: resolved.nextWorkflowHint,
      };
    }
  }

  // Image search ask-for-photo (camera never opens automatically)
  if (
    decision?.workflowId === "image_search" &&
    (action === "ask_photo" || data.awaitingPhoto)
  ) {
    phase = CONVERSATION_PHASE.IMAGE_SEARCH;
  }
  if (
    decision?.workflowId === "room_analysis" &&
    (action === "ask_photo" || data.awaitingPhoto)
  ) {
    phase = CONVERSATION_PHASE.ROOM_ANALYSIS;
  }

  // Image / room photo path with no vision result yet
  if (
    (decision?.workflowId === "image_search" ||
      decision?.workflowId === "room_analysis") &&
    (action === "placeholder" ||
      action === "error" ||
      data.analysisDeferred === true)
  ) {
    phase = CONVERSATION_PHASE.IMAGE_NO_MATCH;
    transitionMeta = {
      from:
        decision?.workflowId === "image_search"
          ? CONVERSATION_PHASE.IMAGE_SEARCH
          : CONVERSATION_PHASE.ROOM_ANALYSIS,
      to: CONVERSATION_PHASE.IMAGE_NO_MATCH,
      event: TRANSITION_EVENT.IMAGE_NO_MATCH,
    };
  }

  const clarificationActive =
    decision?.needsClarification || action === "clarify";
  const prev = getConversationState(conversationId);

  const roomFromData =
    data.room ||
    data.search?.query?.room ||
    decision?.contextPatch?.selectedRoomName ||
    null;

  const productFromCards =
    selectedProduct ||
    (Array.isArray(data.cards) && data.cards[0]
      ? {
          id: data.cards[0].id,
          title: data.cards[0].title,
          url: data.cards[0].url,
        }
      : Array.isArray(data.search?.cards) && data.search.cards[0]
        ? {
            id: data.search.cards[0].id,
            title: data.search.cards[0].title,
            url: data.search.cards[0].url,
          }
        : undefined);

  const followUpButtons = resolveFollowUpButtons(
    phase,
    action,
    decision,
    data,
    prev,
  );

  const next = updateConversationState(conversationId, {
    phase,
    currentWorkflow: decision?.workflowId || prev?.currentWorkflow || null,
    previousAction: action || decision?.kind || null,
    clarification: {
      active: clarificationActive,
      count: clarificationActive
        ? (prev?.clarification?.count || 0) + 1
        : action && action !== "clarify"
          ? 0
          : prev?.clarification?.count || 0,
      lastQuestion:
        clarificationActive && turn?.workflowResult?.message
          ? turn.workflowResult.message
          : prev?.clarification?.lastQuestion || null,
    },
    selectedProduct:
      selectedProduct != null
        ? selectedProduct
        : productFromCards !== undefined
          ? productFromCards
          : prev?.selectedProduct || null,
    selectedRoom:
      selectedRoom != null
        ? selectedRoom
        : roomFromData
          ? { name: String(roomFromData) }
          : prev?.selectedRoom || null,
    appendImage: uploadedImage || null,
    context: {
      ...(decision?.contextPatch || {}),
      lastLeafAction: action,
      lastWorkflow: decision?.workflowId || null,
      freeChatMode:
        decision?.contextPatch?.requestMainMenu === true
          ? false
          : decision?.contextPatch?.freeChatMode === true
            ? true
            : decision?.contextPatch?.freeChatMode === false
              ? false
              : Boolean(prev?.context?.freeChatMode),
      conversationActive:
        decision?.contextPatch?.requestMainMenu === true
          ? false
          : decision?.contextPatch?.conversationActive === false
            ? false
            : decision?.contextPatch?.conversationActive === true ||
                Boolean(prev?.context?.conversationActive) ||
                Boolean(decision?.workflowId),
      awaitingConsultDetail:
        data.awaitingConsultDetail === true
          ? true
          : data.awaitingConsultDetail === false ||
              action === "products_found" ||
              action === "similar_products" ||
              action === "sourcing_triggered"
            ? false
            : Boolean(prev?.context?.awaitingConsultDetail),
      describeSlots:
        data.describeSlots ||
        decision?.artifacts?.describeSlots ||
        prev?.context?.describeSlots ||
        {},
      awaitingDescribe:
        decision?.workflowId === "describe_looking_for" &&
        (action === "guide_ask" || data.awaitingDescribe)
          ? true
          : decision?.contextPatch?.awaitingDescribe === false ||
              action === "products_found" ||
              action === "similar_products" ||
              action === "sourcing_triggered"
            ? false
            : data.awaitingDescribe === false
              ? false
              : Boolean(prev?.context?.awaitingDescribe),
      describeStep:
        action === "guide_ask"
          ? data.describeStep || null
          : decision?.contextPatch?.describeStep !== undefined
            ? decision.contextPatch.describeStep
            : data.describeStep || prev?.context?.describeStep || null,
      awaitingChandelierRoom:
        decision?.workflowId === "chandelier" && action === "clarify"
          ? true
          : decision?.contextPatch?.awaitingChandelierRoom === false
            ? false
            : data.awaitingRoom
              ? true
              : prev?.context?.awaitingChandelierRoom || false,
      awaitingCategorySlot:
        ["chandelier", "fan", "outdoor_lighting"].includes(
          decision?.workflowId,
        ) &&
        (action === "clarify" || data.awaitingSlot || data.awaitingRoom)
          ? true
          : decision?.contextPatch?.awaitingCategorySlot === false
            ? false
            : prev?.context?.awaitingCategorySlot || false,
      awaitingFeedback:
        decision?.workflowId === "suggestions_feedback" && action === "clarify"
          ? true
          : decision?.contextPatch?.awaitingFeedback === false
            ? false
            : data.awaitingFeedback
              ? true
              : prev?.context?.awaitingFeedback || false,
      awaitingPhoto:
        decision?.contextPatch?.awaitingPhoto === false
          ? false
          : decision?.contextPatch?.awaitingPhoto === true ||
              data.awaitingPhoto ||
              action === "ask_photo"
            ? true
            : Boolean(prev?.context?.awaitingPhoto && !data.photoReceived),
      photoKind:
        decision?.contextPatch?.photoKind ||
        data.photoKind ||
        prev?.context?.photoKind ||
        null,
      openCamera: false,
    },
    lastDecision: {
      kind: decision?.kind,
      workflowId: decision?.workflowId,
      smartButtonSet: followUpButtons.smartButtonSet,
    },
    transition: transitionMeta,
  });

  return Object.freeze({
    state: next,
    showSmartButtons: followUpButtons.showSmartButtons,
    smartButtonSet: followUpButtons.smartButtonSet,
    transition: transitionMeta,
  });
}

function resolveFollowUpButtons(phase, action, decision, data = {}, prev = null) {
  const requestMenu =
    decision?.contextPatch?.requestMainMenu ||
    decision?.intent === "main_menu" ||
    decision?.kind === DECISION_KIND.SHOW_ACTIONS;

  // Explicit menu request always wins.
  if (requestMenu) {
    return {
      showSmartButtons: true,
      smartButtonSet: SMART_BUTTON_SET.WELCOME,
    };
  }

  const alreadyActive = Boolean(
    prev?.context?.conversationActive || prev?.context?.freeChatMode,
  );
  const freeChat =
    decision?.contextPatch?.freeChatMode === true ||
    (decision?.contextPatch?.freeChatMode !== false &&
      Boolean(prev?.context?.freeChatMode));

  // Guided question choices are message-local — never the main smart-action set.
  if (
    action === "guide_ask" ||
    data.awaitingDescribe ||
    action === "ask_photo" ||
    data.awaitingPhoto
  ) {
    return {
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
    };
  }

  // Photo received but vision not available — offer text recovery actions.
  if (
    data.analysisDeferred === true ||
    data.offerRecoveryActions === true ||
    phase === CONVERSATION_PHASE.IMAGE_NO_MATCH
  ) {
    return {
      showSmartButtons: true,
      smartButtonSet: SMART_BUTTON_SET.AFTER_IMAGE_NO_MATCH,
    };
  }

  if (
    action === "clarify" &&
    (["chandelier", "fan", "outdoor_lighting", "suggestions_feedback"].includes(
      decision?.workflowId,
    ) ||
      data.awaitingRoom ||
      data.awaitingSlot ||
      data.awaitingFeedback)
  ) {
    return {
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
    };
  }

  // Active / free conversation: never re-open the main menu mid-chat.
  if (alreadyActive || freeChat) {
    return {
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
    };
  }

  if (decision?.escalate) {
    return {
      showSmartButtons: false,
      smartButtonSet: SMART_BUTTON_SET.NONE,
    };
  }

  // First unclear message at welcome only.
  if (
    decision?.showSmartButtons &&
    (phase === CONVERSATION_PHASE.AWAITING_CLARIFICATION ||
      decision?.needsClarification)
  ) {
    return {
      showSmartButtons: true,
      smartButtonSet: decision.smartButtonSet || SMART_BUTTON_SET.AFTER_CLARIFY,
    };
  }

  if (decision?.showSmartButtons) {
    return {
      showSmartButtons: true,
      smartButtonSet: decision.smartButtonSet || SMART_BUTTON_SET.WELCOME,
    };
  }

  return {
    showSmartButtons: false,
    smartButtonSet: SMART_BUTTON_SET.NONE,
  };
}

function buildDecision(partial) {
  return Object.freeze({
    kind: partial.kind || DECISION_KIND.CONTINUE,
    intent: partial.intent || null,
    workflowId: partial.workflowId || null,
    message: partial.message || null,
    artifacts: Object.freeze({ ...(partial.artifacts || {}) }),
    needsClarification: Boolean(partial.needsClarification),
    outOfDomain: Boolean(partial.outOfDomain),
    showSmartButtons: Boolean(partial.showSmartButtons),
    smartButtonSet: partial.smartButtonSet || SMART_BUTTON_SET.NONE,
    escalate: Boolean(partial.escalate),
    escalationReason: partial.escalationReason || ESCALATION_REASON.NONE,
    skipGeneralDispatch: Boolean(partial.skipGeneralDispatch),
    transitionEvent: partial.transitionEvent || null,
    statePhase: partial.statePhase || null,
    route: partial.route || null,
    contextPatch: Object.freeze({ ...(partial.contextPatch || {}) }),
    note: partial.note || null,
  });
}

/**
 * Build handleTurn input from a Decision Engine decision.
 */
export function toTurnInput(decision, base = {}) {
  if (decision.kind === DECISION_KIND.ESCALATE) {
    return {
      ...base,
      message: base.message || decision.message || "escalate",
      workflowId: "admin_notifications",
      intent: "notify_admin",
      skipGeneralDispatch: true,
      artifacts: { ...(base.artifacts || {}), ...(decision.artifacts || {}) },
    };
  }

  if (decision.outOfDomain) {
    return {
      ...base,
      message: decision.message || base.message,
      workflowId: "general_chat",
      intent: "out_of_domain",
      skipGeneralDispatch: true,
      artifacts: {
        ...(base.artifacts || {}),
        ...(decision.artifacts || {}),
        forceOutOfDomain: true,
      },
    };
  }

  if (
    decision.kind === DECISION_KIND.CLARIFY &&
    !decision.outOfDomain &&
    decision.needsClarification
  ) {
    return {
      ...base,
      message: decision.message || base.message,
      // Let general_chat produce the clarifying question
      workflowId: undefined,
      intent: undefined,
      skipGeneralDispatch: false,
    };
  }

  return {
    ...base,
    message: decision.message || base.message,
    intent: decision.intent || base.intent,
    workflowId: decision.skipGeneralDispatch
      ? decision.workflowId
      : base.workflowId,
    skipGeneralDispatch: decision.skipGeneralDispatch,
    artifacts: { ...(base.artifacts || {}), ...(decision.artifacts || {}) },
  };
}
