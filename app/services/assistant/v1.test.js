/**
 * Sprint 5 — ENARTE AI Assistant V1 (pre-AI) coverage tests.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { routeIntent } from "./core/intent-router.js";
import { listWorkflows } from "./workflows/registry.js";
import {
  startChatSession,
  sendChatMessage,
  getChatSession,
  resetChatSessions,
} from "./ux/index.js";
import { resetConversationState, CONVERSATION_PHASE } from "./brain/index.js";
import { resetAssistantConfigCache } from "./config/index.js";
import { resetMemoryStore } from "./core/memory.js";
import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
} from "./knowledge/index.js";
import { getAssistantFoundationStatus } from "./index.js";
import { validateMessagePayload } from "./utils/validation.js";

const FAN_CATALOG = [
  {
    id: "gid://shopify/Product/f1",
    title: "Ceiling Fan Breeze",
    price: "120.00",
    currency: "JOD",
    image: null,
    url: "https://demo.myshopify.com/products/breeze",
    collection: "FANS",
    tags: ["fan", "ceiling"],
    productType: "Fan",
    categoryName: "Fans",
  },
];

describe("Sprint 5 V1 assistant", () => {
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

  it("reports V1 phase with AI and image tools off", () => {
    const status = getAssistantFoundationStatus();
    assert.match(String(status.phase), /sprint9\.ai_conversation|sprint8\.prompt_system|sprint7\.complete_v1|sprint6\.ai_architecture|sprint5\.v1/i);
    assert.equal(status.architecture.aiResponses, false);
    assert.equal(status.runtime.enableLlm, false);
  });

  it("registers all V1 journey workflows as active", () => {
    const byId = Object.fromEntries(listWorkflows().map((w) => [w.id, w]));
    for (const id of [
      "product_search",
      "chandelier",
      "fan",
      "outdoor_lighting",
      "delivery",
      "installation",
      "maintenance",
      "site_inspection",
      "product_sourcing",
      "suggestions_feedback",
    ]) {
      assert.ok(byId[id], `missing workflow ${id}`);
      assert.equal(byId[id].status, "active");
    }
  });

  it("routes fan / outdoor / site inspection intents", () => {
    assert.equal(routeIntent({ message: "I want a fan" }).workflowId, "fan");
    assert.equal(
      routeIntent({ message: "outdoor lighting" }).workflowId,
      "outdoor_lighting",
    );
    assert.equal(
      routeIntent({ message: "site inspection" }).workflowId,
      "site_inspection",
    );
  });

  it("fan journey clarifies once then returns ranked products", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const clarify = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "fans",
      locale: "en",
    });
    assert.equal(clarify.decision.workflowId, "fan");
    assert.match(clarify.messages[0].content, /Which room is the fan for/i);

    const found = await sendChatMessage({
      sessionId: started.session.id,
      message: "bedroom",
      products: FAN_CATALOG,
      locale: "en",
    });
    assert.equal(found.state.phase, CONVERSATION_PHASE.PRODUCT_FOUND);
    assert.ok(found.messages.some((m) => m.type === "product_cards"));
    assert.equal(found.state.selectedRoom?.name, "bedroom");
  });

  it("outdoor lighting journey clarifies then returns products", async () => {
    const outdoorCatalog = [
      {
        id: "gid://shopify/Product/o1",
        title: "Garden Wall Light",
        price: "85.00",
        currency: "JOD",
        image: null,
        url: "https://demo.myshopify.com/products/garden-wall",
        collection: "OUTDOOR",
        tags: ["outdoor", "wall"],
        productType: "Outdoor Lighting",
        categoryName: "Outdoor",
      },
    ];
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const clarify = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "outdoor_lighting",
      locale: "en",
    });
    assert.equal(clarify.decision.workflowId, "outdoor_lighting");
    assert.match(clarify.messages[0].content, /space|outdoor|Where/i);

    const found = await sendChatMessage({
      sessionId: started.session.id,
      message: "garden",
      products: outdoorCatalog,
      locale: "en",
    });
    assert.equal(found.state.phase, CONVERSATION_PHASE.PRODUCT_FOUND);
    assert.ok(found.messages.some((m) => m.type === "product_cards"));
    assert.equal(found.state.selectedRoom?.name, "garden");
  });

  it("site inspection returns Knowledge offering", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "site_inspection",
      locale: "en",
    });
    assert.equal(result.decision.workflowId, "site_inspection");
    assert.match(result.messages[0].content, /00962782404023|\+962782404023/);
    assert.match(result.messages[0].content, /Site inspection/i);
  });

  it("exposes conversation history on session get", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    await sendChatMessage({
      sessionId: started.session.id,
      actionId: "delivery",
      locale: "en",
    });
    const loaded = await getChatSession(started.session.id);
    assert.equal(loaded.ok, true);
    assert.ok(loaded.history.length >= 3);
    assert.equal(loaded.session.currentWorkflow, "delivery");
  });

  it("validates message payloads", () => {
    assert.equal(validateMessagePayload({}).ok, false);
    assert.equal(
      validateMessagePayload({ sessionId: "x", message: "hi" }).ok,
      true,
    );
  });
});
