/**
 * AI-assisted conversation workflow.
 *
 * Primary path when ASSISTANT_FEATURE_LLM=true: OpenAI is the conversation
 * brain (intent, tools, final reply). Falls back to deterministic general_chat
 * only when the provider is unavailable.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { invokeCapability } from "../capabilities/registry.js";
import { appendMemory } from "../core/memory.js";
import { AI_CAPABILITY_KIND } from "../ai/constants.js";
import { getConversationState, setConversationState } from "../brain/state.js";
import { readMemory } from "../core/memory.js";
import { mergeConversationSlots } from "../workflows/_catalog-independent-consult.js";

async function runDeterministicFallback(ctx, input) {
  const { default: generalChat } = await import("./general-chat.js");
  return generalChat.run(ctx, {
    ...input,
    artifacts: {
      ...(input.artifacts || {}),
      aiFallback: true,
    },
  });
}

export default Object.freeze({
  id: "ai_assisted_chat",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "ai",
  intents: Object.freeze(["assistant_chat", "general", "free_chat"]),
  capabilities: Object.freeze([
    "assistant.converse",
    "knowledge.read",
    "catalog.search",
    "memory.read",
    "memory.write",
  ]),
  description:
    "Real LLM conversation via OpenAI Responses API with Knowledge/Catalog/Workflow tools.",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const history = readMemory(ctx.conversationId, {
      limit: ctx.config?.runtime?.maxHistoryMessages || 16,
    });
    const state = getConversationState(ctx.conversationId);
    const describeSlots = mergeConversationSlots(
      input.message || "",
      input.artifacts?.describeSlots || state?.context?.describeSlots || {},
    );

    // Persist known preferences so later turns never re-ask.
    if (Object.keys(describeSlots).length) {
      const prevSlots = state?.context?.describeSlots || {};
      const slotsGrew = Object.keys(describeSlots).some(
        (key) => describeSlots[key] && describeSlots[key] !== prevSlots[key],
      );
      setConversationState(ctx.conversationId, {
        ...state,
        context: {
          ...(state?.context || {}),
          conversationActive: true,
          freeChatMode: true,
          describeSlots: Object.freeze({ ...describeSlots }),
        },
      });
      if (slotsGrew) {
        appendMemory(ctx.conversationId, {
          role: "assistant",
          content: `Known preferences: ${Object.entries(describeSlots)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}`,
          type: "memory_note",
          workflowId: "ai_assisted_chat",
          metadata: Object.freeze({ describeSlots }),
        });
      }
    }

    const ai = await invokeCapability("assistant.converse", ctx, {
      kind: AI_CAPABILITY_KIND.ASSISTANT_CHAT,
      message: input.message,
      history,
      state: getConversationState(ctx.conversationId) || state,
      artifacts: Object.freeze({
        ...(input.artifacts || {}),
        describeSlots,
      }),
      locale,
      shop: ctx.shop,
      conversationId: ctx.conversationId,
    });

    const degraded =
      !ai?.ok ||
      ai?.status === "degraded" ||
      ai?.fallback?.usePatternRouter === true;

    if (degraded) {
      const fallback = await runDeterministicFallback(ctx, {
        ...input,
        artifacts: {
          ...(input.artifacts || {}),
          describeSlots,
        },
      });
      return createWorkflowResult({
        ...fallback,
        workflowId: "ai_assisted_chat",
        data: Object.freeze({
          ...(fallback.data || {}),
          aiFallback: true,
          aiStatus: ai?.status || "degraded",
          describeSlots,
        }),
        note: "AI unavailable — deterministic workflow fallback.",
      });
    }

    const message = ai.data?.message || "";
    const cards = ai.data?.cards || null;
    const actions = ai.data?.actions || null;
    const mergedSlots =
      ai.data?.describeSlots || describeSlots;

    if (Object.keys(mergedSlots || {}).length) {
      const latest = getConversationState(ctx.conversationId) || state;
      setConversationState(ctx.conversationId, {
        ...latest,
        context: {
          ...(latest?.context || {}),
          conversationActive: true,
          freeChatMode: true,
          describeSlots: Object.freeze({ ...mergedSlots }),
        },
      });
    }

    if (message) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        content: message,
        workflowId: "ai_assisted_chat",
      });
    }
    if (cards?.length) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        content: "product_cards",
        type: "product_cards",
        cards: Object.freeze([...cards]),
        workflowId: "ai_assisted_chat",
      });
    }

    return createWorkflowResult({
      ok: true,
      workflowId: "ai_assisted_chat",
      status: WORKFLOW_STATUS.ACTIVE,
      action: cards?.length ? "products_found" : "reply",
      message,
      data: Object.freeze({
        cards: cards ? Object.freeze([...cards]) : null,
        actions: actions ? Object.freeze([...actions]) : null,
        ai: true,
        toolCalls: ai.data?.toolCalls || null,
        providerId: ai.providerId || null,
        usage: ai.usage || null,
        describeSlots: Object.freeze({ ...(mergedSlots || {}) }),
      }),
      note: "AI-assisted ENARTE conversation.",
    });
  },
});
