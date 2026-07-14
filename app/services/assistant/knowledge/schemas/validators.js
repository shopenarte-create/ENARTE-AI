/**
 * Knowledge document validation — structural only (no business-rule checks).
 */

import {
  KNOWLEDGE_DOCUMENT_STATUS,
} from "../constants.js";
import { CONTENT_REQUIRED_KEYS } from "./content.js";

const SEMVER_LIKE =
  /^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/;

/**
 * @typedef {object} ValidationIssue
 * @property {string} path
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} ok
 * @property {ValidationIssue[]} errors
 * @property {ValidationIssue[]} warnings
 */

function issue(path, code, message) {
  return Object.freeze({ path, code, message });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateSyncHook(hook, path, errors) {
  if (!isPlainObject(hook)) {
    errors.push(issue(path, "type", "Sync hook must be an object."));
    return;
  }
  if (typeof hook.enabled !== "boolean") {
    errors.push(issue(`${path}.enabled`, "type", "enabled must be boolean."));
  }
  if (hook.lastSyncedAt != null && typeof hook.lastSyncedAt !== "string") {
    errors.push(
      issue(`${path}.lastSyncedAt`, "type", "lastSyncedAt must be string|null."),
    );
  }
  if (hook.externalId != null && typeof hook.externalId !== "string") {
    errors.push(
      issue(`${path}.externalId`, "type", "externalId must be string|null."),
    );
  }
}

/**
 * Validate the shared document envelope.
 * @param {object} document
 * @returns {ValidationResult}
 */
export function validateKnowledgeEnvelope(document) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(document)) {
    return Object.freeze({
      ok: false,
      errors: [issue("$", "type", "Document must be a plain object.")],
      warnings: [],
    });
  }

  if (typeof document.moduleId !== "string" || !document.moduleId) {
    errors.push(issue("moduleId", "required", "moduleId is required."));
  }

  if (typeof document.version !== "string" || !document.version) {
    errors.push(issue("version", "required", "version is required."));
  } else if (!SEMVER_LIKE.test(document.version)) {
    errors.push(
      issue(
        "version",
        "format",
        "version must look like semver (e.g. 1.0.0 or 0.0.0-placeholder).",
      ),
    );
  }

  if (typeof document.locale !== "string" || !document.locale) {
    errors.push(issue("locale", "required", "locale is required."));
  }

  if (!Array.isArray(document.locales)) {
    errors.push(issue("locales", "type", "locales must be an array."));
  } else if (document.locales.some((l) => typeof l !== "string")) {
    errors.push(issue("locales", "type", "locales entries must be strings."));
  }

  const allowedStatus = Object.values(KNOWLEDGE_DOCUMENT_STATUS);
  if (!allowedStatus.includes(document.status)) {
    errors.push(
      issue(
        "status",
        "enum",
        `status must be one of: ${allowedStatus.join(", ")}.`,
      ),
    );
  }

  if (!isPlainObject(document.meta)) {
    errors.push(issue("meta", "required", "meta is required."));
  } else {
    if (typeof document.meta.schemaVersion !== "string") {
      errors.push(
        issue("meta.schemaVersion", "required", "schemaVersion is required."),
      );
    }
    if (typeof document.meta.createdAt !== "string") {
      errors.push(issue("meta.createdAt", "required", "createdAt is required."));
    }
    if (typeof document.meta.updatedAt !== "string") {
      errors.push(issue("meta.updatedAt", "required", "updatedAt is required."));
    }
    if (!isPlainObject(document.meta.sources)) {
      errors.push(issue("meta.sources", "required", "sources is required."));
    }
    if (!isPlainObject(document.meta.sync)) {
      errors.push(issue("meta.sync", "required", "sync is required."));
    } else {
      validateSyncHook(document.meta.sync.database, "meta.sync.database", errors);
      validateSyncHook(document.meta.sync.cms, "meta.sync.cms", errors);
      validateSyncHook(document.meta.sync.shopify, "meta.sync.shopify", errors);
    }
  }

  if (!isPlainObject(document.content)) {
    errors.push(issue("content", "required", "content must be an object."));
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  });
}

/**
 * Validate module-specific content keys/types (still no business rules).
 * @param {string} moduleId
 * @param {object} content
 * @returns {ValidationResult}
 */
export function validateModuleContent(moduleId, content) {
  const errors = [];
  const warnings = [];
  const requiredKeys = CONTENT_REQUIRED_KEYS[moduleId];

  if (!requiredKeys) {
    warnings.push(
      issue(
        "content",
        "unknown_module",
        `No Sprint 1 content schema registered for "${moduleId}".`,
      ),
    );
    return Object.freeze({
      ok: true,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
    });
  }

  if (!isPlainObject(content)) {
    return Object.freeze({
      ok: false,
      errors: [issue("content", "type", "content must be an object.")],
      warnings: Object.freeze(warnings),
    });
  }

  for (const key of requiredKeys) {
    if (!(key in content)) {
      errors.push(
        issue(`content.${key}`, "required", `Missing required key "${key}".`),
      );
    }
  }

  // Soft type checks for known array/object fields
  if (moduleId === "services") {
    for (const key of ["offerings", "categories", "disclaimers"]) {
      if (key in content && !Array.isArray(content[key])) {
        errors.push(issue(`content.${key}`, "type", `${key} must be an array.`));
      }
    }
    for (const key of ["contact", "customLighting", "serviceRules"]) {
      if (key in content && !isPlainObject(content[key])) {
        errors.push(
          issue(`content.${key}`, "type", `${key} must be an object.`),
        );
      }
    }
  }

  if (moduleId === "delivery") {
    for (const key of [
      "regions",
      "options",
      "constraints",
      "zones",
      "shippingProviders",
      "holidaySchedules",
    ]) {
      if (key in content && !Array.isArray(content[key])) {
        errors.push(issue(`content.${key}`, "type", `${key} must be an array.`));
      }
    }
    for (const key of [
      "amman",
      "otherCities",
      "customerCommunication",
      "sla",
      "pricing",
      "expressDelivery",
      "scheduledDelivery",
      "orderTracking",
      "futureSupport",
    ]) {
      if (key in content && !isPlainObject(content[key])) {
        errors.push(
          issue(`content.${key}`, "type", `${key} must be an object.`),
        );
      }
    }
  }

  if (moduleId === "faq") {
    for (const key of ["items", "categories"]) {
      if (key in content && !Array.isArray(content[key])) {
        errors.push(issue(`content.${key}`, "type", `${key} must be an array.`));
      }
    }
  }

  if (moduleId === "business_rules") {
    for (const key of [
      "delivery",
      "installationMaintenance",
      "garageLighting",
      "productSearch",
      "unavailableProducts",
      "returnsExchange",
      "roomRecommendation",
      "imageSearch",
      "buttonsPolicy",
      "generalRules",
      "escalation",
    ]) {
      if (key in content && !isPlainObject(content[key])) {
        errors.push(
          issue(`content.${key}`, "type", `${key} must be an object.`),
        );
      }
    }
    for (const key of ["rules", "policies"]) {
      if (key in content && !Array.isArray(content[key])) {
        errors.push(issue(`content.${key}`, "type", `${key} must be an array.`));
      }
    }
  }

  if (moduleId === "assistant_personality") {
    for (const key of [
      "identity",
      "tone",
      "specialization",
      "messages",
      "constraints",
      "mission",
      "conversationPrinciples",
      "productRules",
      "sourcing",
      "imageSearch",
      "roomRecommendation",
    ]) {
      if (key in content && !isPlainObject(content[key])) {
        errors.push(
          issue(`content.${key}`, "type", `${key} must be an object.`),
        );
      }
    }
    if (
      content.mission &&
      "goals" in content.mission &&
      !Array.isArray(content.mission.goals)
    ) {
      errors.push(
        issue("content.mission.goals", "type", "goals must be an array."),
      );
    }
    if (
      content.constraints &&
      content.constraints.maxClarifyingQuestions != null &&
      typeof content.constraints.maxClarifyingQuestions !== "number"
    ) {
      errors.push(
        issue(
          "content.constraints.maxClarifyingQuestions",
          "type",
          "maxClarifyingQuestions must be a number.",
        ),
      );
    }
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  });
}

/**
 * Full document validation (envelope + module content).
 * @param {object} document
 * @returns {ValidationResult}
 */
export function validateKnowledgeDocument(document) {
  const envelope = validateKnowledgeEnvelope(document);
  if (!envelope.ok) {
    return envelope;
  }

  const contentResult = validateModuleContent(
    document.moduleId,
    document.content,
  );

  const errors = [...envelope.errors, ...contentResult.errors];
  const warnings = [...envelope.warnings, ...contentResult.warnings];

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  });
}

export function assertValidKnowledgeDocument(document) {
  const result = validateKnowledgeDocument(document);
  if (!result.ok) {
    const detail = result.errors
      .map((e) => `${e.path}: ${e.message}`)
      .join("; ");
    const error = new Error(`Invalid knowledge document — ${detail}`);
    error.validation = result;
    throw error;
  }
  return result;
}
