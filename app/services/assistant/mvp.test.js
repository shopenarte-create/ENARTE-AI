/**
 * Sprint 4 MVP — end-to-end working workflows (no OpenAI).
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  startChatSession,
  sendChatMessage,
  resetChatSessions,
} from "./ux/index.js";
import { resetConversationState } from "./brain/index.js";
import { resetAssistantConfigCache } from "./config/index.js";
import { resetMemoryStore } from "./core/memory.js";
import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
} from "./knowledge/index.js";
import { getAssistantFoundationStatus } from "./index.js";

describe("Sprint 4 MVP functional assistant", () => {
  beforeEach(() => {
    resetChatSessions();
    resetMemoryStore();
    resetConversationState();
    resetAssistantConfigCache();
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    process.env.ASSISTANT_FEATURE_LLM = "false";
    process.env.ASSISTANT_FEATURE_IMAGE_TOOLS = "false";
    process.env.ASSISTANT_FEATURE_WORKFLOW_ENGINE = "true";
    process.env.ASSISTANT_FEATURE_SHOPIFY_TOOLS = "true";
    resetAssistantConfigCache();
  });

  it("reports MVP phase with LLM and image tools off", () => {
    const status = getAssistantFoundationStatus();
    assert.match(String(status.phase), /sprint9\.ai_conversation|sprint8\.prompt_system|sprint7\.complete_v1|sprint6\.ai_architecture|sprint5\.v1|sprint4\.mvp/i);
    assert.equal(status.architecture?.aiResponses, false);
  });

  it("feedback journey: prompt then acknowledge from Knowledge", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });

    const prompt = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "suggestions_feedback",
      locale: "en",
    });
    assert.match(prompt.messages[0].content, /Share your suggestion/i);

    const ack = await sendChatMessage({
      sessionId: started.session.id,
      message: "Please add more outdoor sconces.",
      locale: "en",
    });
    assert.match(ack.messages[0].content, /Thank you for your feedback/i);
  });

  it("free text delivery intent returns Knowledge delivery reply", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      message: "Tell me about delivery",
      locale: "en",
    });
    assert.equal(result.decision.workflowId, "delivery");
    assert.match(result.messages[0].content, /Amman/i);
  });
});
