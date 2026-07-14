/**
 * Shared category purchase journey (fan / outdoor lighting).
 * Pattern: ONE Knowledge clarification → Product Search → sourcing fallback.
 * No OpenAI. No hardcoded ENARTE rules beyond Knowledge copy.
 */

import { EVENT_TYPE, WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { publish } from "../core/event-bus.js";
import { appendMemory } from "../core/memory.js";
import { getPersonalityMessage } from "../knowledge/readers/assistant-personality.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";

const ROOM_HINTS = Object.freeze([
  ["living room", "living"],
  ["bedroom", "bed room"],
  ["dining room", "dining"],
  ["kitchen"],
  ["hallway", "corridor", "entry"],
  ["office", "study"],
  // Avoid bare "outdoor" — it appears in category openers ("outdoor lighting").
  ["garden", "patio", "garage", "entrance", "facade", "balcony"],
  ["صالة", "جلوس"],
  ["غرفة نوم", "نوم"],
  ["طعام"],
  ["مطبخ"],
  ["ممر", "مدخل"],
  ["مكتب"],
  ["حديقة", "كراج", "واجهة", "شرفة"],
]);

function extractRoomFromMessage(message = "") {
  const raw = String(message || "").toLowerCase();
  if (!raw) return "";
  for (const group of ROOM_HINTS) {
    const hit = group.find((hint) => raw.includes(hint));
    if (hit) return hit;
  }
  return "";
}

function pickSlot(input = {}, ctx = {}) {
  const rawArtifact =
    input.artifacts?.room ||
    input.artifacts?.slot ||
    input.artifacts?.selectedRoom ||
    input.room ||
    input.selectedRoom ||
    ctx?.metadata?.selectedRoom ||
    null;
  if (rawArtifact) {
    return String(
      typeof rawArtifact === "object"
        ? rawArtifact.name || rawArtifact.id || ""
        : rawArtifact,
    ).trim();
  }

  const message = String(input.message || "").trim();
  if (!message) return "";

  // Prefer an explicit room/space even when the customer also named the category
  // ("crystal chandelier for living room" must not re-ask for room).
  const roomFromMessage = extractRoomFromMessage(message);
  if (roomFromMessage) return roomFromMessage;

  // Canned smart-action openers include category words ("outdoor lighting",
  // "chandelier"). Those must NOT count as the room/space answer.
  if (
    /\b(chandelier|ثريا|fan|مروحة|outdoor lighting|إضاءة خارجية|i want|i'd like|أريد|ابغى|أبي)\b/i.test(
      message,
    )
  ) {
    return "";
  }

  return "";
}

/**
 * @param {object} spec
 */
export function createCategoryJourneyWorkflow(spec) {
  const {
    id,
    intents,
    description,
    clarifyMessageKey,
    category,
    keywords,
    searchPrefix,
    slotArtifactKey = "room",
  } = spec;

  return Object.freeze({
    id,
    status: WORKFLOW_STATUS.ACTIVE,
    phase: "sprint5",
    intents: Object.freeze([...(intents || [])]),
    capabilities: Object.freeze([
      "knowledge.read",
      "catalog.search",
      "memory.write",
      "memory.read",
      "ai.nlu",
    ]),
    description: description || "",

    async run(ctx, input = {}) {
      const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
      const opts = knowledgeOptsFromCtx(ctx, locale);
      const slot = pickSlot(input, ctx);

      if (!slot) {
        const question =
          (await getPersonalityMessage(clarifyMessageKey, locale, opts)) ||
          null;

        if (!question) {
          return createWorkflowResult({
            ok: true,
            workflowId: id,
            status: WORKFLOW_STATUS.ACTIVE,
            action: "placeholder",
            message: null,
            note: `${id} clarify message missing from knowledge.`,
          });
        }

        if (ctx.conversationId) {
          appendMemory(ctx.conversationId, {
            role: "assistant",
            content: question,
            workflowId: id,
            metadata: { awaitingSlot: true, slotArtifactKey },
          });
        }

        return createWorkflowResult({
          ok: true,
          workflowId: id,
          status: WORKFLOW_STATUS.ACTIVE,
          action: "clarify",
          message: question,
          data: Object.freeze({
            awaitingSlot: true,
            awaitingRoom: slotArtifactKey === "room",
            category,
            slotArtifactKey,
          }),
          note: `${id} — single clarification.`,
        });
      }

      await publish(EVENT_TYPE.WORKFLOW_DELEGATED, {
        from: id,
        to: "product_search",
        slot,
        category,
      });

      const { executeWorkflow } = await import("../core/workflow-runner.js");
      const searchMessage =
        input.searchMessage || `${searchPrefix} ${slot}`.trim();

      const search = await executeWorkflow("product_search", ctx, {
        message: searchMessage,
        query: input.query,
        artifacts: Object.freeze({
          ...(input.artifacts || {}),
          category,
          [slotArtifactKey]: slot,
          keywords: Object.freeze([
            ...(keywords || []),
            slot,
            ...((input.artifacts?.keywords || []).filter(Boolean) || []),
          ]),
          tags: Object.freeze([
            ...((input.artifacts?.tags || []).filter(Boolean) || []),
          ]),
        }),
        products: input.products,
        routedBy: id,
        skipGeneralDispatch: true,
      });

      return createWorkflowResult({
        ok: Boolean(search?.ok),
        workflowId: id,
        status: WORKFLOW_STATUS.ACTIVE,
        action: "delegate",
        message: search?.message ?? null,
        delegated: search,
        data: Object.freeze({
          [slotArtifactKey]: slot,
          category,
          search,
        }),
        note: `${id} — slot "${slot}" → product_search.`,
      });
    },
  });
}
