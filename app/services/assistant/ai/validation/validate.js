/**
 * Validate AI provider payloads before they reach Decision Engine / Intent Router.
 */

import { getAiResponseSchema } from "./schemas.js";

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * @param {object|null} data
 * @param {string} kindOrSchemaId
 */
export function validateAiResponse(data, kindOrSchemaId) {
  const schema = getAiResponseSchema(kindOrSchemaId);
  if (!schema) {
    return Object.freeze({
      ok: false,
      error: "unknown_schema",
      schemaId: null,
      issues: Object.freeze(["No schema registered for this kind."]),
    });
  }

  if (!data || typeof data !== "object") {
    return Object.freeze({
      ok: false,
      error: "invalid_payload",
      schemaId: schema.schemaId,
      issues: Object.freeze(["Response data must be an object."]),
    });
  }

  const issues = [];

  for (const key of schema.required || []) {
    if (data[key] === undefined || data[key] === null) {
      issues.push(`Missing required field: ${key}`);
    }
  }

  for (const [key, expected] of Object.entries(schema.properties || {})) {
    if (data[key] === undefined || data[key] === null) continue;
    const actual = typeOf(data[key]);
    if (actual !== expected) {
      issues.push(`Field "${key}" expected ${expected}, got ${actual}`);
    }
  }

  // Rewrite safety: rewritten text must not claim it invented business facts.
  if (
    kindOrSchemaId === "response_rewriting" &&
    data.preservedFacts === false
  ) {
    issues.push("Response rewriting must preserve ENARTE facts (preservedFacts=true).");
  }

  return Object.freeze({
    ok: issues.length === 0,
    error: issues.length ? "validation_failed" : null,
    schemaId: schema.schemaId,
    issues: Object.freeze(issues),
  });
}
