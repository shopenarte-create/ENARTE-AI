/**
 * Knowledge contracts — interfaces only.
 *
 * Workflows MUST use these shapes via the Knowledge Engine façade.
 * Providers implement the same contract so backends can be swapped
 * (JSON → DB → Shopify → CMS → AI) without changing workflow code.
 */

import {
  KNOWLEDGE_PROVIDER_KIND,
  KNOWLEDGE_STATUS,
} from "./constants.js";

/**
 * @typedef {object} KnowledgeQuery
 * @property {string} moduleId
 * @property {string} [key]       Optional record key within the module
 * @property {string} [locale]
 * @property {string} [shop]
 * @property {object} [filters]
 * @property {object} [metadata]
 */

/**
 * @typedef {object} KnowledgeRecord
 * @property {string} moduleId
 * @property {string} status
 * @property {string|null} providerId
 * @property {string|null} providerKind
 * @property {object} data          Always an object; empty when unpopulated
 * @property {string|null} [note]
 * @property {string} [fetchedAt]
 */

/**
 * @typedef {object} KnowledgeProvider
 * @property {string} id
 * @property {string} kind          One of KNOWLEDGE_PROVIDER_KIND
 * @property {string} status
 * @property {string} description
 * @property {string[]} [supports]  Module ids this provider can serve
 * @property {(query: KnowledgeQuery) => Promise<KnowledgeRecord>} fetch
 * @property {() => Promise<void> | void} [ready]
 */

/**
 * @typedef {object} KnowledgeModuleDefinition
 * @property {string} id
 * @property {string} description
 * @property {string} status
 * @property {string[]} [preferredProviders]  Ordered provider kinds to try
 * @property {object} [schema]                Optional empty shape documentation
 */

export function createEmptyKnowledgeData(schema = {}) {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    return Object.freeze({ ...schema });
  }
  return Object.freeze({});
}

/**
 * Normalize any provider/module payload into the stable KnowledgeRecord shape.
 */
export function createKnowledgeRecord(partial = {}) {
  if (!partial.moduleId) {
    throw new Error("KnowledgeRecord requires moduleId.");
  }

  return Object.freeze({
    moduleId: partial.moduleId,
    status: partial.status || KNOWLEDGE_STATUS.EMPTY,
    providerId: partial.providerId ?? null,
    providerKind: partial.providerKind ?? null,
    data:
      partial.data && typeof partial.data === "object"
        ? Object.freeze({ ...partial.data })
        : Object.freeze({}),
    note: partial.note ?? null,
    fetchedAt: partial.fetchedAt || new Date().toISOString(),
  });
}

/**
 * Define a provider. `fetch` is required; default returns empty data.
 */
export function defineKnowledgeProvider(definition) {
  if (!definition?.id) {
    throw new Error("Knowledge provider requires an id.");
  }

  const kind = definition.kind || KNOWLEDGE_PROVIDER_KIND.CUSTOM;

  return Object.freeze({
    id: definition.id,
    kind,
    status: definition.status || KNOWLEDGE_STATUS.STUB,
    description: definition.description || "",
    supports: Object.freeze([...(definition.supports || [])]),
    async ready() {
      if (typeof definition.ready === "function") {
        await definition.ready();
      }
    },
    async fetch(query) {
      if (typeof definition.fetch === "function") {
        const result = await definition.fetch(query);
        return createKnowledgeRecord({
          moduleId: query.moduleId,
          providerId: definition.id,
          providerKind: kind,
          ...result,
        });
      }
      return createKnowledgeRecord({
        moduleId: query.moduleId,
        status: KNOWLEDGE_STATUS.EMPTY,
        providerId: definition.id,
        providerKind: kind,
        data: {},
        note: `Provider "${definition.id}" has no fetch implementation.`,
      });
    },
  });
}

/**
 * Define a knowledge module (logical domain bucket).
 */
export function defineKnowledgeModule(definition) {
  if (!definition?.id) {
    throw new Error("Knowledge module requires an id.");
  }

  return Object.freeze({
    id: definition.id,
    description: definition.description || "",
    status: definition.status || KNOWLEDGE_STATUS.EMPTY,
    preferredProviders: Object.freeze([
      ...(definition.preferredProviders || [
        KNOWLEDGE_PROVIDER_KIND.JSON,
        KNOWLEDGE_PROVIDER_KIND.DATABASE,
        KNOWLEDGE_PROVIDER_KIND.SHOPIFY,
        KNOWLEDGE_PROVIDER_KIND.CMS,
        KNOWLEDGE_PROVIDER_KIND.AI,
        KNOWLEDGE_PROVIDER_KIND.NULL,
      ]),
    ]),
    schema: Object.freeze({ ...(definition.schema || {}) }),
  });
}
