/**
 * Response validation schemas for AI capability outputs.
 * Used to validate structured AI results before Decision Engine consumes them.
 * Sprint 6: schema definitions only — no model output yet.
 */

import { AI_CAPABILITY_KIND } from "../constants.js";

/**
 * Lightweight JSON-schema-ish descriptors (not full JSON Schema).
 * Validators check presence/type of required fields.
 */
export const AI_RESPONSE_SCHEMAS = Object.freeze({
  [AI_CAPABILITY_KIND.ASSISTANT_CHAT]: Object.freeze({
    schemaId: "ai.assistant_chat.v1",
    required: Object.freeze(["message"]),
    properties: Object.freeze({
      message: "string",
      cards: "array",
      actions: "array",
    }),
  }),
  [AI_CAPABILITY_KIND.NLU]: Object.freeze({
    schemaId: "ai.nlu.v0",
    required: Object.freeze(["understood", "confidence"]),
    properties: Object.freeze({
      understood: "boolean",
      confidence: "number",
      summary: "string",
    }),
  }),
  [AI_CAPABILITY_KIND.INTENT_CLASSIFICATION]: Object.freeze({
    schemaId: "ai.intent.v0",
    required: Object.freeze(["intent", "confidence"]),
    properties: Object.freeze({
      intent: "string",
      confidence: "number",
      alternatives: "array",
    }),
  }),
  [AI_CAPABILITY_KIND.ENTITY_EXTRACTION]: Object.freeze({
    schemaId: "ai.entities.v0",
    required: Object.freeze(["entities"]),
    properties: Object.freeze({
      entities: "object",
      confidence: "number",
    }),
  }),
  [AI_CAPABILITY_KIND.IMAGE_UNDERSTANDING]: Object.freeze({
    schemaId: "ai.image.v0",
    required: Object.freeze(["description"]),
    properties: Object.freeze({
      description: "string",
      labels: "array",
      confidence: "number",
    }),
  }),
  [AI_CAPABILITY_KIND.ROOM_ANALYSIS]: Object.freeze({
    schemaId: "ai.room.v0",
    required: Object.freeze(["roomType"]),
    properties: Object.freeze({
      roomType: "string",
      lightingNotes: "array",
      confidence: "number",
    }),
  }),
  [AI_CAPABILITY_KIND.RESPONSE_REWRITING]: Object.freeze({
    schemaId: "ai.rewrite.v0",
    required: Object.freeze(["text"]),
    properties: Object.freeze({
      text: "string",
      preservedFacts: "boolean",
    }),
  }),
  [AI_CAPABILITY_KIND.STRUCTURED_JSON]: Object.freeze({
    schemaId: "ai.json.v0",
    required: Object.freeze(["json"]),
    properties: Object.freeze({
      json: "object",
    }),
  }),
});

export function getAiResponseSchema(kindOrSchemaId) {
  if (!kindOrSchemaId) return null;
  if (AI_RESPONSE_SCHEMAS[kindOrSchemaId]) {
    return AI_RESPONSE_SCHEMAS[kindOrSchemaId];
  }
  return (
    Object.values(AI_RESPONSE_SCHEMAS).find(
      (s) => s.schemaId === kindOrSchemaId,
    ) || null
  );
}
