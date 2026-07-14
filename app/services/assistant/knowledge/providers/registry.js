/**
 * Knowledge provider registry — swappable backends.
 */

import { KNOWLEDGE_PROVIDER_KIND, KNOWLEDGE_STATUS } from "../constants.js";
import {
  createKnowledgeRecord,
  defineKnowledgeProvider,
} from "../contracts.js";

/** @type {Map<string, import("./contracts.js").KnowledgeProvider>} */
const providers = new Map();

export function registerKnowledgeProvider(definition) {
  const provider = defineKnowledgeProvider(definition);
  providers.set(provider.id, provider);
  return provider;
}

export function getKnowledgeProvider(id) {
  return providers.get(id) || null;
}

export function listKnowledgeProviders() {
  return [...providers.values()].map((p) =>
    Object.freeze({
      id: p.id,
      kind: p.kind,
      status: p.status,
      description: p.description,
      supports: p.supports,
    }),
  );
}

export function findProvidersForModule(moduleId, preferredKinds = []) {
  const all = [...providers.values()].filter((p) => {
    if (!p.supports.length) return true;
    return p.supports.includes(moduleId);
  });

  if (!preferredKinds.length) return all;

  const ranked = [];
  for (const kind of preferredKinds) {
    for (const provider of all) {
      if (provider.kind === kind && !ranked.includes(provider)) {
        ranked.push(provider);
      }
    }
  }
  for (const provider of all) {
    if (!ranked.includes(provider)) ranked.push(provider);
  }
  return ranked;
}

export function resetKnowledgeProviders() {
  providers.clear();
}

/**
 * Default empty provider — always safe, never populated.
 * Keeps the engine runnable before any real data source is wired.
 */
export function createNullKnowledgeProvider() {
  return defineKnowledgeProvider({
    id: "provider.null",
    kind: KNOWLEDGE_PROVIDER_KIND.NULL,
    status: KNOWLEDGE_STATUS.EMPTY,
    description:
      "Null knowledge provider. Returns empty data for every module.",
    supports: [],
    async fetch(query) {
      return createKnowledgeRecord({
        moduleId: query.moduleId,
        status: KNOWLEDGE_STATUS.EMPTY,
        providerId: "provider.null",
        providerKind: KNOWLEDGE_PROVIDER_KIND.NULL,
        data: {},
        note: "Knowledge not populated yet (null provider).",
      });
    },
  });
}
