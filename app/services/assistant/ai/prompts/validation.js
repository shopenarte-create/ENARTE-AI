/**
 * Prompt document validation — structure + safety gates.
 * Does not invent ENARTE business rules; blocks unsafe free-form invention markers.
 */

import { PROMPT_KIND, PROMPT_ROLE, PROMPT_STATUS } from "./constants.js";
import { isValidSemverLike } from "./versioning.js";

const ALLOWED_ROLES = new Set(Object.values(PROMPT_ROLE));
const ALLOWED_KINDS = new Set(Object.values(PROMPT_KIND));
const ALLOWED_STATUS = new Set(Object.values(PROMPT_STATUS));

/** Patterns that suggest instructing the model TO invent catalog facts. */
const UNSAFE_INVENTION_MARKERS = Object.freeze([
  /\b(please\s+)?invent\s+(a\s+)?(product|price|availability)\b/i,
  /\bmake\s+up\s+(prices?|products?)\b/i,
  /\bsearch\s+the\s+internet\s+for\s+products\b/i,
  /\brecommend\s+non[- ]?enarte\b/i,
  /\bhallucinate\s+(products?|prices?)\b/i,
]);

/**
 * @param {object} doc
 */
export function validatePromptDocument(doc) {
  const issues = [];

  if (!doc || typeof doc !== "object") {
    return fail(["Prompt document must be an object."]);
  }

  if (!doc.promptId || typeof doc.promptId !== "string") {
    issues.push("promptId is required (string).");
  }
  if (!doc.version || !isValidSemverLike(doc.version)) {
    issues.push("version is required (semver-like).");
  }
  if (doc.kind && !ALLOWED_KINDS.has(doc.kind)) {
    issues.push(`Unknown kind: ${doc.kind}`);
  }
  if (doc.status && !ALLOWED_STATUS.has(doc.status)) {
    issues.push(`Unknown status: ${doc.status}`);
  }

  if (doc.variables != null && !Array.isArray(doc.variables)) {
    issues.push("variables must be an array of strings.");
  }

  const skipInventionScan =
    doc.knowledgeBound === true || doc.kind === PROMPT_KIND.CONSTITUTION;

  if (doc.messages != null) {
    if (!Array.isArray(doc.messages)) {
      issues.push("messages must be an array.");
    } else {
      doc.messages.forEach((msg, index) => {
        if (!msg || typeof msg !== "object") {
          issues.push(`messages[${index}] must be an object.`);
          return;
        }
        if (!ALLOWED_ROLES.has(msg.role)) {
          issues.push(`messages[${index}].role is invalid.`);
        }
        if (typeof msg.content !== "string" && msg.contentTemplate == null) {
          issues.push(
            `messages[${index}] requires content or contentTemplate string.`,
          );
        }
        if (skipInventionScan) return;
        const text = String(msg.content || msg.contentTemplate || "");
        // Allow explicit prohibitions ("never invent…", "do not invent…").
        const prohibitions =
          /\b(never|do not|don't|must not)\s+invent\b/i.test(text);
        if (prohibitions) return;
        for (const re of UNSAFE_INVENTION_MARKERS) {
          if (re.test(text)) {
            issues.push(
              `messages[${index}] contains unsafe invention directive (${re}).`,
            );
          }
        }
      });
    }
  }

  if (doc.kind === PROMPT_KIND.CONSTITUTION) {
    if (!doc.knowledgeBound) {
      issues.push("Constitution prompts must set knowledgeBound=true.");
    }
    if (!Array.isArray(doc.knowledgeModules) || !doc.knowledgeModules.length) {
      issues.push("Constitution prompts must declare knowledgeModules[].");
    }
  }

  if (doc.contentReady === true && !doc.messages?.length && !doc.body) {
    issues.push("contentReady=true requires messages[] or body.");
  }

  return issues.length
    ? fail(issues)
    : Object.freeze({
        ok: true,
        error: null,
        issues: Object.freeze([]),
      });
}

function fail(issues) {
  return Object.freeze({
    ok: false,
    error: "prompt_validation_failed",
    issues: Object.freeze([...issues]),
  });
}

/**
 * Assert helper — throws on invalid docs.
 */
export function assertValidPromptDocument(doc) {
  const result = validatePromptDocument(doc);
  if (!result.ok) {
    const err = new Error(
      `Invalid prompt document: ${result.issues.join(" | ")}`,
    );
    err.code = "prompt_validation_failed";
    err.issues = result.issues;
    throw err;
  }
  return doc;
}
