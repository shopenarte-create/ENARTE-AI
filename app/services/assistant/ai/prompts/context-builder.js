/**
 * Prompt context builder — assembles variables for template rendering.
 * Pulls Knowledge / session / constitution; never invents business facts.
 */

import { getPrompt } from "./registry.js";
import { AI_CONSTITUTION_PROMPT_ID } from "./constants.js";

/**
 * @param {object} input
 * @param {string} [input.locale]
 * @param {string} [input.message]
 * @param {object} [input.session]
 * @param {object} [input.state] conversation brain state
 * @param {object} [input.knowledge] Knowledge client or preloaded bundle
 * @param {object} [input.artifacts]
 * @param {string[]} [input.candidateIntents]
 * @param {object} [input.constitution] prebuilt constitution snapshot
 * @param {object} [input.extra]
 */
export async function buildPromptContext(input = {}) {
  const locale = input.locale || "ar";
  const knowledgeSnapshot = await snapshotKnowledge(input.knowledge, locale);
  const constitution =
    input.constitution ||
    (await resolveConstitutionText(input.constitutionPromptId));

  return Object.freeze({
    locale,
    message: input.message || "",
    contextSummary: input.contextSummary || summarizeState(input.state),
    candidateIntents: Object.freeze([...(input.candidateIntents || [])]),
    entitySchema: input.entitySchema || null,
    schemaId: input.schemaId || null,
    payload: input.payload || null,
    sourceText: input.sourceText || null,
    toneHints: input.toneHints || null,
    imageRef: input.imageRef || null,
    session: Object.freeze({
      id: input.session?.id || null,
      shop: input.session?.shop || null,
      channel: input.session?.channel || null,
    }),
    state: Object.freeze({
      phase: input.state?.phase || null,
      currentWorkflow: input.state?.currentWorkflow || null,
      selectedProductId: input.state?.selectedProduct?.id || null,
      selectedRoomName: input.state?.selectedRoom?.name || null,
    }),
    artifacts: Object.freeze({ ...(input.artifacts || {}) }),
    knowledge: knowledgeSnapshot,
    constitution,
    ...Object.freeze({ ...(input.extra || {}) }),
  });
}

async function snapshotKnowledge(knowledge, locale) {
  if (!knowledge) {
    return Object.freeze({ available: false, modules: Object.freeze({}) });
  }

  // Prebuilt plain object
  if (knowledge.modules && typeof knowledge.get !== "function") {
    return Object.freeze({
      available: true,
      locale,
      modules: Object.freeze({ ...knowledge.modules }),
    });
  }

  if (typeof knowledge.get !== "function") {
    return Object.freeze({ available: false, modules: Object.freeze({}) });
  }

  const moduleIds = [
    "assistant_personality",
    "business_rules",
    "services",
    "delivery",
  ];
  const modules = {};
  for (const id of moduleIds) {
    try {
      const record = await knowledge.get(id, { locale });
      modules[id] = record?.data?.content || null;
    } catch {
      modules[id] = null;
    }
  }

  return Object.freeze({
    available: true,
    locale,
    modules: Object.freeze(modules),
  });
}

function summarizeState(state) {
  if (!state) return "";
  const bits = [
    state.phase ? `phase=${state.phase}` : null,
    state.currentWorkflow ? `workflow=${state.currentWorkflow}` : null,
    state.selectedProduct?.title
      ? `product=${state.selectedProduct.title}`
      : null,
    state.selectedRoom?.name ? `room=${state.selectedRoom.name}` : null,
  ].filter(Boolean);
  return bits.join("; ");
}

async function resolveConstitutionText(promptId) {
  const id = promptId || AI_CONSTITUTION_PROMPT_ID;
  const prompt = getPrompt(id);
  if (!prompt?.contentReady || !prompt.messages?.length) return null;
  return prompt.messages
    .map((m) => m.content || m.contentTemplate || "")
    .filter(Boolean)
    .join("\n\n");
}
