/**
 * Sprint 1 empty placeholders + published ENARTE documents.
 * Published modules win over empty placeholders.
 *
 * Loaded ONLY by the Knowledge Manager (via memory provider).
 * Workflows must never import this module.
 */

import {
  KNOWLEDGE_DOCUMENT_STATUS,
  KNOWLEDGE_LOCALE_UNDETERMINED,
  KNOWLEDGE_MODULE_ID,
  SPRINT1_KNOWLEDGE_MODULE_IDS,
} from "../constants.js";
import { createKnowledgeDocument } from "../schemas/envelope.js";
import { CONTENT_FACTORIES } from "../schemas/content.js";
import { assertValidKnowledgeDocument } from "../schemas/validators.js";
import { loadPublishedDocument } from "../documents/index.js";

function buildPlaceholder(moduleId) {
  const factory = CONTENT_FACTORIES[moduleId];
  if (!factory) {
    throw new Error(`No content factory for module "${moduleId}".`);
  }

  const document = createKnowledgeDocument({
    moduleId,
    version: "0.0.0-placeholder",
    locale: KNOWLEDGE_LOCALE_UNDETERMINED,
    locales: [KNOWLEDGE_LOCALE_UNDETERMINED, "ar", "en"],
    status: KNOWLEDGE_DOCUMENT_STATUS.PLACEHOLDER,
    content: factory(),
  });

  assertValidKnowledgeDocument(document);
  return document;
}

/** @type {Map<string, object>} */
const PLACEHOLDERS = new Map(
  SPRINT1_KNOWLEDGE_MODULE_IDS.map((id) => [id, buildPlaceholder(id)]),
);

/**
 * Internal loader used by the memory knowledge provider / Knowledge Manager.
 * Not a workflow API.
 */
export function loadPlaceholderDocument(moduleId) {
  const published = loadPublishedDocument(moduleId);
  if (published) return published;
  return PLACEHOLDERS.get(moduleId) || null;
}

export function listPlaceholderModuleIds() {
  return [...PLACEHOLDERS.keys()];
}

export function loadAllPlaceholderDocuments() {
  return Object.freeze(
    Object.fromEntries(
      SPRINT1_KNOWLEDGE_MODULE_IDS.map((id) => [
        id,
        loadPlaceholderDocument(id),
      ]),
    ),
  );
}

export const PLACEHOLDER_MODULE_IDS = Object.freeze([
  KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY,
  KNOWLEDGE_MODULE_ID.BUSINESS_RULES,
  KNOWLEDGE_MODULE_ID.SERVICES,
  KNOWLEDGE_MODULE_ID.DELIVERY,
  KNOWLEDGE_MODULE_ID.FAQ,
]);
