/**
 * Assistant tool runner tests (no live OpenAI / Shopify).
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { runAssistantTool } from "./ai/tools/runner.js";
import { ASSISTANT_TOOL_NAMES } from "./ai/tools/definitions.js";
import { resetAssistantConfigCache } from "./index.js";
import { bootstrapKnowledgeEngine, ensureKnowledgeReady } from "./knowledge/index.js";
import { resetConversationState, createConversationState } from "./brain/index.js";

describe("assistant tool runner", () => {
  beforeEach(async () => {
    process.env.ASSISTANT_FEATURE_LLM = "false";
    process.env.ASSISTANT_FEATURE_SHOPIFY_TOOLS = "false";
    delete process.env.OPENAI_API_KEY;
    resetAssistantConfigCache();
    resetConversationState();
    bootstrapKnowledgeEngine();
    await ensureKnowledgeReady();
  });

  afterEach(() => {
    resetAssistantConfigCache();
    resetConversationState();
  });

  it("rejects unknown tools", async () => {
    const result = await runAssistantTool("not_a_real_tool", {}, {
      locale: "en",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "unknown_tool");
  });

  it("read_knowledge returns published delivery content", async () => {
    const result = await runAssistantTool(
      ASSISTANT_TOOL_NAMES.READ_KNOWLEDGE,
      { moduleId: "delivery" },
      { locale: "en" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.moduleId, "delivery");
    assert.ok(result.content);
  });

  it("list_smart_actions returns welcome actions when requested", async () => {
    const result = await runAssistantTool(
      ASSISTANT_TOOL_NAMES.LIST_SMART_ACTIONS,
      { welcomeOnly: true },
      { locale: "en" },
    );
    assert.equal(result.ok, true);
    assert.ok(result.count >= 4);
    const ids = result.actions.map((a) => a.id);
    assert.ok(ids.includes("search_by_image"));
    assert.ok(ids.includes("talk_to_assistant"));
  });

  it("get_conversation_state returns public session context", async () => {
    createConversationState("tool_state_conv", {
      phase: "welcome",
      context: {
        conversationActive: true,
        freeChatMode: true,
        describeSlots: { room: "living" },
      },
    });
    const result = await runAssistantTool(
      ASSISTANT_TOOL_NAMES.GET_CONVERSATION_STATE,
      {},
      { conversationId: "tool_state_conv", locale: "en" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.state.context.freeChatMode, true);
    assert.equal(result.state.context.describeSlots.room, "living");
  });

  it("run_workflow blocks disallowed workflow ids", async () => {
    const result = await runAssistantTool(
      ASSISTANT_TOOL_NAMES.RUN_WORKFLOW,
      { workflowId: "virtual_placement" },
      { locale: "en", conversationId: "tool_block_conv" },
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, "workflow_not_allowed");
  });

  it("run_workflow executes allowed delivery workflow", async () => {
    createConversationState("tool_delivery_conv", { phase: "welcome" });
    const result = await runAssistantTool(
      ASSISTANT_TOOL_NAMES.RUN_WORKFLOW,
      { workflowId: "delivery", message: "delivery?" },
      {
        locale: "en",
        conversationId: "tool_delivery_conv",
        config: { runtime: { defaultLocale: "en" } },
      },
    );
    assert.equal(result.ok, true);
    assert.equal(result.workflowId, "delivery");
    assert.match(String(result.message || ""), /6–8 hours|6-8 hours|Amman/i);
  });

  it("route_intent returns a structured router decision", async () => {
    const result = await runAssistantTool(
      ASSISTANT_TOOL_NAMES.ROUTE_INTENT,
      { message: "I need delivery information" },
      { locale: "en" },
    );
    assert.equal(result.ok, true);
    assert.ok(result.decision);
    assert.ok(result.workflowId === "delivery" || result.intent);
  });
});
