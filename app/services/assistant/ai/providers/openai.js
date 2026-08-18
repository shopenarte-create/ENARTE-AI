/**
 * OpenAI provider — Responses API for ENARTE assistant conversations.
 */

import {
  AI_CAPABILITY_KIND,
  AI_PROVIDER_ID,
  AI_PROVIDER_STATUS,
  AI_REQUEST_STATUS,
} from "../constants.js";
import { createAiResult } from "../contracts.js";
import { defineAiProvider } from "./types.js";
import { runAssistantResponsesConversation } from "../../openai-responses.server.js";
import { ASSISTANT_RESPONSES_TOOLS } from "../tools/definitions.js";
import { buildAiConstitution } from "../prompts/constitution.js";
import {
  buildConversationInstructions,
  looksLikeProductQuestion,
  mergeConversationSlots,
} from "../conversation.js";
import { readMemory } from "../../core/memory.js";
import { getConversationState } from "../../brain/state.js";
import { getAssistantConfig } from "../../config/index.js";
import { filterEnarteCatalogCards } from "../../core/domain-scope.js";

function hasApiKey() {
  return Boolean(String(process.env.OPENAI_API_KEY || "").trim());
}

function historyEntryContent(entry) {
  const role = entry.role === "assistant" ? "assistant" : "user";
  const raw = String(entry.content || "").trim();
  if (raw && raw !== "product_cards") {
    return { role, content: raw };
  }
  if (entry.type === "product_cards" || Array.isArray(entry.cards)) {
    const cards = entry.cards || entry.metadata?.cards || [];
    const titles = cards
      .slice(0, 5)
      .map((c) => c.title || c.id)
      .filter(Boolean);
    if (titles.length) {
      return {
        role: "assistant",
        content: `Shown ENARTE products: ${titles.join("; ")}`,
      };
    }
  }
  if (raw) return { role, content: raw };
  return null;
}

function buildResponsesInput(history = [], message = "") {
  const items = [];
  for (const entry of history) {
    const mapped = historyEntryContent(entry);
    if (mapped) items.push(mapped);
  }
  const latest = String(message || "").trim();
  const last = items[items.length - 1];
  if (!last || last.role !== "user" || last.content !== latest) {
    if (latest) items.push({ role: "user", content: latest });
  }
  return items;
}

/**
 * @param {object} [options]
 * @param {boolean} [options.enabled]
 */
export function createOpenAiProvider(options = {}) {
  const enabled = options.enabled !== false && hasApiKey();

  return defineAiProvider({
    id: AI_PROVIDER_ID.OPENAI,
    status: enabled ? AI_PROVIDER_STATUS.READY : AI_PROVIDER_STATUS.DISABLED,
    description:
      "OpenAI Responses API provider for ENARTE assistant conversations with tool calling.",
    supports: Object.freeze([
      AI_CAPABILITY_KIND.ASSISTANT_CHAT,
      AI_CAPABILITY_KIND.NLU,
      AI_CAPABILITY_KIND.INTENT_CLASSIFICATION,
      AI_CAPABILITY_KIND.ENTITY_EXTRACTION,
      AI_CAPABILITY_KIND.RESPONSE_REWRITING,
      AI_CAPABILITY_KIND.STRUCTURED_JSON,
    ]),
    isAvailable: () => enabled && hasApiKey(),
    async invoke(request, invokeOptions = {}) {
      if (!enabled || !hasApiKey()) {
        return createAiResult({
          ok: false,
          status: AI_REQUEST_STATUS.UNAVAILABLE,
          kind: request?.kind,
          providerId: AI_PROVIDER_ID.OPENAI,
          error: "openai_unavailable",
          note: "OpenAI provider disabled or OPENAI_API_KEY missing.",
        });
      }

      if (request?.kind !== AI_CAPABILITY_KIND.ASSISTANT_CHAT) {
        return createAiResult({
          ok: false,
          status: AI_REQUEST_STATUS.NOT_IMPLEMENTED,
          kind: request?.kind,
          providerId: AI_PROVIDER_ID.OPENAI,
          error: "openai_kind_not_implemented",
          note: `OpenAI provider only implements ${AI_CAPABILITY_KIND.ASSISTANT_CHAT} in this milestone.`,
        });
      }

      const started = Date.now();
      const input = request.input || {};
      const locale = request.locale || input.locale || "ar";
      const config = getAssistantConfig();
      const model =
        invokeOptions.model ||
        config.ai?.model ||
        process.env.ASSISTANT_MODEL ||
        "gpt-4.1";

      try {
        const state =
          input.state || getConversationState(request.conversationId);
        const knownSlots = mergeConversationSlots(
          input.message || "",
          input.artifacts?.describeSlots ||
            state?.context?.describeSlots ||
            {},
        );
        const history = Array.isArray(input.history)
          ? input.history
          : readMemory(request.conversationId, {
              limit: config.runtime?.maxHistoryMessages || 16,
            });
        const memoryNotes = history
          .filter((entry) => entry?.role === "user")
          .map((entry) => String(entry.content || "").trim())
          .filter((text) => text && text !== "product_cards")
          .slice(-6);
        if (state?.selectedRoom?.name) {
          memoryNotes.push(`room: ${state.selectedRoom.name}`);
        }
        const constitution = await buildAiConstitution({
          locale,
          manager: input.knowledgeManager,
          refresh: true,
        });
        const instructions = buildConversationInstructions(
          constitution.systemText,
          locale,
          {
            knownSlots,
            selectedProduct: state?.selectedProduct || null,
            memoryNotes,
            suggestedWorkflowId:
              input.artifacts?.suggestedWorkflowId ||
              input.artifacts?.suggestedKnowledgeModule ||
              null,
            outOfDomainMessage: constitution.charter?.outOfDomainMessage || null,
          },
        );
        const toolCtx = Object.freeze({
          conversationId: request.conversationId,
          shop: request.shop || input.shop || null,
          locale,
          config,
          knowledge: input.knowledge,
          selectedProduct: state?.selectedProduct || null,
          selectedRoom: state?.selectedRoom || null,
        });

        const requireCatalogSearch = looksLikeProductQuestion(
          input.message || "",
          knownSlots,
        );

        const result = await runAssistantResponsesConversation({
          model,
          instructions,
          input: buildResponsesInput(history, input.message),
          tools: [...ASSISTANT_RESPONSES_TOOLS],
          locale,
          requireCatalogSearch: requireCatalogSearch || Boolean(knownSlots.productType),
          catalogSearchMessage: input.message,
          temperature: 0.3,
          maxToolRounds: config.runtime?.maxToolRounds ?? 4,
          async runTool(name, args) {
            const { runAssistantTool } = await import("../tools/runner.js");
            return runAssistantTool(name, args, toolCtx, {
              locale,
              fallbackMessage: input.message,
            });
          },
        });

        return createAiResult({
          ok: true,
          status: AI_REQUEST_STATUS.SUCCESS,
          kind: request.kind,
          providerId: AI_PROVIDER_ID.OPENAI,
          data: Object.freeze({
            message: result.message,
            cards: filterEnarteCatalogCards(result.cards),
            actions: result.actions,
            toolCalls: result.toolCalls,
            model: result.model,
            describeSlots: Object.freeze({ ...knownSlots }),
          }),
          usage: {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          },
          cost: {
            currency: "USD",
            amount: null,
            model: result.model,
          },
          durationMs: Date.now() - started,
          note: "OpenAI Responses API conversation with tool loop.",
        });
      } catch (error) {
        return createAiResult({
          ok: false,
          status: AI_REQUEST_STATUS.PROVIDER_ERROR,
          kind: request.kind,
          providerId: AI_PROVIDER_ID.OPENAI,
          error: error?.message || "openai_provider_error",
          durationMs: Date.now() - started,
          note: "OpenAI Responses API call failed.",
        });
      }
    },
  });
}
