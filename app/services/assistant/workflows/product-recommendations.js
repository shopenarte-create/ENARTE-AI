/**
 * Product Recommendations Workflow — Sprint 7 V1.
 *
 * Uses ENARTE catalog (via catalog.recommend) + Knowledge copy.
 * No vision / room photo analysis. No OpenAI.
 * AI Adapter is probed by the workflow runner (interface only).
 */

import { WORKFLOW_STATUS, EVENT_TYPE } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { invokeCapability } from "../capabilities/registry.js";
import { readMemory, appendMemory } from "../core/memory.js";
import { publish } from "../core/event-bus.js";
import { getPersonalityMessage } from "../knowledge/readers/assistant-personality.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";

function resolveSelectedProduct(ctx, input = {}) {
  if (input.selectedProduct?.id) return input.selectedProduct;
  if (ctx?.metadata?.selectedProduct?.id) return ctx.metadata.selectedProduct;

  const memory = ctx.conversationId
    ? readMemory(ctx.conversationId, { limit: 40 })
    : [];
  for (let i = memory.length - 1; i >= 0; i -= 1) {
    const entry = memory[i];
    if (entry?.metadata?.selectedProduct?.id) {
      return entry.metadata.selectedProduct;
    }
    if (entry?.metadata?.cards?.[0]?.id) {
      return {
        id: entry.metadata.cards[0].id,
        title: entry.metadata.cards[0].title,
        url: entry.metadata.cards[0].url,
        tags: entry.metadata.cards[0].tags,
        collection: entry.metadata.cards[0].collection,
      };
    }
  }
  return null;
}

function resolveSelectedRoom(ctx, input = {}) {
  const raw =
    input.selectedRoom ||
    input.artifacts?.room ||
    ctx?.metadata?.selectedRoom ||
    null;
  if (!raw) return null;
  if (typeof raw === "object") {
    return { name: String(raw.name || raw.id || "").trim() || null };
  }
  return { name: String(raw).trim() || null };
}

export default Object.freeze({
  id: "product_recommendations",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint7",
  intents: Object.freeze([
    "recommend_products",
    "similar_products",
    "product_recommendations",
  ]),
  capabilities: Object.freeze([
    "catalog.recommend",
    "knowledge.read",
    "memory.read",
    "memory.write",
    "ai.nlu",
  ]),
  description:
    "Recommend similar ENARTE catalog products from selection / room context (no vision).",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const opts = knowledgeOptsFromCtx(ctx, locale);
    const selectedProduct = resolveSelectedProduct(ctx, input);
    const selectedRoom = resolveSelectedRoom(ctx, input);

    const recommend = await invokeCapability("catalog.recommend", ctx, {
      shop: ctx.shop || input.shop,
      message: input.message,
      selectedProduct,
      selectedRoom,
      artifacts: input.artifacts || {},
      products: input.products,
      category: input.artifacts?.category || selectedProduct?.collection || null,
    });

    if (!recommend.ok && recommend.error === "shopify_tools_disabled") {
      return createWorkflowResult({
        ok: false,
        workflowId: "product_recommendations",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "error",
        message: null,
        data: { recommend },
        note: recommend.note,
      });
    }

    const intro =
      (await getPersonalityMessage("recommendationsIntro", locale, opts)) ||
      (await getPersonalityMessage("similarProductsIntro", locale, opts)) ||
      null;

    if (
      recommend.ok &&
      Array.isArray(recommend.cards) &&
      recommend.cards.length > 0
    ) {
      if (ctx.conversationId) {
        appendMemory(ctx.conversationId, {
          role: "assistant",
          workflowId: "product_recommendations",
          content: intro || "recommendations",
          metadata: {
            cards: recommend.cards,
            selectedProduct,
            selectedRoom,
          },
        });
      }

      return createWorkflowResult({
        ok: true,
        workflowId: "product_recommendations",
        status: WORKFLOW_STATUS.ACTIVE,
        action:
          recommend.mode === "similar" ? "similar_products" : "products_found",
        message: intro,
        data: Object.freeze({
          mode: recommend.mode,
          cards: recommend.cards,
          count: recommend.count,
          selectedProduct,
          selectedRoom,
          query: recommend.query,
          shop: recommend.shop,
          source: recommend.source,
          aiSignal: ctx.metadata?.aiSignal || null,
        }),
        note: "ENARTE catalog recommendations (no vision).",
      });
    }

    await publish(EVENT_TYPE.WORKFLOW_DELEGATED, {
      from: "product_recommendations",
      to: "product_sourcing",
      reason: "no_recommendation_match",
    });

    const { executeWorkflow } = await import("../core/workflow-runner.js");
    const sourcing = await executeWorkflow("product_sourcing", ctx, {
      message: input.message,
      query: recommend.query,
      artifacts: input.artifacts || {},
      reason: "no_recommendation_match",
      routedBy: "product_recommendations",
      skipGeneralDispatch: true,
    });

    return createWorkflowResult({
      ok: Boolean(sourcing?.ok),
      workflowId: "product_recommendations",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "sourcing_triggered",
      message: sourcing?.message ?? null,
      delegated: sourcing,
      data: Object.freeze({
        mode: "none",
        cards: Object.freeze([]),
        count: 0,
        selectedProduct,
        selectedRoom,
        sourcing,
      }),
      note: "No recommendable ENARTE products — sourcing queued.",
    });
  },
});
