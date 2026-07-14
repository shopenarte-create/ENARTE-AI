/**
 * Prompt loader — load packs from in-memory definitions or modules.
 * Does not fetch remote prompts. Does not call OpenAI.
 */

import { tryRegisterPrompt, registerPrompt } from "./registry.js";
import { validatePromptDocument } from "./validation.js";
import { definePromptTemplate } from "./templates.js";

/**
 * Load an array of prompt documents into the registry.
 * @param {object[]} documents
 * @param {object} [options]
 */
export function loadPromptPack(documents = [], options = {}) {
  const results = [];
  for (const raw of documents) {
    const doc = definePromptTemplate(raw);
    const validation = validatePromptDocument({
      ...doc,
      contentReady: doc.contentReady,
    });
    if (!validation.ok) {
      results.push(
        Object.freeze({
          ok: false,
          promptId: doc.promptId,
          version: doc.version,
          validation,
        }),
      );
      if (options.strict) {
        const err = new Error(
          `Prompt pack load failed for ${doc.promptId}@${doc.version}`,
        );
        err.issues = validation.issues;
        throw err;
      }
      continue;
    }

    const record = registerPrompt(doc, { allowContent: true });
    results.push(
      Object.freeze({
        ok: true,
        promptId: record.promptId,
        version: record.version,
        record,
      }),
    );
  }

  return Object.freeze({
    ok: results.every((r) => r.ok),
    loaded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results: Object.freeze(results),
  });
}

/**
 * Dynamically import a pack module that exports `prompts` or default array.
 * @param {string} moduleUrl
 */
export async function loadPromptPackModule(moduleUrl, options = {}) {
  const mod = await import(moduleUrl);
  const documents = mod.prompts || mod.default || [];
  if (!Array.isArray(documents)) {
    throw new Error("Prompt pack module must export prompts[] or default[].");
  }
  return loadPromptPack(documents, options);
}

/**
 * Soft-load helper used by constitution bootstrap.
 */
export function loadPromptDocument(doc) {
  return tryRegisterPrompt(definePromptTemplate(doc));
}
