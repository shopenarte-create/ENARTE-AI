/**
 * Knowledge document envelope — shared by every module.
 *
 * Supports:
 * - versioning (document.version + meta.schemaVersion)
 * - future localization (locale + locales[])
 * - future database / CMS / Shopify sync metadata (meta.sources + meta.sync)
 *
 * No ENARTE business content belongs in this file.
 */

import {
  KNOWLEDGE_DOCUMENT_SCHEMA_VERSION,
  KNOWLEDGE_DOCUMENT_STATUS,
  KNOWLEDGE_LOCALE_UNDETERMINED,
} from "../constants.js";

/**
 * @typedef {object} KnowledgeSyncHook
 * @property {boolean} enabled
 * @property {string|null} lastSyncedAt
 * @property {string|null} externalId
 * @property {object} [cursor]
 */

/**
 * @typedef {object} KnowledgeDocumentMeta
 * @property {string} schemaVersion
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {{ json: boolean, database: boolean, cms: boolean, shopify: boolean, ai: boolean }} sources
 * @property {{ database: KnowledgeSyncHook, cms: KnowledgeSyncHook, shopify: KnowledgeSyncHook }} sync
 */

/**
 * @typedef {object} KnowledgeDocument
 * @property {string} moduleId
 * @property {string} version
 * @property {string} locale
 * @property {string[]} locales
 * @property {string} status
 * @property {KnowledgeDocumentMeta} meta
 * @property {object} content
 */

export function createDefaultSyncHook() {
  return Object.freeze({
    enabled: false,
    lastSyncedAt: null,
    externalId: null,
    cursor: null,
  });
}

export function createDocumentMeta(overrides = {}) {
  const now = new Date().toISOString();
  return Object.freeze({
    schemaVersion:
      overrides.schemaVersion || KNOWLEDGE_DOCUMENT_SCHEMA_VERSION,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    sources: Object.freeze({
      json: false,
      database: false,
      cms: false,
      shopify: false,
      ai: false,
      ...(overrides.sources || {}),
    }),
    sync: Object.freeze({
      database: Object.freeze({
        ...createDefaultSyncHook(),
        ...(overrides.sync?.database || {}),
      }),
      cms: Object.freeze({
        ...createDefaultSyncHook(),
        ...(overrides.sync?.cms || {}),
      }),
      shopify: Object.freeze({
        ...createDefaultSyncHook(),
        ...(overrides.sync?.shopify || {}),
      }),
    }),
  });
}

/**
 * Build a versioned knowledge document envelope around module content.
 */
export function createKnowledgeDocument({
  moduleId,
  version = "0.0.0-placeholder",
  locale = KNOWLEDGE_LOCALE_UNDETERMINED,
  locales = [KNOWLEDGE_LOCALE_UNDETERMINED, "ar", "en"],
  status = KNOWLEDGE_DOCUMENT_STATUS.PLACEHOLDER,
  meta,
  content = {},
} = {}) {
  if (!moduleId) {
    throw new Error("KnowledgeDocument requires moduleId.");
  }

  return Object.freeze({
    moduleId,
    version,
    locale,
    locales: Object.freeze([...(locales || [])]),
    status,
    meta: createDocumentMeta(meta || {}),
    content: Object.freeze({ ...(content || {}) }),
  });
}
