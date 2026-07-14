/**
 * Knowledge Module 1 — assistant_personality population tests.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
  getKnowledgeManager,
  ensureKnowledgeReady,
  validateKnowledgeDocument,
  KNOWLEDGE_STATUS,
} from "./index.js";
import { getAssistantPersonality } from "./readers/assistant-personality.js";
import { loadPublishedDocument } from "./documents/index.js";

describe("Knowledge Module 1 — assistant_personality", () => {
  before(async () => {
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    await ensureKnowledgeReady();
  });

  it("publishes a schema-valid document", () => {
    const doc = loadPublishedDocument("assistant_personality");
    assert.ok(doc);
    assert.equal(doc.version, "1.0.0");
    assert.equal(doc.status, "published");
    assert.equal(validateKnowledgeDocument(doc).ok, true);
  });

  it("loads via Knowledge Manager as READY", async () => {
    const manager = getKnowledgeManager();
    const record = await manager.get("assistant_personality", { locale: "en" });
    assert.equal(record.status, KNOWLEDGE_STATUS.READY);
    assert.equal(record.data.content.identity.name, "ENARTE AI Assistant");
    assert.equal(record.data.content.identity.isGeneralAi, false);
    assert.equal(record.data.content.identity.representsOnly, "ENARTE");
  });

  it("exposes mission, style, principles, and product rules exactly", async () => {
    const content = await getAssistantPersonality({ locale: "en" });
    assert.ok(
      content.mission.goals.includes("Help customers choose the best lighting."),
    );
    assert.ok(content.tone.traits.includes("friendly"));
    assert.ok(content.tone.traits.includes("professional"));
    assert.ok(content.tone.traits.includes("short_and_clear"));
    assert.equal(content.tone.preferSmartActionButtons, true);
    assert.equal(content.conversationPrinciples.askOnlyOneClarificationAtATime, true);
    assert.equal(content.productRules.recommendEnarteOnly, true);
    assert.equal(content.productRules.neverInventProducts, true);
    assert.equal(content.sourcing.whenUnavailable.informIfImpossibleWithinHours, 24);
    assert.equal(content.sourcing.whenUnavailable.createProductSourcingRequest, true);
    assert.equal(content.imageSearch.askForPhotoWhenAppropriate, true);
    assert.equal(content.roomRecommendation.explainVirtualPlacementLater, true);
    assert.match(content.messages.outOfDomain.ar, /خارج سياق المتجر/);
    assert.match(content.messages.outOfDomain.en, /cannot talk outside this store/i);
  });
});
