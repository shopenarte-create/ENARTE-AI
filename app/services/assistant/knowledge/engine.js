/**
 * Knowledge Engine — resolves module requests through replaceable providers.
 *
 * Workflows never talk to providers or store ENARTE facts.
 * They call the engine (or the knowledge client) only.
 */

import {
  KNOWLEDGE_ENGINE_VERSION,
  KNOWLEDGE_STATUS,
} from "./constants.js";
import { createKnowledgeRecord } from "./contracts.js";
import {
  findProvidersForModule,
  getKnowledgeProvider,
  listKnowledgeProviders,
} from "./providers/registry.js";
import {
  getKnowledgeModule,
  listKnowledgeModules,
} from "./modules/registry.js";

/**
 * Resolve which provider should serve a module.
 * Skips STUB providers when a non-stub (e.g. null/ready) is available,
 * unless `allowStubs` is true or only stubs exist.
 */
function selectProvider(moduleDef, { allowStubs = false, providerId } = {}) {
  if (providerId) {
    return getKnowledgeProvider(providerId);
  }

  const candidates = findProvidersForModule(
    moduleDef.id,
    moduleDef.preferredProviders || [],
  );

  if (!candidates.length) return null;

  if (!allowStubs) {
    const active = candidates.find(
      (p) =>
        p.status !== KNOWLEDGE_STATUS.STUB &&
        p.kind !== undefined,
    );
    // Prefer non-stub; memory placeholders are PLACEHOLDER status (allowed).
    const preferred = candidates.find(
      (p) => p.status === KNOWLEDGE_STATUS.PLACEHOLDER || p.status === KNOWLEDGE_STATUS.READY,
    );
    if (preferred) return preferred;
    if (active) return active;
  }

  return candidates[0];
}

/**
 * Fetch one knowledge module through the active provider chain.
 *
 * @param {string} moduleId
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {string} [options.shop]
 * @param {string} [options.key]
 * @param {object} [options.filters]
 * @param {string} [options.providerId] Force a specific provider (ops/tests)
 * @param {boolean} [options.allowStubs]
 */
export async function getKnowledge(moduleId, options = {}) {
  const moduleDef = getKnowledgeModule(moduleId);
  if (!moduleDef) {
    return createKnowledgeRecord({
      moduleId,
      status: KNOWLEDGE_STATUS.NOT_REGISTERED,
      data: {},
      note: `Knowledge module "${moduleId}" is not registered.`,
    });
  }

  const provider = selectProvider(moduleDef, options);
  if (!provider) {
    return createKnowledgeRecord({
      moduleId,
      status: KNOWLEDGE_STATUS.EMPTY,
      data: createEmptySchemaData(moduleDef),
      note: `No provider available for module "${moduleId}".`,
    });
  }

  const query = Object.freeze({
    moduleId,
    key: options.key,
    locale: options.locale,
    shop: options.shop,
    filters: options.filters || {},
    metadata: options.metadata || {},
  });

  const record = await provider.fetch(query);

  // Merge empty schema keys so consumers see a stable shape even when empty.
  const data = {
    ...createEmptySchemaData(moduleDef),
    ...(record.data || {}),
  };

  return createKnowledgeRecord({
    ...record,
    moduleId,
    data,
  });
}

/**
 * Query interface — same as getKnowledge but accepts a KnowledgeQuery object.
 * Future: full-text / semantic search can extend this without changing workflows.
 */
export async function queryKnowledge(query = {}) {
  if (!query.moduleId) {
    return createKnowledgeRecord({
      moduleId: "unknown",
      status: KNOWLEDGE_STATUS.ERROR,
      data: {},
      note: "queryKnowledge requires moduleId.",
    });
  }
  return getKnowledge(query.moduleId, query);
}

/**
 * Load many modules in one call (e.g. orchestrator bootstrap).
 */
export async function getKnowledgeBundle(moduleIds, options = {}) {
  const ids = moduleIds?.length
    ? moduleIds
    : listKnowledgeModules().map((m) => m.id);

  const bundle = {};
  for (const id of ids) {
    bundle[id] = await getKnowledge(id, options);
  }
  return Object.freeze(bundle);
}

export function getKnowledgeEngineStatus() {
  return Object.freeze({
    version: KNOWLEDGE_ENGINE_VERSION,
    modules: listKnowledgeModules().map((m) =>
      Object.freeze({
        id: m.id,
        status: m.status,
        description: m.description,
        preferredProviders: m.preferredProviders,
      }),
    ),
    providers: listKnowledgeProviders(),
  });
}

function createEmptySchemaData(moduleDef) {
  const schema = moduleDef?.schema;
  if (!schema || typeof schema !== "object") return {};
  return { ...schema };
}
