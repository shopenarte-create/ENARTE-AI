/**
 * AI conversation integration tests (mocked — no live OpenAI calls).
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  decide,
  createConversationState,
  resetConversationState,
} from "./brain/index.js";
import {
  isAiConversationReady,
  shouldRouteFreeTextToAi,
  shouldRouteSmartActionToAi,
} from "./ai/conversation.js";
import { getSmartAction } from "./ux/smart-actions.js";
import { resetAssistantConfigCache } from "./index.js";
import { startChatSession, sendChatMessage, resetChatSessions } from "./ux/chat-api.js";
import { resetAiProviders } from "./ai/providers/registry.js";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_LLM = process.env.ASSISTANT_FEATURE_LLM;

describe("AI conversation routing", () => {
  beforeEach(() => {
    resetAssistantConfigCache();
    resetConversationState();
    resetChatSessions();
    resetAiProviders();
    process.env.ASSISTANT_FEATURE_LLM = "false";
    delete process.env.OPENAI_API_KEY;
    resetAssistantConfigCache();
  });

  afterEach(() => {
    process.env.ASSISTANT_FEATURE_LLM = ORIGINAL_LLM;
    if (ORIGINAL_KEY) process.env.OPENAI_API_KEY = ORIGINAL_KEY;
    else delete process.env.OPENAI_API_KEY;
    resetAssistantConfigCache();
    resetAiProviders();
  });

  it("shouldRouteFreeTextToAi excludes smart actions and photos", () => {
    assert.equal(shouldRouteFreeTextToAi({ message: "hello" }), true);
    assert.equal(
      shouldRouteFreeTextToAi({ message: "hello", actionId: "delivery" }),
      false,
    );
    assert.equal(
      shouldRouteFreeTextToAi({ message: "hello", image: { url: "x" } }),
      false,
    );
  });

  it("shouldRouteSmartActionToAi keeps photos/forms on DE; services to AI", () => {
    assert.equal(
      shouldRouteSmartActionToAi(getSmartAction("delivery")),
      true,
    );
    assert.equal(
      shouldRouteSmartActionToAi(getSmartAction("chandeliers")),
      true,
    );
    assert.equal(
      shouldRouteSmartActionToAi(getSmartAction("search_by_image")),
      false,
    );
    assert.equal(
      shouldRouteSmartActionToAi(getSmartAction("describe_looking_for")),
      false,
    );
    assert.equal(
      shouldRouteSmartActionToAi(getSmartAction("checkout")),
      false,
    );
  });

  it("isAiConversationReady requires API key and respects explicit LLM off", () => {
    assert.equal(isAiConversationReady(), false);
    delete process.env.ASSISTANT_FEATURE_LLM;
    process.env.OPENAI_API_KEY = "test-key";
    resetAssistantConfigCache();
    resetAiProviders();
    assert.equal(isAiConversationReady(), true);
    process.env.ASSISTANT_FEATURE_LLM = "false";
    resetAssistantConfigCache();
    assert.equal(isAiConversationReady(), false);
  });

  it("routes free-text to ai_assisted_chat when AI is ready", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ASSISTANT_FEATURE_LLM = "true";
    resetAssistantConfigCache();
    resetAiProviders();

    const state = createConversationState("conv_ai_route_test", {
      phase: "welcome",
      context: { conversationActive: true, freeChatMode: true },
    });

    const decision = decide({
      conversationId: "conv_ai_route_test",
      state,
      message: "I need a modern chandelier for my dining room",
      locale: "en",
    });

    assert.equal(decision.workflowId, "ai_assisted_chat");
    assert.equal(decision.skipGeneralDispatch, true);
    assert.equal(decision.showSmartButtons, false);
  });

  it("routes delivery/policy free-text to OpenAI when AI is ready (not Knowledge-only override)", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ASSISTANT_FEATURE_LLM = "true";
    resetAssistantConfigCache();
    resetAiProviders();

    const state = createConversationState("conv_ai_delivery", {
      phase: "welcome",
      context: { conversationActive: true, freeChatMode: true },
    });

    const decision = decide({
      conversationId: "conv_ai_delivery",
      state,
      message: "How does delivery work?",
      locale: "en",
    });

    assert.equal(decision.workflowId, "ai_assisted_chat");
    assert.equal(
      decision.artifacts?.suggestedWorkflowId ||
        decision.artifacts?.suggestedKnowledgeModule,
      "delivery",
    );
  });

  it("routes conversational smart-action buttons to OpenAI when AI is ready", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ASSISTANT_FEATURE_LLM = "true";
    resetAssistantConfigCache();
    resetAiProviders();

    const state = createConversationState("conv_ai_smart_delivery", {
      phase: "welcome",
      context: { conversationActive: false },
    });

    const decision = decide({
      conversationId: "conv_ai_smart_delivery",
      state,
      actionId: "delivery",
      locale: "en",
    });

    assert.equal(decision.workflowId, "ai_assisted_chat");
    assert.equal(decision.artifacts?.suggestedWorkflowId, "delivery");
    assert.equal(decision.artifacts?.smartActionId, "delivery");
  });

  it("keeps photo smart actions on deterministic workflows even when AI is ready", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ASSISTANT_FEATURE_LLM = "true";
    resetAssistantConfigCache();
    resetAiProviders();

    const state = createConversationState("conv_ai_photo", {
      phase: "welcome",
      context: {},
    });

    const decision = decide({
      conversationId: "conv_ai_photo",
      state,
      actionId: "search_by_image",
      locale: "en",
    });

    assert.equal(decision.workflowId, "image_search");
  });

  it("hard-blocks clear out-of-domain free-text even when AI is ready", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ASSISTANT_FEATURE_LLM = "true";
    resetAssistantConfigCache();
    resetAiProviders();

    const state = createConversationState("conv_ai_ood", {
      phase: "general",
      context: {
        conversationActive: true,
        freeChatMode: true,
        describeSlots: { productType: "chandelier", room: "living" },
      },
    });

    const decision = decide({
      conversationId: "conv_ai_ood",
      state,
      message: "شو طقس عمان اليوم؟",
      locale: "ar",
    });

    assert.equal(decision.outOfDomain, true);
    assert.equal(decision.workflowId, "general_chat");
    assert.equal(decision.artifacts?.forceOutOfDomain, true);
    assert.notEqual(decision.workflowId, "ai_assisted_chat");
  });

  it("keeps deterministic routing when LLM is disabled", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      message: "How does delivery work?",
      locale: "en",
    });
    assert.equal(result.decision.workflowId, "delivery");
  });
});
