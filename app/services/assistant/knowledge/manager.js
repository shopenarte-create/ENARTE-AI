/**
 * Knowledge Manager — single API for workflows to obtain knowledge.
 *
 * Responsibilities:
 * - load Sprint 1 (and future) knowledge modules
 * - validate documents before serving
 * - cache loaded knowledge
 * - support hot reload (invalidate + reload)
 *
 * Workflows MUST use this API (via ctx.knowledge / createKnowledgeClient).
 * They must never read placeholder files, providers, or schemas directly.
 */

import {
  KNOWLEDGE_MANAGER_VERSION,
  KNOWLEDGE_MODULE_IDS,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_DOCUMENT_STATUS,
  SPRINT1_KNOWLEDGE_MODULE_IDS,
} from "./constants.js";
import { createKnowledgeRecord } from "./contracts.js";
import { createKnowledgeCache } from "./cache.js";
import {
  validateKnowledgeDocument,
  assertValidKnowledgeDocument,
} from "./schemas/validators.js";
import { getKnowledge as engineGetKnowledge } from "./engine.js";
import { listKnowledgeModules } from "./modules/registry.js";

/**
 * @typedef {object} KnowledgeManagerOptions
 * @property {ReturnType<import("./cache.js").createKnowledgeCache>} [cache]
 * @property {boolean} [validateOnLoad]
 */

export function createKnowledgeManager(options = {}) {
  const cache = options.cache || createKnowledgeCache();
  const validateOnLoad = options.validateOnLoad !== false;

  /** @type {Map<string, object>} */
  const loadedDocuments = new Map();

  let ready = false;
  let lastLoadedAt = null;
  let loadGeneration = 0;

  async function fetchRawRecord(moduleId, queryOptions = {}) {
    // Prefer engine/provider chain (memory provider for Sprint 1).
    return engineGetKnowledge(moduleId, queryOptions);
  }

  function extractDocument(record) {
    if (record?.data?.document) return record.data.document;
    return null;
  }

  async function loadModule(moduleId, queryOptions = {}) {
    const record = await fetchRawRecord(moduleId, queryOptions);
    const document = extractDocument(record);

    if (document && validateOnLoad) {
      assertValidKnowledgeDocument(document);
      loadedDocuments.set(moduleId, document);
    } else if (document) {
      loadedDocuments.set(moduleId, document);
    }

    const served = createKnowledgeRecord({
      moduleId,
      status: document
        ? document.status === KNOWLEDGE_DOCUMENT_STATUS.PUBLISHED
          ? KNOWLEDGE_STATUS.READY
          : record?.status || KNOWLEDGE_STATUS.PLACEHOLDER
        : record?.status || KNOWLEDGE_STATUS.EMPTY,
      providerId: record?.providerId ?? null,
      providerKind: record?.providerKind ?? null,
      data: document
        ? {
            document,
            version: document.version,
            locale: queryOptions.locale || document.locale,
            content: document.content,
          }
        : record?.data || {},
      note: record?.note || null,
      fetchedAt: record?.fetchedAt,
    });

    cache.set(moduleId, queryOptions, served);
    return served;
  }

  async function loadAll(moduleIds = SPRINT1_KNOWLEDGE_MODULE_IDS, queryOptions = {}) {
    const ids = moduleIds?.length ? moduleIds : [...SPRINT1_KNOWLEDGE_MODULE_IDS];
    const bundle = {};
    const validations = {};

    for (const id of ids) {
      const record = await loadModule(id, queryOptions);
      bundle[id] = record;
      const doc = extractDocument(record) || loadedDocuments.get(id);
      validations[id] = doc
        ? validateKnowledgeDocument(doc)
        : Object.freeze({
            ok: record.status !== KNOWLEDGE_STATUS.ERROR,
            errors: Object.freeze([]),
            warnings: Object.freeze([]),
          });
    }

    ready = true;
    lastLoadedAt = new Date().toISOString();
    loadGeneration += 1;

    return Object.freeze({
      ok: Object.values(validations).every((v) => v.ok),
      generation: loadGeneration,
      loadedAt: lastLoadedAt,
      modules: Object.freeze(bundle),
      validations: Object.freeze(validations),
    });
  }

  async function get(moduleId, queryOptions = {}) {
    if (cache.has(moduleId, queryOptions)) {
      return cache.get(moduleId, queryOptions);
    }
    return loadModule(moduleId, queryOptions);
  }

  async function query(query = {}) {
    if (!query.moduleId) {
      return createKnowledgeRecord({
        moduleId: "unknown",
        status: KNOWLEDGE_STATUS.ERROR,
        data: {},
        note: "Knowledge Manager query requires moduleId.",
      });
    }
    return get(query.moduleId, query);
  }

  async function bundle(moduleIds, queryOptions = {}) {
    const ids = moduleIds?.length ? moduleIds : [...SPRINT1_KNOWLEDGE_MODULE_IDS];
    const out = {};
    for (const id of ids) {
      out[id] = await get(id, queryOptions);
    }
    return Object.freeze(out);
  }

  function validate(documentOrModuleId) {
    if (typeof documentOrModuleId === "string") {
      const doc = loadedDocuments.get(documentOrModuleId);
      if (!doc) {
        return Object.freeze({
          ok: false,
          errors: Object.freeze([
            {
              path: "moduleId",
              code: "not_loaded",
              message: `Module "${documentOrModuleId}" is not loaded.`,
            },
          ]),
          warnings: Object.freeze([]),
        });
      }
      return validateKnowledgeDocument(doc);
    }
    return validateKnowledgeDocument(documentOrModuleId);
  }

  /**
   * Hot reload: invalidate cache and reload from providers.
   * Future: watch JSON/CMS webhooks can call this.
   */
  async function reload(moduleId, queryOptions = {}) {
    if (moduleId) {
      cache.invalidate(moduleId);
      loadedDocuments.delete(moduleId);
      const record = await loadModule(moduleId, queryOptions);
      loadGeneration += 1;
      lastLoadedAt = new Date().toISOString();
      return Object.freeze({
        ok: true,
        generation: loadGeneration,
        reloaded: [moduleId],
        record,
      });
    }

    cache.clear();
    loadedDocuments.clear();
    const result = await loadAll(SPRINT1_KNOWLEDGE_MODULE_IDS, queryOptions);
    return Object.freeze({
      ok: result.ok,
      generation: loadGeneration,
      reloaded: [...SPRINT1_KNOWLEDGE_MODULE_IDS],
      result,
    });
  }

  function clearCache() {
    cache.clear();
  }

  function getStatus() {
    return Object.freeze({
      version: KNOWLEDGE_MANAGER_VERSION,
      ready,
      lastLoadedAt,
      generation: loadGeneration,
      cacheSize: cache.size(),
      sprint1Modules: SPRINT1_KNOWLEDGE_MODULE_IDS,
      allModules: KNOWLEDGE_MODULE_IDS,
      loadedModuleIds: Object.freeze([...loadedDocuments.keys()]),
      registeredModules: listKnowledgeModules().map((m) => m.id),
    });
  }

  return Object.freeze({
    version: KNOWLEDGE_MANAGER_VERSION,
    loadAll,
    loadModule,
    get,
    query,
    bundle,
    validate,
    reload,
    clearCache,
    getStatus,
    /** Expose sprint1 ids for clients without importing placeholders. */
    sprint1ModuleIds: SPRINT1_KNOWLEDGE_MODULE_IDS,
  });
}

/** Process singleton — workflows get this via createKnowledgeClient. */
let singleton = null;

export function getKnowledgeManager(options) {
  if (!singleton) {
    singleton = createKnowledgeManager(options);
  }
  return singleton;
}

export function resetKnowledgeManager() {
  if (singleton) {
    singleton.clearCache();
  }
  singleton = null;
}

/**
 * Ensure Sprint 1 modules are loaded (idempotent warm-up).
 */
export async function ensureKnowledgeReady(options = {}) {
  const manager = getKnowledgeManager();
  const status = manager.getStatus();
  if (status.ready && status.loadedModuleIds.length >= SPRINT1_KNOWLEDGE_MODULE_IDS.length) {
    return status;
  }
  await manager.loadAll(SPRINT1_KNOWLEDGE_MODULE_IDS, options);
  return manager.getStatus();
}
