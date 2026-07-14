/**
 * Orchestrator — single entry for an assistant turn.
 *
 * Routes through general_chat → workflows. Product search uses the
 * Shopify Catalog Adapter via capabilities (no LLM / no internet catalog).
 */

import { EVENT_TYPE, MODULE_STATUS, ASSISTANT_PHASE } from "../constants.js";
import { getAssistantConfig } from "../config/index.js";
import { createKnowledgeClient, ensureKnowledgeReady } from "../knowledge/index.js";
import { evaluateGuardrails } from "./guardrails.js";
import { routeIntent } from "./intent-router.js";
import { appendMemory } from "./memory.js";
import { publish } from "./event-bus.js";
import {
  buildSessionContext,
  createSession,
} from "./session-manager.js";
import { executeWorkflow } from "./workflow-runner.js";

/**
 * Handle one assistant turn through the workflow engine.
 */
export async function handleTurn(input = {}) {
  const config = getAssistantConfig();

  await publish(EVENT_TYPE.TURN_RECEIVED, {
    shop: input.shop || null,
    hasMessage: Boolean(input.message),
    workflowId: input.workflowId || null,
    intent: input.intent || null,
  });

  const guard = evaluateGuardrails(input, { config });
  if (!guard.allowed) {
    return Object.freeze({
      ok: false,
      status: MODULE_STATUS.FOUNDATION,
      error: guard.code,
      policyId: guard.policyId,
    });
  }

  const engineEnabled =
    config.features.workflowEngine || config.features.acceptTurns;

  if (!engineEnabled) {
    return Object.freeze({
      ok: false,
      status: MODULE_STATUS.FOUNDATION,
      error: "turns_disabled",
      note: "Workflow engine disabled. Set ASSISTANT_FEATURE_WORKFLOW_ENGINE=true.",
      architecture: getArchitectureSnapshot(),
    });
  }

  if (config.features.enableLlm) {
    // LLM-enabled turns: OpenAI authors replies; DE keeps photos/UX/LLM-off paths.
  }

  let session = input.session || null;
  if (!session) {
    const created = await createSession({
      shop: input.shop,
      channel: input.channel,
      locale: input.locale,
      metadata: input.metadata,
    });
    if (!created.ok) {
      return Object.freeze({ ok: false, ...created });
    }
    session = created.session;
  }

  const knowledge = createKnowledgeClient({
    shop: session.shop,
    locale: session.locale,
  });
  await ensureKnowledgeReady({
    shop: session.shop,
    locale: session.locale,
  });
  const ctx = buildSessionContext(session, {
    config,
    knowledge,
  });

  if (input.message) {
    appendMemory(session.id, {
      role: "user",
      content: String(input.message),
    });
  }

  // Direct bypass for tests/tools: explicit workflow other than general_chat.
  if (
    input.workflowId &&
    input.workflowId !== "general_chat" &&
    input.skipGeneralDispatch
  ) {
    const route = routeIntent({ workflowId: input.workflowId });
    const workflowResult = await executeWorkflow(input.workflowId, ctx, {
      message: input.message,
      intent: input.intent,
      artifacts: input.artifacts || {},
      products: input.products,
      query: input.query,
      selectedProduct: input.selectedProduct || null,
      selectedRoom: input.selectedRoom || null,
      skipGeneralDispatch: true,
    });
    return Object.freeze({
      ok: Boolean(workflowResult?.ok),
      status: ASSISTANT_PHASE,
      session,
      route,
      workflowResult,
      note: "Direct workflow execution (bypass general_chat).",
    });
  }

  // Default path: General Conversation owns intent detection + routing.
  const workflowResult = await executeWorkflow("general_chat", ctx, {
    message: input.message,
    intent: input.intent,
    artifacts: input.artifacts || {},
    products: input.products,
    query: input.query,
    selectedProduct: input.selectedProduct || null,
    selectedRoom: input.selectedRoom || null,
  });

  return Object.freeze({
    ok: Boolean(workflowResult?.ok),
    status: ASSISTANT_PHASE,
    session,
    route: workflowResult?.route || null,
    workflowResult,
    note: "Workflow engine: routed via general_chat or ai_assisted_chat.",
  });
}

export function getArchitectureSnapshot() {
  const config = getAssistantConfig();
  return Object.freeze({
    module: "enarte.ai.assistant",
    phase: ASSISTANT_PHASE,
    workflowEngine: true,
    intentRouter: true,
    aiResponses: Boolean(config.features.enableLlm),
    llmEnabled: Boolean(config.features.enableLlm),
    aiLayerReady: true,
    openaiIsNotTheAssistant: false,
    openaiOwnsCustomerReplies: true,
    dedicatedAiAdapter: true,
    completeV1: true,
    promptSystem: true,
    aiConstitution: true,
    businessLogic: false,
    knowledgeEngine: true,
    knowledgeManager: true,
    knowledgePopulated: false,
    knowledgePlaceholders: true,
    shopifyProductLogic: true,
    shopifyCatalogAdapter: true,
    internetProductSearch: false,
    imageGeneration: false,
    decisionEngine: true,
    conversationState: true,
    architectureFrozen: true,
  });
}
