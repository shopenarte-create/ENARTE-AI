/**
 * Adapter registry — external systems behind stable ids.
 */

import { ADAPTER_STATUS } from "../constants.js";
import { defineAdapter } from "../contracts/index.js";
import { getShopifyCatalogAdapter } from "./shopify-catalog.js";
import { getPrismaPersistenceAdapter } from "./prisma-persistence.js";
import { AI_ADAPTER_ID, LLM_STUB_ADAPTER_ID } from "../ai/constants.js";
import { getAiAdapter } from "../ai/adapter.js";

/** @type {Map<string, import("../contracts/index.js").AdapterDefinition>} */
const adapters = new Map();
let foundationRegistered = false;

export function registerAdapter(definition) {
  const adapter = defineAdapter(definition);
  adapters.set(adapter.id, adapter);
  return adapter;
}

function ensureFoundationAdapters() {
  if (foundationRegistered) return;
  foundationRegistered = true;

  const aiAdapter = getAiAdapter();
  registerAdapter({
    id: AI_ADAPTER_ID,
    status: aiAdapter.status,
    description: aiAdapter.description,
    api: aiAdapter.api,
  });

  registerAdapter({
    id: LLM_STUB_ADAPTER_ID,
    status: ADAPTER_STATUS.STUB,
    description:
      "Legacy LLM stub id — delegates to ai.adapter.",
    api: Object.freeze({
      complete: (input, options) => aiAdapter.api.complete(input, options),
      status: () => aiAdapter.api.status(),
    }),
  });

  const persistence = getPrismaPersistenceAdapter();
  registerAdapter({
    id: persistence.id,
    status: persistence.status,
    description: persistence.description,
    api: Object.freeze({
      saveConversation: (session) => persistence.saveConversation(session),
      loadConversation: (id) => persistence.loadConversation(id),
      appendMessage: (conversationId, message) =>
        persistence.appendMessage(conversationId, message),
      recordEvent: (input) => persistence.recordEvent(input),
      updateConversationMetadata: (id, metadata) =>
        persistence.updateConversationMetadata(id, metadata),
    }),
  });

  const shopifyCatalog = getShopifyCatalogAdapter();
  registerAdapter({
    id: shopifyCatalog.id,
    status: shopifyCatalog.status,
    description: shopifyCatalog.description,
    api: Object.freeze({
      search: (input) => shopifyCatalog.search(input),
    }),
  });

  registerAdapter({
    id: "vision.images",
    status: ADAPTER_STATUS.PLANNED,
    description:
      "Vision / image adapter — planned (not implemented in Sprint 6).",
    api: Object.freeze({}),
  });
}

export function getAdapter(id) {
  ensureFoundationAdapters();
  return adapters.get(id) || null;
}

export function listAdapters() {
  ensureFoundationAdapters();
  return [...adapters.values()].map((a) =>
    Object.freeze({
      id: a.id,
      status: a.status,
      description: a.description,
    }),
  );
}
