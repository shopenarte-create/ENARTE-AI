/**
 * Sprint 3 — first working customer journey: buy a chandelier.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { routeIntent } from "./core/intent-router.js";
import { handleTurn } from "./core/orchestrator.js";
import {
  startChatSession,
  sendChatMessage,
  resetChatSessions,
} from "./ux/index.js";
import {
  CONVERSATION_PHASE,
  resetConversationState,
} from "./brain/index.js";
import { resetAssistantConfigCache } from "./config/index.js";
import { resetMemoryStore } from "./core/memory.js";
import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
} from "./knowledge/index.js";
import { resetShopifyCatalogAdapter } from "./adapters/shopify-catalog.js";

const CATALOG = [
  {
    id: "gid://shopify/Product/1",
    title: "Crystal Chandelier Aurora",
    price: "450.00",
    currency: "JOD",
    image: "https://cdn.example/aurora.jpg",
    url: "https://demo.myshopify.com/products/aurora",
    collection: "CHANDELIERS",
    tags: ["crystal", "luxury"],
    productType: "Chandelier",
    categoryName: "Chandeliers",
  },
  {
    id: "gid://shopify/Product/2",
    title: "Gold Chandelier Luna",
    price: "520.00",
    currency: "JOD",
    image: "https://cdn.example/luna.jpg",
    url: "https://demo.myshopify.com/products/luna",
    collection: "CHANDELIERS",
    tags: ["gold", "luxury"],
    productType: "Chandelier",
    categoryName: "Chandeliers",
  },
];

describe("Sprint 3 chandelier customer journey", () => {
  beforeEach(() => {
    resetChatSessions();
    resetMemoryStore();
    resetConversationState();
    resetShopifyCatalogAdapter();
    resetAssistantConfigCache();
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    process.env.ASSISTANT_FEATURE_LLM = "false";
    process.env.ASSISTANT_FEATURE_WORKFLOW_ENGINE = "true";
    process.env.ASSISTANT_FEATURE_SHOPIFY_TOOLS = "true";
    resetAssistantConfigCache();
  });

  it("detects buy_chandelier intent for 'I want a chandelier'", () => {
    const route = routeIntent({ message: "I want a chandelier." });
    assert.equal(route.decision, "route");
    assert.equal(route.intent, "buy_chandelier");
    assert.equal(route.workflowId, "chandelier");
  });

  it("asks exactly one room clarification before searching", async () => {
    const turn = await handleTurn({
      shop: "demo.myshopify.com",
      locale: "en",
      message: "I want a chandelier.",
    });

    assert.equal(turn.ok, true);
    assert.equal(turn.route.workflowId, "chandelier");
    const leaf =
      turn.workflowResult?.action === "delegate"
        ? turn.workflowResult.delegated
        : turn.workflowResult;
    assert.equal(leaf.workflowId, "chandelier");
    assert.equal(leaf.action, "clarify");
    assert.match(leaf.message, /Which room is the chandelier for/i);
    assert.equal(leaf.data.awaitingRoom, true);
  });

  it("after room reply, returns ranked ENARTE products", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });

    const clarify = await sendChatMessage({
      sessionId: started.session.id,
      message: "I want a chandelier.",
      locale: "en",
    });
    assert.equal(clarify.decision.workflowId, "chandelier");
    assert.equal(clarify.state.phase, CONVERSATION_PHASE.AWAITING_CLARIFICATION);
    assert.match(
      clarify.messages[0].content,
      /Which room is the chandelier for/i,
    );

    const found = await sendChatMessage({
      sessionId: started.session.id,
      message: "dining room",
      products: CATALOG,
      locale: "en",
    });

    assert.equal(found.decision.workflowId, "chandelier");
    assert.equal(found.state.selectedRoom?.name, "dining room");
    assert.equal(found.state.phase, CONVERSATION_PHASE.PRODUCT_FOUND);

    const cardsMsg = found.messages.find((m) => m.type === "product_cards");
    assert.ok(cardsMsg);
    assert.ok(cardsMsg.cards.length >= 1);
    assert.ok(cardsMsg.cards.every((c) => c.title && c.url));
    // Best ranked first
    assert.match(cardsMsg.cards[0].title, /Chandelier/i);
  });

  it("does not dump unrelated products when no relevant chandelier match", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });

    await sendChatMessage({
      sessionId: started.session.id,
      message: "I want a chandelier.",
      locale: "en",
    });

    const result = await sendChatMessage({
      sessionId: started.session.id,
      message: "garage",
      products: [
        {
          id: "gid://shopify/Product/9",
          title: "Desk Lamp Mini",
          price: "20.00",
          currency: "JOD",
          image: null,
          url: "https://demo.myshopify.com/products/lamp",
          collection: "LAMPS",
          tags: ["desk"],
          productType: "Lamp",
          categoryName: "Lamps",
        },
      ],
      locale: "en",
    });

    assert.equal(result.ok, true);
    const cardsMsg = result.messages.find((m) => m.type === "product_cards");
    assert.equal(
      cardsMsg?.cards?.length || 0,
      0,
      "must not show unrelated desk lamps for a chandelier request",
    );
  });
});
