/**
 * Future provider stubs — interfaces only, no data loading.
 * Registering them documents replaceability without activating backends.
 */

import { KNOWLEDGE_PROVIDER_KIND, KNOWLEDGE_STATUS } from "../constants.js";
import { createKnowledgeRecord } from "../contracts.js";
import { registerKnowledgeProvider } from "./registry.js";

function stubFetch(providerId, kind) {
  return async (query) =>
    createKnowledgeRecord({
      moduleId: query.moduleId,
      status: KNOWLEDGE_STATUS.STUB,
      providerId,
      providerKind: kind,
      data: {},
      note: `Provider "${providerId}" is reserved — not wired yet.`,
    });
}

export function registerFutureProviderStubs() {
  const stubs = [
    {
      id: "provider.json",
      kind: KNOWLEDGE_PROVIDER_KIND.JSON,
      description: "Reserved: load knowledge from JSON files / bundles.",
    },
    {
      id: "provider.database",
      kind: KNOWLEDGE_PROVIDER_KIND.DATABASE,
      description: "Reserved: load knowledge from Postgres / Prisma.",
    },
    {
      id: "provider.shopify",
      kind: KNOWLEDGE_PROVIDER_KIND.SHOPIFY,
      description: "Reserved: load knowledge from Shopify Admin / metafields.",
    },
    {
      id: "provider.cms",
      kind: KNOWLEDGE_PROVIDER_KIND.CMS,
      description: "Reserved: load knowledge from an external CMS.",
    },
    {
      id: "provider.ai",
      kind: KNOWLEDGE_PROVIDER_KIND.AI,
      description: "Reserved: AI-generated / enriched knowledge packs.",
    },
  ];

  for (const stub of stubs) {
    registerKnowledgeProvider({
      id: stub.id,
      kind: stub.kind,
      status: KNOWLEDGE_STATUS.STUB,
      description: stub.description,
      supports: [],
      fetch: stubFetch(stub.id, stub.kind),
    });
  }
}
