/**
 * Prompt system façade — Sprint 8.
 */

import { getAssistantConfig } from "../../config/index.js";

export {
  PROMPT_SYSTEM_VERSION,
  PROMPT_ROLE,
  PROMPT_KIND,
  PROMPT_STATUS,
  AI_CONSTITUTION_PROMPT_ID,
  AI_CONSTITUTION_VERSION,
} from "./constants.js";

export {
  makePromptVersionKey,
  parsePromptVersionKey,
  comparePromptVersions,
  pickLatestVersion,
  isValidSemverLike,
  buildVersionLineage,
} from "./versioning.js";

export {
  validatePromptDocument,
  assertValidPromptDocument,
} from "./validation.js";

export {
  PROMPT_TEMPLATE_SLOTS,
  interpolateTemplate,
  renderPromptTemplate,
  definePromptTemplate,
} from "./templates.js";

export {
  registerPrompt,
  getPrompt,
  listPrompts,
  listPromptIds,
  getPromptLineage,
  unregisterPrompt,
  resetPromptRegistry,
  tryRegisterPrompt,
} from "./registry.js";

export {
  loadPromptPack,
  loadPromptPackModule,
  loadPromptDocument,
} from "./loader.js";

export { buildPromptContext } from "./context-builder.js";

export {
  buildAiConstitution,
  registerAiConstitution,
  getConstitutionSnapshot,
} from "./constitution.js";

export {
  runPromptTestSuite,
  runPromptTestCase,
  runDefaultPromptSmokeTests,
} from "./testing.js";

import { listPrompts, resetPromptRegistry } from "./registry.js";
import { registerAiConstitution } from "./constitution.js";
import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
} from "../../knowledge/index.js";
import { PROMPT_SYSTEM_VERSION } from "./constants.js";

let bootstrapped = false;

/**
 * Bootstrap prompt slots + Knowledge-bound AI Constitution.
 * Safe to call multiple times.
 */
export async function bootstrapPromptSystem(options = {}) {
  if (!bootstrapped || options.force) {
    if (options.bootstrapKnowledge !== false) {
      try {
        resetKnowledgeEngine();
        bootstrapKnowledgeEngine();
      } catch {
        // Knowledge may already be ready in app runtime.
      }
    }
    resetPromptRegistry({ includeSlots: true });
    await registerAiConstitution(options);
    bootstrapped = true;
  }
  return getPromptSystemStatus();
}

export function resetPromptSystem() {
  bootstrapped = false;
  resetPromptRegistry({ includeSlots: true });
}

export function getPromptSystemStatus() {
  const prompts = listPrompts();
  const constitution = prompts.find((p) => p.kind === "constitution");
  return Object.freeze({
    version: PROMPT_SYSTEM_VERSION,
    bootstrapped,
    promptsRegistered: prompts.length,
    contentReadyCount: prompts.filter((p) => p.contentReady).length,
    constitutionReady: Boolean(constitution?.contentReady),
    constitutionPromptId: constitution?.promptId || null,
    constitutionVersion: constitution?.version || null,
    openaiCallsEnabled: Boolean(getAssistantConfig().features?.enableLlm),
    decisionEngineOwnsDecisions: true,
  });
}
