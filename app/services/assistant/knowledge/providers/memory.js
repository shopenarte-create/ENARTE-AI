/**
 * In-memory knowledge provider — serves validated documents (published + placeholders).
 */

import {
  KNOWLEDGE_DOCUMENT_STATUS,
  KNOWLEDGE_PROVIDER_KIND,
  KNOWLEDGE_STATUS,
  SPRINT1_KNOWLEDGE_MODULE_IDS,
} from "../constants.js";
import { createKnowledgeRecord, defineKnowledgeProvider } from "../contracts.js";
import { loadPlaceholderDocument } from "../placeholders/index.js";

function statusFromDocument(document) {
  if (!document) return KNOWLEDGE_STATUS.EMPTY;
  if (document.status === KNOWLEDGE_DOCUMENT_STATUS.PUBLISHED) {
    return KNOWLEDGE_STATUS.READY;
  }
  if (document.status === KNOWLEDGE_DOCUMENT_STATUS.PLACEHOLDER) {
    return KNOWLEDGE_STATUS.PLACEHOLDER;
  }
  return KNOWLEDGE_STATUS.READY;
}

export function createMemoryKnowledgeProvider() {
  return defineKnowledgeProvider({
    id: "provider.memory",
    kind: KNOWLEDGE_PROVIDER_KIND.MEMORY,
    status: KNOWLEDGE_STATUS.READY,
    description:
      "In-memory knowledge provider (published ENARTE modules + placeholders).",
    supports: [...SPRINT1_KNOWLEDGE_MODULE_IDS],
    async fetch(query) {
      const document = loadPlaceholderDocument(query.moduleId);
      if (!document) {
        return createKnowledgeRecord({
          moduleId: query.moduleId,
          status: KNOWLEDGE_STATUS.EMPTY,
          providerId: "provider.memory",
          providerKind: KNOWLEDGE_PROVIDER_KIND.MEMORY,
          data: {},
          note: `No memory document for "${query.moduleId}".`,
        });
      }

      const locale = query.locale || document.locale;
      const status = statusFromDocument(document);

      return createKnowledgeRecord({
        moduleId: query.moduleId,
        status,
        providerId: "provider.memory",
        providerKind: KNOWLEDGE_PROVIDER_KIND.MEMORY,
        data: {
          document,
          locale,
          version: document.version,
          content: document.content,
        },
        note:
          status === KNOWLEDGE_STATUS.READY
            ? "Published ENARTE knowledge document."
            : "Placeholder document (empty schema).",
      });
    },
  });
}
