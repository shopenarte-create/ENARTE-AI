/**
 * Sprint 4 — chat session / smart actions smoke tests (no LLM).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  startChatSession,
  sendChatMessage,
  resetChatSessions,
  listChatSmartActions,
} from "./ux/index.js";
import { extractDescribeSlots } from "./workflows/describe-looking-for.js";
import { resetAssistantConfigCache } from "./config/index.js";
import { resetMemoryStore } from "./core/memory.js";
import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
} from "./knowledge/index.js";

const WELCOME_IDS = [
  "suggestions_feedback",
  "site_inspection",
  "talk_to_assistant",
  "delivery",
  "search_by_image",
];

describe("Sprint 4 chat UX API", () => {
  before(() => {
    resetChatSessions();
    resetMemoryStore();
    resetAssistantConfigCache();
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    process.env.ASSISTANT_FEATURE_LLM = "false";
    process.env.ASSISTANT_FEATURE_WORKFLOW_ENGINE = "true";
    resetAssistantConfigCache();
  });

  after(() => {
    resetChatSessions();
    resetMemoryStore();
  });

  it("starts a session with welcome smart actions", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    assert.equal(started.ok, true);
    assert.ok(started.session.id);
    assert.equal(started.messages[0].type, "welcome");
    assert.match(started.messages[0].content, /ENARTE lighting consultant/i);
    assert.equal(started.actions.length, WELCOME_IDS.length);
    const ids = started.actions.map((a) => a.id);
    assert.deepEqual(ids, WELCOME_IDS);
    assert.equal(ids.includes("search_product"), false);
    assert.equal(ids.includes("chandeliers"), false);
    assert.equal(ids.includes("describe_looking_for"), false);
    assert.ok(
      started.actions.some((a) => /Search by Image/i.test(a.label)),
    );
    assert.ok(
      started.actions.some((a) => /Talk to the Assistant/i.test(a.label)),
    );
  });

  it("recommend_room asks for room photo without opening camera", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "recommend_room",
      locale: "en",
    });
    assert.equal(result.ok, true);
    assert.equal(result.decision.workflowId, "room_analysis");
    assert.equal(result.messages[0].type, "photo_prompt");
    assert.equal(result.messages[0].meta?.openCamera, false);
    assert.equal(result.messages[0].meta?.photoKind, "room");
    assert.match(result.messages[0].content, /upload a room photo/i);
  });

  it("photo upload without vision admits disabled and offers recovery actions", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    await sendChatMessage({
      sessionId: started.session.id,
      actionId: "recommend_room",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      locale: "en",
      image: {
        url: "https://cdn.example/room.jpg",
        mimeType: "image/jpeg",
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.decision.workflowId, "room_analysis");
    assert.match(
      result.messages[0].content,
      /not enabled|Room photo analysis/i,
    );
    assert.doesNotMatch(
      result.messages[0].content,
      /we can offer room photo analysis|virtually place/i,
    );
    assert.equal(result.decision.showSmartButtons, true);
    const actionIds = (result.actions || []).map((a) => a.id);
    assert.ok(actionIds.includes("describe_looking_for"));
    assert.ok(actionIds.includes("search_product"));
  });

  it("composer photo without prior ask still routes to photo workflow", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      locale: "en",
      message: "Photo uploaded",
      image: {
        name: "room.jpg",
        type: "image/jpeg",
        source: "upload",
        photoKind: "room",
        url: "https://cdn.example/room.jpg",
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.decision.workflowId, "room_analysis");
    assert.doesNotMatch(
      String(result.messages[0]?.content || ""),
      /refrigerator|cannot find|I do not understand/i,
    );
  });

  it("product cards expose rank and why-match for sales pitch", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      locale: "en",
      message: "crystal chandelier gold for living room",
      products: [
        {
          id: "gid://shopify/Product/1",
          title: "Crystal Chandelier Aurora",
          price: "450.00",
          currency: "JOD",
          image: "https://cdn.example/aurora.jpg",
          url: "https://demo.myshopify.com/products/aurora",
          collection: "CHANDELIERS",
          tags: ["crystal", "gold"],
          productType: "Chandelier",
          categoryName: "Chandeliers",
        },
        {
          id: "gid://shopify/Product/2",
          title: "LED Pendant Nova",
          price: "120.00",
          currency: "JOD",
          image: null,
          url: "https://demo.myshopify.com/products/nova",
          collection: "LED PENDANTS",
          tags: ["led"],
          productType: "Pendant",
          categoryName: "Pendants",
        },
      ],
    });
    assert.equal(result.ok, true);
    const cardsMsg = result.messages.find((m) => m.type === "product_cards");
    assert.ok(cardsMsg?.cards?.length >= 1);
    assert.equal(cardsMsg.cards[0].rank, 1);
    assert.ok(cardsMsg.cards[0].matchReason);
    assert.match(cardsMsg.cards[0].title, /Crystal Chandelier/i);
  });

  it("lists welcome smart actions independently", () => {
    const actions = listChatSmartActions("en");
    const ids = actions.map((a) => a.id);
    assert.deepEqual(ids, WELCOME_IDS);
  });

  it("delivery action still works when requested explicitly", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "delivery",
      locale: "en",
    });
    assert.equal(result.ok, true);
    assert.equal(result.userMessage.type, "action");
    assert.ok(result.messages.length >= 1);
    assert.match(result.messages[0].content, /6–8 hours|6-8 hours/i);
    assert.match(result.messages[0].content, /other cities/i);
  });

  it("installation & maintenance returns Knowledge services copy", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "installation_maintenance",
      locale: "en",
    });
    assert.equal(result.ok, true);
    assert.match(result.messages[0].content, /00962782404023|\+962782404023/);
    assert.match(result.messages[0].content, /Installation|Maintenance/i);
  });

  it("talk_to_assistant enters free chat without re-showing menus", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "talk_to_assistant",
      locale: "en",
    });
    assert.equal(result.ok, true);
    assert.ok(result.messages[0].content.length > 10);
    assert.equal(result.state.context.freeChatMode, true);
    assert.equal(result.decision.showSmartButtons, false);
    assert.equal((result.actions || []).length, 0);

    const followUp = await sendChatMessage({
      sessionId: started.session.id,
      message: "Do you have light bulbs?",
      locale: "en",
    });
    assert.equal(followUp.ok, true);
    assert.equal(followUp.decision.workflowId, "product_search");
    assert.equal(followUp.decision.showSmartButtons, false);
    assert.equal((followUp.actions || []).length, 0);
  });

  it("typed direct question skips the main menu", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      message: "Do you have light bulbs?",
      locale: "en",
    });
    assert.equal(result.ok, true);
    assert.equal(result.decision.workflowId, "product_search");
    assert.equal(result.decision.showSmartButtons, false);
    assert.equal((result.actions || []).length, 0);
  });

  it("describe_looking_for asks one question at a time with choices", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const start = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "describe_looking_for",
      locale: "en",
    });
    assert.equal(start.ok, true);
    assert.equal(start.decision.workflowId, "describe_looking_for");
    assert.match(start.messages[0].content, /type of lighting/i);
    assert.ok((start.messages[0].actions || []).length >= 5);
    assert.ok(
      start.messages[0].actions.every((a) =>
        String(a.id).startsWith("choice:productType:"),
      ),
    );

    const step2 = await sendChatMessage({
      sessionId: started.session.id,
      actionId: "choice:productType:chandelier",
      message: "Chandelier",
      locale: "en",
    });
    assert.equal(step2.ok, true);
    assert.match(step2.messages[0].content, /style/i);
    assert.ok(
      step2.messages[0].actions.every((a) =>
        String(a.id).startsWith("choice:style:"),
      ),
    );
  });

  it("describe flow extracts stated slots and skips asked questions", () => {
    const slots = extractDescribeSlots(
      "I want a gold crystal hanging chandelier",
    );
    assert.equal(slots.productType, "chandelier");
    assert.equal(slots.style, "crystal");
    assert.equal(slots.installation, "hanging");
    assert.equal(slots.color, "gold");
    assert.equal(slots.room, undefined);
  });

  it("describe flow extracts budget ceiling from Arabic free text", () => {
    const slots = extractDescribeSlots("طيب ثرية بحدود 150");
    assert.equal(slots.productType, "chandelier");
    assert.equal(slots.maxPrice, "150");
    assert.equal(slots.budgetMode, "approx");
  });

  it("main menu request restores the welcome buttons", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    await sendChatMessage({
      sessionId: started.session.id,
      actionId: "talk_to_assistant",
      locale: "en",
    });
    const menu = await sendChatMessage({
      sessionId: started.session.id,
      message: "main menu",
      locale: "en",
    });
    assert.equal(menu.ok, true);
    assert.equal(menu.decision.showSmartButtons, true);
    assert.equal(menu.actions.length, WELCOME_IDS.length);
    assert.equal(menu.state.context.freeChatMode, false);
  });

  it("keeps one continuous conversation without reopening the menu", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    assert.ok(started.messages[0].actions?.length === WELCOME_IDS.length);

    const first = await sendChatMessage({
      sessionId: started.session.id,
      message: "Do you have light bulbs?",
      locale: "en",
    });
    assert.equal(first.state.context.conversationActive, true);
    assert.equal(first.decision.showSmartButtons, false);
    assert.equal(
      first.transcript.filter((m) => m.actions?.length).length,
      0,
      "welcome buttons must retire after customer engages",
    );

    const second = await sendChatMessage({
      sessionId: started.session.id,
      message: "hmm",
      locale: "en",
    });
    assert.equal(second.decision.workflowId, "product_search");
    assert.equal(second.decision.showSmartButtons, false);
    assert.equal((second.actions || []).length, 0);
    assert.equal(second.state.context.conversationActive, true);
    assert.match(second.messages[0]?.content || "", /room|light bulb|ENARTE/i);
    assert.doesNotMatch(
      second.messages[0]?.content || "",
      /Ask me directly|step by step|Start with a button/i,
    );
    assert.ok(second.transcript.length >= 4);
  });

  it("still routes service questions during an active product consult", async () => {
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    await sendChatMessage({
      sessionId: started.session.id,
      message: "Do you have chandeliers?",
      locale: "en",
    });
    const delivery = await sendChatMessage({
      sessionId: started.session.id,
      message: "How does delivery work?",
      locale: "en",
    });
    assert.equal(delivery.decision.workflowId, "delivery");
    assert.equal(delivery.decision.showSmartButtons, false);
  });

  it("answers product questions even when catalog is offline", async () => {
    process.env.ASSISTANT_FEATURE_SHOPIFY_TOOLS = "false";
    resetAssistantConfigCache();
    const started = await startChatSession({
      shop: "demo.myshopify.com",
      locale: "en",
    });
    const result = await sendChatMessage({
      sessionId: started.session.id,
      message: "Do you have light bulbs?",
      locale: "en",
    });
    assert.equal(result.ok, true);
    assert.equal(result.decision.workflowId, "product_search");
    assert.equal(result.turn.leafAction, "reply");
    assert.match(result.messages[0].content, /yes/i);
    assert.match(result.messages[0].content, /light bulbs|lighting/i);
    assert.match(result.messages[0].content, /room/i);
    assert.doesNotMatch(
      result.messages[0].content,
      /style or color|style and color/i,
    );
    assert.equal(result.decision.showSmartButtons, false);
    assert.equal((result.actions || []).length, 0);
    assert.equal(result.state.context.conversationActive, true);
    assert.equal(result.state.context.awaitingConsultDetail, true);
    assert.doesNotMatch(
      result.messages[0].content,
      /could not find a session|placeholder|capability is being activated/i,
    );

    const followUp = await sendChatMessage({
      sessionId: started.session.id,
      message: "bedroom, gold",
      locale: "en",
    });
    assert.equal(followUp.ok, true);
    assert.equal(followUp.decision.workflowId, "product_search");
    assert.equal(followUp.state.context.conversationActive, true);
    assert.equal(followUp.decision.showSmartButtons, false);
    assert.match(followUp.messages[0].content, /bedroom|gold|ENARTE/i);
    assert.doesNotMatch(
      followUp.messages[0]?.content || "",
      /Welcome — I'm your ENARTE|Which room is it for/i,
    );
    assert.doesNotMatch(
      followUp.messages[0]?.content || "",
      /style or color|style and color/i,
    );

    const greetingMidChat = await sendChatMessage({
      sessionId: started.session.id,
      message: "hello",
      locale: "en",
    });
    assert.equal(greetingMidChat.decision.showSmartButtons, false);
    assert.doesNotMatch(
      greetingMidChat.messages[0]?.content || "",
      /Start with a button|route you to/i,
    );

    process.env.ASSISTANT_FEATURE_SHOPIFY_TOOLS = "true";
    resetAssistantConfigCache();
  });
});
