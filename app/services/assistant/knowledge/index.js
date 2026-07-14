/**
 * Knowledge Layer façade — Knowledge Engine + Knowledge Manager entry.
 *
 * Architecture:
 *   Workflows → KnowledgeClient → Knowledge Manager (validate, cache, reload)
 *                               → Knowledge Engine → Providers
 *
 * Populate ONLY from ENARTE-provided knowledge modules (documents/*).
 * Do not invent business rules, FAQ answers, or policies here.
 * Unpublished Sprint 1 modules remain empty placeholders.
 */

import { MODULE_STATUS } from "../constants.js";
import {
  KNOWLEDGE_ENGINE_VERSION,
  KNOWLEDGE_MANAGER_VERSION,
  KNOWLEDGE_MODULE_ID,
  KNOWLEDGE_MODULE_IDS,
  KNOWLEDGE_PROVIDER_KIND,
  KNOWLEDGE_STATUS,
  SPRINT1_KNOWLEDGE_MODULE_IDS,
} from "./constants.js";
import {
  createKnowledgeRecord,
  defineKnowledgeModule,
  defineKnowledgeProvider,
} from "./contracts.js";
import { createKnowledgeClient } from "./client.js";
import {
  getKnowledge,
  queryKnowledge,
  getKnowledgeBundle,
  getKnowledgeEngineStatus,
} from "./engine.js";
import {
  createKnowledgeManager,
  getKnowledgeManager,
  resetKnowledgeManager,
  ensureKnowledgeReady,
} from "./manager.js";
import {
  registerKnowledgeModule,
  getKnowledgeModule,
  listKnowledgeModules,
  resetKnowledgeModules,
} from "./modules/registry.js";
import { ALL_KNOWLEDGE_MODULES } from "./modules/catalog.js";
import {
  registerKnowledgeProvider,
  getKnowledgeProvider,
  listKnowledgeProviders,
  createNullKnowledgeProvider,
  resetKnowledgeProviders,
} from "./providers/registry.js";
import { registerFutureProviderStubs } from "./providers/stubs.js";
import { createMemoryKnowledgeProvider } from "./providers/memory.js";
import {
  validateKnowledgeDocument,
  validateKnowledgeEnvelope,
  validateModuleContent,
  assertValidKnowledgeDocument,
  createKnowledgeDocument,
  CONTENT_FACTORIES,
} from "./schemas/index.js";

let bootstrapped = false;

/**
 * Bootstrap module catalog + providers (idempotent).
 */
export function bootstrapKnowledgeEngine({ includeFutureStubs = true } = {}) {
  if (bootstrapped) return getKnowledgeEngineStatus();

  for (const moduleDef of ALL_KNOWLEDGE_MODULES) {
    registerKnowledgeModule(moduleDef);
  }

  // Sprint 1: memory placeholders first; null remains as ultimate fallback.
  registerKnowledgeProvider(createMemoryKnowledgeProvider());
  registerKnowledgeProvider(createNullKnowledgeProvider());

  if (includeFutureStubs) {
    registerFutureProviderStubs();
  }

  bootstrapped = true;
  return getKnowledgeEngineStatus();
}

export function resetKnowledgeEngine() {
  resetKnowledgeManager();
  resetKnowledgeModules();
  resetKnowledgeProviders();
  bootstrapped = false;
}

// Auto-bootstrap on import so orchestrator/workflows always have the engine.
bootstrapKnowledgeEngine();

/**
 * Backward-compatible aliases used by Phase 1/2 orchestrator status APIs.
 * Prefer createKnowledgeClient / Knowledge Manager going forward.
 */
export function registerKnowledgeSource(source) {
  if (!source?.id) {
    throw new Error("Knowledge source requires an id.");
  }
  registerKnowledgeProvider({
    id: `legacy.source.${source.id}`,
    kind: KNOWLEDGE_PROVIDER_KIND.CUSTOM,
    status: source.status || KNOWLEDGE_STATUS.EMPTY,
    description: source.description || `Legacy knowledge source "${source.id}"`,
    supports: [source.id],
    fetch: async (query) => {
      const data =
        typeof source.load === "function" ? await source.load() : {};
      return createKnowledgeRecord({
        moduleId: query.moduleId,
        status: KNOWLEDGE_STATUS.EMPTY,
        data: data && typeof data === "object" ? data : {},
        note: "Loaded via legacy knowledge source adapter.",
      });
    },
  });

  if (!getKnowledgeModule(source.id)) {
    registerKnowledgeModule(
      defineKnowledgeModule({
        id: source.id,
        description: source.description || source.id,
        status: KNOWLEDGE_STATUS.EMPTY,
      }),
    );
  }

  return source.id;
}

export function listKnowledgeSources() {
  return listKnowledgeModules().map((m) =>
    Object.freeze({
      id: m.id,
      status: m.status,
      description: m.description,
    }),
  );
}

export function getKnowledgeSource(id) {
  return getKnowledgeModule(id);
}

/** @deprecated Prefer manager.bundle / client.bundle */
export async function loadKnowledge(ids = []) {
  return getKnowledgeManager().bundle(ids);
}

/** @deprecated Prefer client.bundle() */
export async function loadAllKnowledge() {
  return getKnowledgeManager().bundle([...SPRINT1_KNOWLEDGE_MODULE_IDS]);
}

export {
  KNOWLEDGE_ENGINE_VERSION,
  KNOWLEDGE_MANAGER_VERSION,
  KNOWLEDGE_MODULE_ID,
  KNOWLEDGE_MODULE_IDS,
  KNOWLEDGE_PROVIDER_KIND,
  KNOWLEDGE_STATUS,
  SPRINT1_KNOWLEDGE_MODULE_IDS,
  MODULE_STATUS,
  createKnowledgeClient,
  createKnowledgeRecord,
  defineKnowledgeModule,
  defineKnowledgeProvider,
  getKnowledge,
  queryKnowledge,
  getKnowledgeBundle,
  getKnowledgeEngineStatus,
  createKnowledgeManager,
  getKnowledgeManager,
  resetKnowledgeManager,
  ensureKnowledgeReady,
  registerKnowledgeModule,
  getKnowledgeModule,
  listKnowledgeModules,
  registerKnowledgeProvider,
  getKnowledgeProvider,
  listKnowledgeProviders,
  validateKnowledgeDocument,
  validateKnowledgeEnvelope,
  validateModuleContent,
  assertValidKnowledgeDocument,
  createKnowledgeDocument,
  CONTENT_FACTORIES,
};
