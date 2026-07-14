/**
 * Prompt templates — interpolation + slot catalog.
 *
 * Capability NLU templates remain content-not-ready until a later sprint
 * authors capability-specific instruction text.
 * Constitution content is Knowledge-bound (built separately).
 */

import { AI_CAPABILITY_KIND } from "../constants.js";
import { PROMPT_KIND, PROMPT_ROLE, PROMPT_STATUS } from "./constants.js";

/**
 * Registered template slots (capability prompts).
 * Bodies intentionally empty until authored — constitution is separate.
 */
export const PROMPT_TEMPLATE_SLOTS = Object.freeze([
  Object.freeze({
    promptId: "nlu.understand",
    version: "0.0.0",
    kind: PROMPT_KIND.NLU,
    capabilityKind: AI_CAPABILITY_KIND.NLU,
    description: "Natural language understanding template.",
    variables: Object.freeze(["locale", "message", "contextSummary"]),
    contentReady: false,
    status: PROMPT_STATUS.CONTENT_NOT_READY,
  }),
  Object.freeze({
    promptId: "intent.classify",
    version: "0.0.0",
    kind: PROMPT_KIND.INTENT_CLASSIFICATION,
    capabilityKind: AI_CAPABILITY_KIND.INTENT_CLASSIFICATION,
    description: "Intent classification template.",
    variables: Object.freeze(["locale", "message", "candidateIntents"]),
    contentReady: false,
    status: PROMPT_STATUS.CONTENT_NOT_READY,
  }),
  Object.freeze({
    promptId: "entity.extract",
    version: "0.0.0",
    kind: PROMPT_KIND.ENTITY_EXTRACTION,
    capabilityKind: AI_CAPABILITY_KIND.ENTITY_EXTRACTION,
    description: "Entity extraction template.",
    variables: Object.freeze(["locale", "message", "entitySchema"]),
    contentReady: false,
    status: PROMPT_STATUS.CONTENT_NOT_READY,
  }),
  Object.freeze({
    promptId: "image.understand",
    version: "0.0.0",
    kind: PROMPT_KIND.IMAGE_UNDERSTANDING,
    capabilityKind: AI_CAPABILITY_KIND.IMAGE_UNDERSTANDING,
    description: "Image understanding template (not implemented).",
    variables: Object.freeze(["locale", "imageRef"]),
    contentReady: false,
    status: PROMPT_STATUS.CONTENT_NOT_READY,
  }),
  Object.freeze({
    promptId: "room.analyze",
    version: "0.0.0",
    kind: PROMPT_KIND.ROOM_ANALYSIS,
    capabilityKind: AI_CAPABILITY_KIND.ROOM_ANALYSIS,
    description: "Room analysis template (not implemented).",
    variables: Object.freeze(["locale", "imageRef"]),
    contentReady: false,
    status: PROMPT_STATUS.CONTENT_NOT_READY,
  }),
  Object.freeze({
    promptId: "response.rewrite",
    version: "0.0.0",
    kind: PROMPT_KIND.RESPONSE_REWRITING,
    capabilityKind: AI_CAPABILITY_KIND.RESPONSE_REWRITING,
    description: "Response rewriting — must preserve ENARTE facts.",
    variables: Object.freeze(["locale", "sourceText", "toneHints", "constitution"]),
    contentReady: false,
    status: PROMPT_STATUS.CONTENT_NOT_READY,
  }),
  Object.freeze({
    promptId: "json.structured",
    version: "0.0.0",
    kind: PROMPT_KIND.STRUCTURED_JSON,
    capabilityKind: AI_CAPABILITY_KIND.STRUCTURED_JSON,
    description: "Structured JSON generation template.",
    variables: Object.freeze(["locale", "schemaId", "payload"]),
    contentReady: false,
    status: PROMPT_STATUS.CONTENT_NOT_READY,
  }),
]);

/**
 * Resolve {{path.to.value}} tokens from a variables/context object.
 * Missing keys become empty string.
 */
export function interpolateTemplate(template, variables = {}) {
  if (template == null) return "";
  const source = String(template);
  return source.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, path) => {
    const value = lookupPath(variables, path);
    if (value == null) return "";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    }
    return String(value);
  });
}

function lookupPath(obj, path) {
  if (!obj || typeof obj !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  return path.split(".").reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

/**
 * Render a prompt document's messages with variables.
 * Does not call any model.
 */
export function renderPromptTemplate(promptOrId, variables = {}, options = {}) {
  let doc =
    typeof promptOrId === "string"
      ? options.resolve?.(promptOrId) || null
      : promptOrId;

  if (typeof promptOrId === "string" && !doc) {
    const { getPrompt } = options.getPromptFn
      ? { getPrompt: options.getPromptFn }
      : requireRegistry();
    doc = getPrompt(promptOrId, options.version || null);
  }

  if (!doc) {
    return Object.freeze({
      ok: false,
      status: "not_found",
      note: "Prompt template not found.",
      messages: null,
    });
  }

  if (!doc.contentReady) {
    return Object.freeze({
      ok: false,
      status: "content_not_ready",
      promptId: doc.promptId,
      version: doc.version,
      note:
        "Prompt template content is not ready. Constitution may still be available separately.",
      messages: null,
    });
  }

  const messages = (doc.messages || []).map((msg) =>
    Object.freeze({
      role: msg.role || PROMPT_ROLE.USER,
      content: interpolateTemplate(
        msg.contentTemplate != null ? msg.contentTemplate : msg.content,
        variables,
      ),
    }),
  );

  return Object.freeze({
    ok: true,
    status: "rendered",
    promptId: doc.promptId,
    version: doc.version,
    kind: doc.kind,
    messages: Object.freeze(messages),
    note: null,
  });
}

/**
 * Define a template document shape (not yet registered).
 */
export function definePromptTemplate(partial = {}) {
  return Object.freeze({
    promptId: partial.promptId,
    version: partial.version || "0.0.0",
    kind: partial.kind || PROMPT_KIND.CAPABILITY,
    packId: partial.packId || "default",
    description: partial.description || "",
    variables: Object.freeze([...(partial.variables || [])]),
    messages: Object.freeze(
      (partial.messages || []).map((m) =>
        Object.freeze({
          role: m.role,
          content: m.content ?? null,
          contentTemplate: m.contentTemplate ?? null,
        }),
      ),
    ),
    contentReady: Boolean(partial.contentReady),
    knowledgeBound: Boolean(partial.knowledgeBound),
    knowledgeModules: Object.freeze([...(partial.knowledgeModules || [])]),
    status: partial.status || PROMPT_STATUS.DRAFT,
    schemaId: partial.schemaId || null,
  });
}

function requireRegistry() {
  // Dynamic import sync pattern avoided — use cached getter set by registry.
  return {
    getPrompt: (id, version) => _getPromptRef(id, version),
  };
}

/** @type {(id: string, version?: string|null) => object|null} */
let _getPromptRef = () => null;

export function bindPromptRegistryGetter(fn) {
  _getPromptRef = typeof fn === "function" ? fn : () => null;
}
