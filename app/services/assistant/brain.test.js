/**
 * Sprint 5 — Decision Engine + Conversation State tests.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  decide,
  commitDecisionResult,
  toTurnInput,
  createConversationState,
  getConversationState,
  resetConversationState,
  resolveTransition,
  CONVERSATION_PHASE,
  TRANSITION_EVENT,
  DECISION_KIND,
  SMART_BUTTON_SET,
} from "./brain/index.js";
import {
  startChatSession,
  sendChatMessage,
  resetChatSessions,
} from "./ux/index.js";
import { resetAssistantConfigCache } from "./config/index.js";
import { resetMemoryStore } from "./core/memory.js";
import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
} from "./knowledge/index.js";

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
];

describe("Decision Engine", () => {
  beforeEach(() => {
    resetConversationState();
  });

  it("decides workflow from smart action without business rules", () => {
    const state = createConversationState("c1", {
      phase: CONVERSATION_PHASE.WELCOME,
    });
    const d = decide({
      conversationId: "c1",
      state,
      actionId: "delivery",
    });
    assert.equal(d.kind, DECISION_KIND.RUN_WORKFLOW);
    assert.equal(d.workflowId, "delivery");
    assert.equal(d.skipGeneralDispatch, true);
    assert.equal(d.needsClarification, false);
  });

  it("asks for clarification on unclear text", () => {
    const state = createConversationState("c2", {
      phase: CONVERSATION_PHASE.WELCOME,
    });
    const d = decide({
      conversationId: "c2",
      state,
      message: "hmm",
    });
    assert.equal(d.kind, DECISION_KIND.CLARIFY);
    assert.equal(d.needsClarification, true);
    assert.equal(d.showSmartButtons, true);
    assert.equal(d.smartButtonSet, SMART_BUTTON_SET.AFTER_CLARIFY);
  });

  it("supports welcome → product_search → product_found transition", () => {
    createConversationState("c3", { phase: CONVERSATION_PHASE.WELCOME });
    const d = decide({
      conversationId: "c3",
      state: getConversationState("c3"),
      actionId: "search_product",
    });
    assert.equal(d.workflowId, "product_search");

    const committed = commitDecisionResult({
      conversationId: "c3",
      decision: d,
      turn: {
        workflowResult: {
          action: "products_found",
          data: { cards: CATALOG.map((p) => ({ id: p.id, title: p.title })) },
        },
      },
    });

    assert.equal(committed.state.phase, CONVERSATION_PHASE.PRODUCT_FOUND);
    assert.equal(committed.showSmartButtons, false);
    assert.equal(committed.smartButtonSet, SMART_BUTTON_SET.NONE);
    assert.ok(committed.state.selectedProduct?.id);
  });

  it("supports product_found → recommendation → checkout graph", () => {
    createConversationState("c4", {
      phase: CONVERSATION_PHASE.PRODUCT_FOUND,
      currentWorkflow: "product_search",
    });
    const recommend = decide({
      conversationId: "c4",
      state: getConversationState("c4"),
      actionId: "recommend_products",
    });
    assert.equal(recommend.workflowId, "product_recommendations");

    commitDecisionResult({
      conversationId: "c4",
      decision: recommend,
      turn: {
        workflowResult: { action: "placeholder", data: {} },
      },
    });

    const checkoutTransition = resolveTransition(
      CONVERSATION_PHASE.RECOMMENDATION,
      TRANSITION_EVENT.CHECKOUT,
    );
    assert.equal(checkoutTransition.to, CONVERSATION_PHASE.CHECKOUT);
    assert.equal(checkoutTransition.nextWorkflowHint, "checkout");
  });

  it("supports image_search ask-for-photo without auto-opening camera", () => {
    createConversationState("c5", { phase: CONVERSATION_PHASE.WELCOME });
    const d = decide({
      conversationId: "c5",
      state: getConversationState("c5"),
      actionId: "search_by_image",
    });
    assert.equal(d.workflowId, "image_search");
    assert.equal(d.contextPatch?.openCamera, false);
    assert.equal(d.contextPatch?.awaitingPhoto, true);

    const committed = commitDecisionResult({
      conversationId: "c5",
      decision: d,
      turn: {
        workflowResult: {
          action: "ask_photo",
          message: "Do you have a photo of the product you want?",
          data: { awaitingPhoto: true, photoKind: "product", openCamera: false },
        },
      },
    });
    assert.equal(committed.state.phase, CONVERSATION_PHASE.IMAGE_SEARCH);
    assert.equal(committed.state.context.openCamera, false);
    assert.equal(committed.showSmartButtons, false);
  });

  it("recommend_room from welcome asks for room photo (never camera auto-open)", () => {
    createConversationState("c5b", { phase: CONVERSATION_PHASE.WELCOME });
    const d = decide({
      conversationId: "c5b",
      state: getConversationState("c5b"),
      actionId: "recommend_room",
    });
    assert.equal(d.workflowId, "room_analysis");
    assert.equal(d.contextPatch?.openCamera, false);
    assert.equal(d.contextPatch?.photoKind, "room");
  });

  it("toTurnInput maps escalate to admin_notifications", () => {
    const d = decide({ escalate: true });
    const turn = toTurnInput(d, { shop: "demo.myshopify.com" });
    assert.equal(turn.workflowId, "admin_notifications");
    assert.equal(turn.skipGeneralDispatch, true);
  });
});

describe("Decision Engine via chat API", () => {
  beforeEach(() => {
    resetChatSessions();
    resetMemoryStore();
    resetConversationState();
    resetAssistantConfigCache();
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    process.env.ASSISTANT_FEATURE_LLM = "false";
    process.env.ASSISTANT_FEATURE_WORKFLOW_ENGINE = "true";
    process.env.ASSISTANT_FEATURE_SHOPIFY_TOOLS = "true";
    resetAssistantConfigCache();
  });

  it("remembers state across welcome → chandelier clarify → search → found", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    assert.equal(started.session.phase, CONVERSATION_PHASE.WELCOME);

    const clarify = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "chandeliers",
      locale: "en",
    });

    assert.equal(clarify.decision.workflowId, "chandelier");
    assert.equal(clarify.state.phase, CONVERSATION_PHASE.AWAITING_CLARIFICATION);
    assert.match(clarify.messages[0].content, /Which room is the chandelier for/i);

    const found = await sendChatMessage({
      sessionId: started.session.id,
      message: "living room",
      products: CATALOG,
      locale: "en",
    });

    assert.equal(found.decision.workflowId, "chandelier");
    assert.ok(
      ["product_found", "similar_products", "sourcing"].includes(
        found.state.phase,
      ),
    );
    if (found.state.phase === CONVERSATION_PHASE.PRODUCT_FOUND) {
      assert.equal(found.decision.showSmartButtons, false);
      assert.equal((found.actions || []).length, 0);
      assert.equal(found.state.selectedRoom?.name, "living room");
    }
  });

  it("stores clarification status on unclear message", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      message: "hmm",
      locale: "en",
    });
    assert.equal(result.decision.needsClarification, true);
    assert.equal(result.state.clarification.active, true);
    assert.ok(result.state.clarification.count >= 1);
  });
});
