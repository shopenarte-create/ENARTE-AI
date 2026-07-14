/**
 * Prompt registry — versioned prompt documents + metadata.
 *
 * Sprint 8: full documents allowed when they pass validation.
 * Capability NLU slots may remain content-not-ready.
 */

import { PROMPT_TEMPLATE_SLOTS, bindPromptRegistryGetter } from "./templates.js";
import {
  makePromptVersionKey,
  pickLatestVersion,
  buildVersionLineage,
} from "./versioning.js";
import { assertValidPromptDocument, validatePromptDocument } from "./validation.js";
import { PROMPT_STATUS } from "./constants.js";

/** @type {Map<string, object>} key = promptId@version */
const prompts = new Map();

function freezePrompt(entry) {
  return Object.freeze({
    promptId: entry.promptId,
    version: entry.version,
    kind: entry.kind || null,
    packId: entry.packId || "default",
    description: entry.description || "",
    variables: Object.freeze([...(entry.variables || [])]),
    messages: entry.messages
      ? Object.freeze(
          entry.messages.map((m) =>
            Object.freeze({
              role: m.role,
              content: m.content ?? null,
              contentTemplate: m.contentTemplate ?? null,
            }),
          ),
        )
      : Object.freeze([]),
    body: entry.body ?? null,
    contentReady: Boolean(entry.contentReady),
    knowledgeBound: Boolean(entry.knowledgeBound),
    knowledgeModules: Object.freeze([...(entry.knowledgeModules || [])]),
    schemaId: entry.schemaId || null,
    status: entry.status || PROMPT_STATUS.REGISTERED,
    source: entry.source || "registry",
    registeredAt: entry.registeredAt || new Date().toISOString(),
  });
}

/**
 * Register metadata-only or full validated prompt documents.
 * @param {object} entry
 * @param {object} [options]
 * @param {boolean} [options.allowUnsafe] — tests only; still validates shape
 */
export function registerPrompt(entry, options = {}) {
  if (!entry?.promptId || !entry?.version) {
    throw new Error("registerPrompt requires promptId and version.");
  }

  const hasContent = Boolean(
    entry.body ||
      entry.messages?.length ||
      entry.system ||
      entry.user ||
      entry.contentReady,
  );

  // Sprint 6 compatibility: bare invented bodies without validation markers fail.
  if (
    hasContent &&
    !entry.knowledgeBound &&
    entry.kind !== "constitution" &&
    !options.allowContent &&
    !entry.messages
  ) {
    // legacy shape { body: "..." } without messages — reject
    if (entry.body || entry.system || entry.user) {
      throw new Error(
        "Prompt content is forbidden without a validated messages[] document. Use definePromptTemplate + validatePromptDocument.",
      );
    }
  }

  if (hasContent || entry.kind === "constitution") {
    assertValidPromptDocument({
      ...entry,
      messages: entry.messages || (entry.body
        ? [{ role: "system", content: entry.body }]
        : entry.messages),
      contentReady: entry.contentReady ?? Boolean(entry.messages?.length || entry.body),
    });
  }

  const record = freezePrompt(entry);
  prompts.set(makePromptVersionKey(record.promptId, record.version), record);
  return record;
}

export function getPrompt(promptId, version = null) {
  if (!promptId) return null;
  if (version) {
    return prompts.get(makePromptVersionKey(promptId, version)) || null;
  }
  const versions = [...prompts.values()]
    .filter((p) => p.promptId === promptId)
    .map((p) => p.version);
  const latest = pickLatestVersion(versions);
  return latest
    ? prompts.get(makePromptVersionKey(promptId, latest)) || null
    : null;
}

export function listPrompts({ kind = null, contentReady = null } = {}) {
  return [...prompts.values()]
    .filter((p) => (kind == null ? true : p.kind === kind))
    .filter((p) =>
      contentReady == null ? true : Boolean(p.contentReady) === contentReady,
    )
    .map((p) => Object.freeze({ ...p }));
}

export function listPromptIds() {
  return Object.freeze([
    ...new Set([...prompts.values()].map((p) => p.promptId)),
  ]);
}

export function getPromptLineage(promptId) {
  const entries = [...prompts.values()].filter((p) => p.promptId === promptId);
  return buildVersionLineage(entries);
}

export function unregisterPrompt(promptId, version) {
  if (!promptId || !version) return false;
  return prompts.delete(makePromptVersionKey(promptId, version));
}

export function resetPromptRegistry({ includeSlots = true } = {}) {
  prompts.clear();
  if (includeSlots) {
    for (const slot of PROMPT_TEMPLATE_SLOTS) {
      registerPrompt(slot);
    }
  }
}

/** Soft validate without throwing — for loaders. */
export function tryRegisterPrompt(entry) {
  const validation = validatePromptDocument(entry);
  if (!validation.ok) {
    return Object.freeze({ ok: false, validation });
  }
  const record = registerPrompt(entry, { allowContent: true });
  return Object.freeze({ ok: true, record, validation });
}

resetPromptRegistry();
bindPromptRegistryGetter(getPrompt);
