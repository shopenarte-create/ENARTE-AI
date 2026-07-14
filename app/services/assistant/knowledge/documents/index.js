/**
 * Knowledge documents registry — published ENARTE modules only.
 * Workflows must never import this file; use Knowledge Manager / ctx.knowledge.
 */

import {
  KNOWLEDGE_DOCUMENT_STATUS,
  KNOWLEDGE_LOCALE_UNDETERMINED,
  KNOWLEDGE_MODULE_ID,
} from "../constants.js";
import { createKnowledgeDocument } from "../schemas/envelope.js";
import { assertValidKnowledgeDocument } from "../schemas/validators.js";
import {
  ASSISTANT_PERSONALITY_VERSION,
  buildAssistantPersonalityContent,
} from "./assistant-personality.js";
import {
  BUSINESS_RULES_VERSION,
  buildBusinessRulesContent,
} from "./business-rules.js";
import {
  SERVICES_VERSION,
  buildServicesContent,
} from "./services.js";
import {
  DELIVERY_VERSION,
  buildDeliveryContent,
} from "./delivery.js";

function publishDocument({ moduleId, version, content }) {
  const document = createKnowledgeDocument({
    moduleId,
    version,
    locale: KNOWLEDGE_LOCALE_UNDETERMINED,
    locales: [KNOWLEDGE_LOCALE_UNDETERMINED, "ar", "en"],
    status: KNOWLEDGE_DOCUMENT_STATUS.PUBLISHED,
    meta: {
      sources: { json: true },
    },
    content,
  });
  assertValidKnowledgeDocument(document);
  return document;
}

/** @type {Map<string, object>} */
const PUBLISHED = new Map();

PUBLISHED.set(
  KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY,
  publishDocument({
    moduleId: KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY,
    version: ASSISTANT_PERSONALITY_VERSION,
    content: buildAssistantPersonalityContent(),
  }),
);

PUBLISHED.set(
  KNOWLEDGE_MODULE_ID.BUSINESS_RULES,
  publishDocument({
    moduleId: KNOWLEDGE_MODULE_ID.BUSINESS_RULES,
    version: BUSINESS_RULES_VERSION,
    content: buildBusinessRulesContent(),
  }),
);

PUBLISHED.set(
  KNOWLEDGE_MODULE_ID.SERVICES,
  publishDocument({
    moduleId: KNOWLEDGE_MODULE_ID.SERVICES,
    version: SERVICES_VERSION,
    content: buildServicesContent(),
  }),
);

PUBLISHED.set(
  KNOWLEDGE_MODULE_ID.DELIVERY,
  publishDocument({
    moduleId: KNOWLEDGE_MODULE_ID.DELIVERY,
    version: DELIVERY_VERSION,
    content: buildDeliveryContent(),
  }),
);

export function loadPublishedDocument(moduleId) {
  return PUBLISHED.get(moduleId) || null;
}

export function listPublishedModuleIds() {
  return [...PUBLISHED.keys()];
}

export function loadAllPublishedDocuments() {
  return Object.freeze(
    Object.fromEntries([...PUBLISHED.entries()].map(([id, doc]) => [id, doc])),
  );
}
