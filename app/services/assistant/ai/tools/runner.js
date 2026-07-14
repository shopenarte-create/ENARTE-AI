/**
 * Execute ENARTE assistant tools for OpenAI Responses API function calls.
 */

import { invokeCapability } from "../../capabilities/registry.js";
import { routeIntent } from "../../core/intent-router.js";
import { executeWorkflow } from "../../core/workflow-runner.js";
import { getConversationState } from "../../brain/state.js";
import {
  getSmartAction,
  listSmartActions,
  resolveActionLabel,
} from "../../ux/smart-actions.js";
import { ASSISTANT_TOOL_NAMES } from "./definitions.js";
import { mergeConversationSlots } from "../../workflows/_catalog-independent-consult.js";
import { isProductWithinBudget } from "../../catalog/budget-constraint.js";

const ALLOWED_WORKFLOWS = new Set([
  "general_chat",
  "product_search",
  "delivery",
  "returns",
  "installation",
  "maintenance",
  "custom_chandeliers",
  "product_sourcing",
  "suggestions_feedback",
  "chandelier",
  "fan",
  "outdoor_lighting",
  "describe_looking_for",
  "product_recommendations",
  "checkout",
  "admin_notifications",
  "site_inspection",
  "image_search",
  "room_analysis",
]);

function publicState(state) {
  if (!state) return null;
  return Object.freeze({
    phase: state.phase || null,
    currentWorkflow: state.currentWorkflow || null,
    previousAction: state.previousAction || null,
    context: Object.freeze({
      conversationActive: Boolean(state.context?.conversationActive),
      freeChatMode: Boolean(state.context?.freeChatMode),
      describeSlots: state.context?.describeSlots || {},
      awaitingConsultDetail: Boolean(state.context?.awaitingConsultDetail),
      awaitingPhoto: Boolean(state.context?.awaitingPhoto),
      awaitingDescribe: Boolean(state.context?.awaitingDescribe),
    }),
    selectedProduct: state.selectedProduct
      ? Object.freeze({
          id: state.selectedProduct.id,
          title: state.selectedProduct.title,
          collection: state.selectedProduct.collection || null,
        })
      : null,
    selectedRoom: state.selectedRoom || null,
  });
}

function workflowPayload(result) {
  const cards = result?.data?.cards || result?.cards || null;
  const actions = result?.data?.actions || null;
  return Object.freeze({
    ok: Boolean(result?.ok),
    workflowId: result?.workflowId || null,
    action: result?.action || null,
    message: result?.message || null,
    cards: cards ? Object.freeze([...cards]) : null,
    actions: actions ? Object.freeze([...actions]) : null,
    mode: result?.data?.mode || null,
    note: result?.note || null,
  });
}

/**
 * @param {string} name
 * @param {object} args
 * @param {object} ctx session context
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {string} [options.fallbackMessage] latest user message
 */
export async function runAssistantTool(name, args = {}, ctx = {}, options = {}) {
  const locale = options.locale || ctx?.locale || "ar";

  switch (name) {
    case ASSISTANT_TOOL_NAMES.READ_KNOWLEDGE: {
      const result = await invokeCapability("knowledge.read", ctx, {
        moduleId: args.moduleId,
        module: args.moduleId,
        key: args.key,
        query: args.query,
      });
      const record = result?.record || null;
      return Object.freeze({
        ok: Boolean(result?.ok),
        moduleId: args.moduleId,
        content: record?.data?.content || record?.content || null,
        status: record?.status || null,
      });
    }

    case ASSISTANT_TOOL_NAMES.SEARCH_CATALOG: {
      const searchMessage = args.message || options.fallbackMessage || "";
      const state = ctx?.conversationId
        ? getConversationState(ctx.conversationId)
        : null;
      const describeSlots = mergeConversationSlots(
        searchMessage,
        state?.context?.describeSlots || {},
      );
      const result = await invokeCapability("catalog.search", ctx, {
        shop: ctx?.shop || null,
        locale,
        message: searchMessage,
        query: args.query,
        artifacts: Object.freeze({
          category: args.category || null,
          keywords: args.keywords ? Object.freeze([...args.keywords]) : null,
          describeSlots,
          maxPrice: describeSlots.maxPrice || null,
          budgetMode: describeSlots.budgetMode || null,
        }),
      });
      const budget = describeSlots.maxPrice
        ? {
            max: Number.parseFloat(String(describeSlots.maxPrice)),
            mode: describeSlots.budgetMode === "approx" ? "approx" : "hard",
          }
        : null;
      const cards = result?.cards
        ? Object.freeze(
            result.cards
              .filter((card) =>
                isProductWithinBudget(
                  {
                    price: card.price,
                    priceAmount: Number.parseFloat(String(card.price || "")),
                  },
                  budget,
                ),
              )
              .map((card, index) =>
                Object.freeze({
                  id: card.id,
                  title: card.title,
                  price: card.price,
                  currency: card.currency,
                  url: card.url,
                  collection: card.collection,
                  rank: index + 1,
                  matchType: card.matchType || null,
                  matchReason: card.matchReason || null,
                  image: card.image || null,
                }),
              ),
          )
        : null;
      return Object.freeze({
        ok: Boolean(result?.ok),
        mode: result?.mode || null,
        count: result?.count ?? (cards?.length || 0),
        cards,
        rankedBestFirst: true,
        shop: result?.shop || ctx?.shop || null,
        source: result?.source || null,
        error: result?.error || null,
        budgetApplied: budget?.max ?? null,
        note:
          result?.error === "catalog_load_failed"
            ? "Catalog temporarily unavailable — do NOT say you have no access forever. Ask the customer to retry in a moment, or continue collecting room/style details."
            : result?.note ||
              (cards?.length
                ? budget?.max
                  ? `Cards are ranked best → least and filtered to budget ≤ ${budget.max} JOD. Pitch why #1 fits using matchReason.`
                  : "Cards are ranked best → least. Pitch why #1 fits using matchReason."
                : budget?.max
                  ? `No ENARTE products found within budget ≤ ${budget.max} JOD. Say so briefly and offer to adjust budget or style — do NOT invent cheaper items.`
                  : null),
      });
    }

    case ASSISTANT_TOOL_NAMES.RECOMMEND_PRODUCTS: {
      const result = await invokeCapability("catalog.recommend", ctx, {
        shop: ctx?.shop || null,
        message: args.message || options.fallbackMessage,
        selectedProduct: args.seedProductId
          ? { id: args.seedProductId }
          : ctx?.selectedProduct || null,
        room: args.room || ctx?.selectedRoom?.name || null,
        category: args.category,
      });
      return Object.freeze({
        ok: Boolean(result?.ok),
        count: result?.count ?? (result?.cards?.length || 0),
        cards: result?.cards ? Object.freeze([...result.cards]) : null,
        shop: result?.shop || ctx?.shop || null,
        note: result?.note || null,
      });
    }

    case ASSISTANT_TOOL_NAMES.ROUTE_INTENT: {
      const route = routeIntent({
        message: args.message || options.fallbackMessage,
        intent: args.intent,
        catalog: ctx?.config?.intentCatalog,
      });
      return Object.freeze({
        ok: true,
        decision: route.decision,
        intent: route.intent,
        workflowId: route.workflowId,
        confidence: route.confidence,
        strategy: route.strategy,
      });
    }

    case ASSISTANT_TOOL_NAMES.RUN_WORKFLOW: {
      const workflowId = String(args.workflowId || "");
      if (!ALLOWED_WORKFLOWS.has(workflowId)) {
        return Object.freeze({
          ok: false,
          error: "workflow_not_allowed",
          workflowId,
        });
      }
      const result = await executeWorkflow(workflowId, ctx, {
        message: args.message || options.fallbackMessage,
        intent: args.intent,
        artifacts: args.artifacts || {},
        skipGeneralDispatch: true,
      });
      return workflowPayload(result);
    }

    case ASSISTANT_TOOL_NAMES.LIST_SMART_ACTIONS: {
      const actions = listSmartActions({
        welcomeOnly: Boolean(args.welcomeOnly),
      }).map((action) => {
        const full = getSmartAction(action.id);
        return Object.freeze({
          id: action.id,
          label: resolveActionLabel(full, locale),
          workflowId: action.workflowId,
        });
      });
      return Object.freeze({
        ok: true,
        actions: Object.freeze(actions),
        count: actions.length,
      });
    }

    case ASSISTANT_TOOL_NAMES.GET_CONVERSATION_STATE: {
      const state = getConversationState(ctx?.conversationId);
      return Object.freeze({
        ok: Boolean(ctx?.conversationId),
        state: publicState(state),
      });
    }

    default:
      return Object.freeze({
        ok: false,
        error: "unknown_tool",
        name,
      });
  }
}
