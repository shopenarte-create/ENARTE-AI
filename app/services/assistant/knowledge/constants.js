/**
 * Knowledge Engine constants — module ids and provider kinds.
 * No business content lives here.
 */

export const KNOWLEDGE_ENGINE_VERSION = "knowledge.engine.v1";
export const KNOWLEDGE_MANAGER_VERSION = "knowledge.manager.sprint1.v1";
export const KNOWLEDGE_DOCUMENT_SCHEMA_VERSION = "1.0.0";

export const KNOWLEDGE_MODULE_ID = Object.freeze({
  PRODUCTS: "products",
  SERVICES: "services",
  DELIVERY: "delivery",
  INSTALLATION: "installation",
  MAINTENANCE: "maintenance",
  SOURCING: "sourcing",
  FAQ: "faq",
  BUSINESS_RULES: "business_rules",
  ASSISTANT_PERSONALITY: "assistant_personality",
});

/** Ordered catalog of all knowledge modules. */
export const KNOWLEDGE_MODULE_IDS = Object.freeze(
  Object.values(KNOWLEDGE_MODULE_ID),
);

/**
 * Sprint 1 modules: strongly typed schemas + placeholders (no business data).
 */
export const SPRINT1_KNOWLEDGE_MODULE_IDS = Object.freeze([
  KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY,
  KNOWLEDGE_MODULE_ID.BUSINESS_RULES,
  KNOWLEDGE_MODULE_ID.SERVICES,
  KNOWLEDGE_MODULE_ID.DELIVERY,
  KNOWLEDGE_MODULE_ID.FAQ,
]);

/**
 * Replaceable provider backends.
 * Workflows never bind to a specific kind — the engine/manager selects providers.
 */
export const KNOWLEDGE_PROVIDER_KIND = Object.freeze({
  NULL: "null",
  MEMORY: "memory",
  JSON: "json",
  DATABASE: "database",
  SHOPIFY: "shopify",
  CMS: "cms",
  AI: "ai",
  CUSTOM: "custom",
});

export const KNOWLEDGE_STATUS = Object.freeze({
  EMPTY: "empty",
  READY: "ready",
  STUB: "stub",
  PLACEHOLDER: "placeholder",
  ERROR: "error",
  NOT_REGISTERED: "not_registered",
});

/** Document lifecycle (content envelope). */
export const KNOWLEDGE_DOCUMENT_STATUS = Object.freeze({
  PLACEHOLDER: "placeholder",
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
});

/** Locale token for locale-agnostic placeholders. */
export const KNOWLEDGE_LOCALE_UNDETERMINED = "und";
