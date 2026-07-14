/**
 * ENARTE AI layer — public façade.
 *
 * OpenAI is a provider behind the AI Adapter.
 * The Decision Engine remains the assistant decision maker.
 * Prompt System + AI Constitution (Sprint 8) prepare future model calls.
 */

import { getAssistantConfig } from "../config/index.js";

export {
  AI_LAYER_ID,
  AI_LAYER_VERSION,
  AI_PROVIDER_ID,
  AI_PROVIDER_STATUS,
  AI_CAPABILITY_KIND,
  AI_REQUEST_STATUS,
  AI_FALLBACK_STRATEGY,
  AI_ADAPTER_ID,
  LLM_STUB_ADAPTER_ID,
} from "./constants.js";

export {
  createAiRequest,
  createAiResult,
  createDegradedAiResult,
  createEmptyUsage,
  createEmptyCost,
} from "./contracts.js";

export {
  createAiAdapter,
  getAiAdapter,
  resetAiAdapter,
  getAiAdapterStatus,
} from "./adapter.js";

export { executeAiGateway } from "./gateway.js";

export {
  registerAiProvider,
  getAiProvider,
  listAiProviders,
  resolveProviderChain,
  resetAiProviders,
} from "./providers/registry.js";

export {
  PROMPT_SYSTEM_VERSION,
  PROMPT_ROLE,
  PROMPT_KIND,
  PROMPT_STATUS,
  AI_CONSTITUTION_PROMPT_ID,
  AI_CONSTITUTION_VERSION,
  makePromptVersionKey,
  parsePromptVersionKey,
  comparePromptVersions,
  pickLatestVersion,
  isValidSemverLike,
  buildVersionLineage,
  validatePromptDocument,
  assertValidPromptDocument,
  PROMPT_TEMPLATE_SLOTS,
  interpolateTemplate,
  renderPromptTemplate,
  definePromptTemplate,
  registerPrompt,
  getPrompt,
  listPrompts,
  listPromptIds,
  getPromptLineage,
  unregisterPrompt,
  resetPromptRegistry,
  tryRegisterPrompt,
  loadPromptPack,
  loadPromptPackModule,
  loadPromptDocument,
  buildPromptContext,
  buildAiConstitution,
  registerAiConstitution,
  getConstitutionSnapshot,
  runPromptTestSuite,
  runPromptTestCase,
  runDefaultPromptSmokeTests,
  bootstrapPromptSystem,
  resetPromptSystem,
  getPromptSystemStatus,
} from "./prompts/index.js";

export {
  AI_RESPONSE_SCHEMAS,
  getAiResponseSchema,
} from "./validation/schemas.js";

export { validateAiResponse } from "./validation/validate.js";

export {
  recordTokenUsage,
  getTokenUsageSnapshot,
  resetTokenUsage,
} from "./telemetry/usage-tracker.js";

export {
  registerModelRate,
  estimateCost,
  recordCost,
  getCostSnapshot,
  resetCostTracking,
} from "./telemetry/cost-tracker.js";

export {
  resolveAiFallback,
  toDegradedFallbackResult,
  isAiSuccess,
} from "./fallback.js";

export function getAiArchitectureSnapshot() {
  const config = getAssistantConfig();
  const llmOn = Boolean(config.features?.enableLlm && config.ai?.openaiSdkWired);
  return Object.freeze({
    layer: "ai",
    version: "ai.architecture.sprint9",
    openaiIsNotTheAssistant: false,
    openaiOwnsCustomerReplies: true,
    decisionEngineOwnsDecisions: true,
    dedicatedAiAdapter: true,
    providerAbstraction: true,
    multiProviderReady: true,
    promptSystem: true,
    promptVersioning: true,
    promptRegistry: true,
    promptTemplates: true,
    promptValidation: true,
    promptLoader: true,
    promptContextBuilder: true,
    promptTestingFramework: true,
    aiConstitution: true,
    aiConstitutionKnowledgeBound: true,
    responseValidation: true,
    tokenUsageTracking: true,
    costTracking: true,
    timeoutHandling: true,
    retryStrategy: true,
    fallbackStrategy: true,
    promptTemplatesRegistered: true,
    capabilityPromptContentAuthored: false,
    constitutionContentReady: true,
    promptContentAuthored: true,
    openaiSdkWired: Boolean(config.ai?.openaiSdkWired),
    openaiCallsEnabled: llmOn,
    assistantChatImplemented: true,
    imageAnalysisImplemented: false,
    roomAnalysisImplemented: false,
  });
}
