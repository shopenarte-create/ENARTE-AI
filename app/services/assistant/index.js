/**
 * ENARTE AI Assistant — public module façade.
 *
 * Phase 2: workflow engine + intent routing (no LLM / Shopify / business rules).
 */

import {
  ASSISTANT_MODULE_ID,
  ASSISTANT_PHASE,
  ASSISTANT_VERSION,
  MODULE_STATUS,
  ARCHITECTURE_FROZEN,
} from "./constants.js";
import { getAssistantConfig, resetAssistantConfigCache } from "./config/index.js";
import {
  listKnowledgeSources,
  loadAllKnowledge,
  registerKnowledgeSource,
  createKnowledgeClient,
  getKnowledge,
  queryKnowledge,
  getKnowledgeBundle,
  getKnowledgeEngineStatus,
  getKnowledgeManager,
  ensureKnowledgeReady,
  validateKnowledgeDocument,
  KNOWLEDGE_MODULE_ID,
  KNOWLEDGE_MODULE_IDS,
  KNOWLEDGE_PROVIDER_KIND,
  SPRINT1_KNOWLEDGE_MODULE_IDS,
  KNOWLEDGE_MANAGER_VERSION,
} from "./knowledge/index.js";
import {
  listCapabilities,
  getCapability,
  invokeCapability,
  registerCapability,
} from "./capabilities/registry.js";
import {
  listWorkflows,
  getWorkflow,
  findWorkflowsByIntent,
  runWorkflow,
  registerWorkflow,
} from "./workflows/registry.js";
import {
  listAdapters,
  getAdapter,
  registerAdapter,
} from "./adapters/registry.js";
import {
  listPorts,
  getPort,
  connectModule,
  listConnectedModules,
  registerPort,
} from "./ports/registry.js";
import {
  createSession,
  handleTurn,
  getArchitectureSnapshot,
  routeIntent,
  resolveRouteReply,
  ROUTE_DECISION,
  executeWorkflow,
  publish,
  subscribe,
  evaluateGuardrails,
} from "./core/index.js";
import {
  startChatSession,
  getChatSession,
  sendChatMessage,
  listChatSmartActions,
  listSmartActions,
} from "./ux/index.js";
import {
  decide,
  getConversationState,
  CONVERSATION_PHASE,
  DECISION_KIND,
} from "./brain/index.js";
import {
  getAiArchitectureSnapshot,
  getAiAdapterStatus,
  listAiProviders,
  listPrompts,
  AI_ADAPTER_ID,
  AI_LAYER_VERSION,
} from "./ai/index.js";

/**
 * Introspection payload for ops / status route.
 */
export function getAssistantFoundationStatus() {
  const config = getAssistantConfig();

  return Object.freeze({
    moduleId: ASSISTANT_MODULE_ID,
    phase: ASSISTANT_PHASE,
    version: ASSISTANT_VERSION,
    status: MODULE_STATUS.ACTIVE,
    architecture: getArchitectureSnapshot(),
    boundaries: Object.freeze({
      independentFromStorefrontUi: true,
      workflowsIsolated: true,
      businessRulesInConfigOrKnowledgeOnly: true,
      knowledgeViaInterfacesOnly: true,
      knowledgeProvidersReplaceable: true,
      extensionPortsEnabled: true,
      intentRouterDecidesOnly: true,
      llmDisabled: true,
      openaiNotTheAssistant: true,
      dedicatedAiAdapter: true,
      architectureFrozen: true,
      noInventedBusinessRules: true,
    }),
    runtime: Object.freeze({
      enabled: config.runtime.enabled,
      workflowEngine: config.features.workflowEngine,
      acceptTurns: config.features.acceptTurns,
      enableLlm: config.features.enableLlm,
      enableShopifyTools: config.features.enableShopifyTools,
      enableImageTools: config.features.enableImageTools,
    }),
    catalogs: Object.freeze({
      workflows: listWorkflows(),
      capabilities: listCapabilities(),
      adapters: listAdapters(),
      knowledgeSources: listKnowledgeSources(),
      knowledgeEngine: getKnowledgeEngineStatus(),
      knowledgeManager: getKnowledgeManager().getStatus(),
      ports: listPorts(),
      connectedModules: listConnectedModules(),
      intentCount: config.intentCatalog?.intents?.length || 0,
      ai: Object.freeze({
        layerVersion: AI_LAYER_VERSION,
        adapterId: AI_ADAPTER_ID,
        architecture: getAiArchitectureSnapshot(),
        status: getAiAdapterStatus(),
        providers: listAiProviders(),
        prompts: listPrompts().map((p) =>
          Object.freeze({
            promptId: p.promptId,
            version: p.version,
            kind: p.kind,
            contentReady: p.contentReady,
          }),
        ),
      }),
    }),
  });
}

export {
  ASSISTANT_MODULE_ID,
  ASSISTANT_PHASE,
  ASSISTANT_VERSION,
  MODULE_STATUS,
  ARCHITECTURE_FROZEN,
  getAssistantConfig,
  resetAssistantConfigCache,
  listKnowledgeSources,
  loadAllKnowledge,
  registerKnowledgeSource,
  createKnowledgeClient,
  getKnowledge,
  queryKnowledge,
  getKnowledgeBundle,
  getKnowledgeEngineStatus,
  getKnowledgeManager,
  ensureKnowledgeReady,
  validateKnowledgeDocument,
  KNOWLEDGE_MODULE_ID,
  KNOWLEDGE_MODULE_IDS,
  KNOWLEDGE_PROVIDER_KIND,
  SPRINT1_KNOWLEDGE_MODULE_IDS,
  KNOWLEDGE_MANAGER_VERSION,
  listCapabilities,
  getCapability,
  invokeCapability,
  registerCapability,
  listWorkflows,
  getWorkflow,
  findWorkflowsByIntent,
  runWorkflow,
  registerWorkflow,
  listAdapters,
  getAdapter,
  registerAdapter,
  listPorts,
  getPort,
  connectModule,
  listConnectedModules,
  registerPort,
  createSession,
  handleTurn,
  getArchitectureSnapshot,
  routeIntent,
  resolveRouteReply,
  ROUTE_DECISION,
  executeWorkflow,
  publish,
  subscribe,
  evaluateGuardrails,
  startChatSession,
  getChatSession,
  sendChatMessage,
  listChatSmartActions,
  listSmartActions,
  decide,
  getConversationState,
  CONVERSATION_PHASE,
  DECISION_KIND,
  getAiArchitectureSnapshot,
  getAiAdapterStatus,
  listAiProviders,
  listPrompts,
  AI_ADAPTER_ID,
  AI_LAYER_VERSION,
};
