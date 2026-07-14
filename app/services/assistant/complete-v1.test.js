/**
 * Sprint 7 — Complete ENARTE AI Assistant V1 tests.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  startChatSession,
  sendChatMessage,
  resetChatSessions,
} from "./ux/index.js";
import { resetConversationState, CONVERSATION_PHASE } from "./brain/index.js";
import { resetAssistantConfigCache } from "./config/index.js";
import { resetMemoryStore, readMemory } from "./core/memory.js";
import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
} from "./knowledge/index.js";
import { getAssistantFoundationStatus, listWorkflows } from "./index.js";
import { invokeCapability } from "./capabilities/registry.js";
import { executeWorkflow } from "./core/workflow-runner.js";
import { createKnowledgeClient } from "./knowledge/index.js";

const CATALOG = [
  {
    id: "gid://shopify/Product/c1",
    title: "Crystal Chandelier Nova",
    price: "450.00",
    currency: "JOD",
    image: null,
    url: "https://demo.myshopify.com/products/nova",
    collection: "CHANDELIERS",
    tags: ["chandelier", "crystal"],
    productType: "Chandelier",
    categoryName: "Chandeliers",
  },
  {
    id: "gid://shopify/Product/c2",
    title: "Modern Chandelier Arc",
    price: "390.00",
    currency: "JOD",
    image: null,
    url: "https://demo.myshopify.com/products/arc",
    collection: "CHANDELIERS",
    tags: ["chandelier", "modern"],
    productType: "Chandelier",
    categoryName: "Chandeliers",
  },
];

describe("Sprint 7 complete V1", () => {
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

  it("reports complete V1 phase with OpenAI still off", () => {
    const status = getAssistantFoundationStatus();
    assert.match(String(status.phase), /sprint9\.ai_conversation|sprint8\.prompt_system|sprint7\.complete_v1/i);
    assert.equal(status.architecture.aiResponses, false);
    assert.equal(status.architecture.llmEnabled, false);
    assert.equal(status.architecture.completeV1, true);
    assert.equal(status.runtime.enableLlm, false);
  });

  it("registers all V1 customer workflows as active", () => {
    const byId = Object.fromEntries(listWorkflows().map((w) => [w.id, w]));
    for (const id of [
      "product_search",
      "product_recommendations",
      "chandelier",
      "fan",
      "outdoor_lighting",
      "delivery",
      "installation",
      "maintenance",
      "site_inspection",
      "product_sourcing",
      "suggestions_feedback",
      "checkout",
      "admin_notifications",
      "custom_chandeliers",
    ]) {
      assert.ok(byId[id], `missing ${id}`);
      assert.equal(byId[id].status, "active", id);
    }
  });

  it("recommendation flow returns ENARTE cards via Decision Engine", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const clarify = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "chandeliers",
      locale: "en",
    });
    assert.equal(clarify.decision.workflowId, "chandelier");

    const found = await sendChatMessage({
      sessionId: started.session.id,
      message: "living room",
      products: CATALOG,
      locale: "en",
    });
    assert.ok(
      found.messages.some((m) => m.type === "product_cards"),
      "expected product cards first",
    );

    const recommended = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "recommend_products",
      products: CATALOG,
      selectedProduct: {
        id: CATALOG[0].id,
        title: CATALOG[0].title,
        url: CATALOG[0].url,
        tags: CATALOG[0].tags,
        collection: CATALOG[0].collection,
      },
      locale: "en",
    });

    assert.equal(recommended.decision.workflowId, "product_recommendations");
    assert.ok(
      recommended.messages.some((m) => m.type === "product_cards"),
      "expected recommendation cards",
    );
    assert.ok(
      [
        CONVERSATION_PHASE.RECOMMENDATION,
        CONVERSATION_PHASE.PRODUCT_FOUND,
        CONVERSATION_PHASE.SIMILAR_PRODUCTS,
      ].includes(recommended.state.phase),
    );
  });

  it("checkout handoff uses Knowledge contact + selected product", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "checkout",
      selectedProduct: {
        id: CATALOG[0].id,
        title: CATALOG[0].title,
        url: CATALOG[0].url,
      },
      locale: "en",
    });
    assert.equal(result.decision.workflowId, "checkout");
    assert.match(result.messages[0].content, /ENARTE|Nova|\+962/i);
  });

  it("workflow runner probes AI Adapter without using it for decisions", async () => {
    const knowledge = createKnowledgeClient({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await executeWorkflow(
      "delivery",
      {
        shop: "demo.myshopify.com",
        locale: "en",
        conversationId: "mem_sprint7",
        knowledge,
      },
      { message: "delivery" },
    );
    assert.equal(result.ok, true);
    assert.equal(result.action, "reply");
  });

  it("memory.read / catalog.recommend / notify.admin capabilities are active", async () => {
    const write = await invokeCapability("memory.write", {
      conversationId: "cap_mem",
    }, {
      entry: { role: "user", content: "hi" },
    });
    assert.equal(write.ok, true);

    const read = await invokeCapability("memory.read", {
      conversationId: "cap_mem",
    }, { limit: 5 });
    assert.equal(read.ok, true);
    assert.ok(read.count >= 1);

    const notify = await invokeCapability(
      "notify.admin",
      { shop: "demo.myshopify.com", conversationId: "cap_mem" },
      { type: "test_event", reason: "unit" },
    );
    assert.equal(notify.ok, true);
    assert.equal(notify.queued, true);

    const recommend = await invokeCapability(
      "catalog.recommend",
      { shop: "demo.myshopify.com" },
      {
        selectedProduct: {
          id: CATALOG[0].id,
          title: CATALOG[0].title,
          tags: CATALOG[0].tags,
          collection: CATALOG[0].collection,
        },
        products: CATALOG,
      },
    );
    assert.equal(recommend.ok, true);
    assert.ok(recommend.cards.every((c) => c.id !== CATALOG[0].id));
  });

  it("session memory retains assistant turns", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    await sendChatMessage({
      sessionId: started.session.id,
      actionId: "delivery",
      locale: "en",
    });
    const memory = readMemory(started.session.id, { limit: 20 });
    assert.ok(memory.length >= 2);
  });
});
