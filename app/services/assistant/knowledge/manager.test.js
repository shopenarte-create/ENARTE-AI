/**
 * Unit tests — Knowledge Manager (Sprint 1).
 * Run: npm run test:knowledge
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  bootstrapKnowledgeEngine,
  resetKnowledgeEngine,
  createKnowledgeManager,
  createKnowledgeClient,
  ensureKnowledgeReady,
  SPRINT1_KNOWLEDGE_MODULE_IDS,
  KNOWLEDGE_STATUS,
} from "./index.js";

describe("Knowledge Manager", () => {
  before(() => {
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine({ includeFutureStubs: true });
  });

  after(() => {
    resetKnowledgeEngine();
  });

  it("loads Sprint 1 modules (placeholders + published modules 1–4)", async () => {
    const manager = createKnowledgeManager();
    const result = await manager.loadAll();

    assert.equal(result.ok, true);
    assert.equal(result.generation, 1);
    const published = new Set([
      "assistant_personality",
      "business_rules",
      "services",
      "delivery",
    ]);
    for (const id of SPRINT1_KNOWLEDGE_MODULE_IDS) {
      assert.ok(result.modules[id], `missing module ${id}`);
      assert.ok(result.modules[id].data?.document);
      assert.equal(result.validations[id].ok, true);
      const content = result.modules[id].data.content;
      assert.ok(content && typeof content === "object");
      if (published.has(id)) {
        assert.equal(result.modules[id].status, KNOWLEDGE_STATUS.READY);
      } else {
        assert.equal(result.modules[id].status, KNOWLEDGE_STATUS.PLACEHOLDER);
      }
    }
    assert.equal(
      result.modules.assistant_personality.data.content.identity.name,
      "ENARTE AI Assistant",
    );
    assert.equal(
      result.modules.business_rules.data.content.delivery.amman.minHours,
      6,
    );
    assert.equal(
      result.modules.services.data.content.contact.phone,
      "+962782404023",
    );
    assert.equal(
      result.modules.delivery.data.content.amman.estimatedDelivery.maxHours,
      8,
    );
  });

  it("serves from cache on second get", async () => {
    const manager = createKnowledgeManager();
    await manager.loadAll();
    const first = await manager.get("delivery");
    const statusBefore = manager.getStatus().cacheSize;
    const second = await manager.get("delivery");
    const statusAfter = manager.getStatus().cacheSize;

    assert.equal(first.data.version, second.data.version);
    assert.ok(statusAfter >= 1);
    assert.equal(statusBefore, statusAfter);
  });

  it("hot-reloads a module and bumps generation", async () => {
    const manager = createKnowledgeManager();
    await manager.loadAll();
    const before = manager.getStatus().generation;
    const reloaded = await manager.reload("faq");
    assert.equal(reloaded.ok, true);
    assert.deepEqual(reloaded.reloaded, ["faq"]);
    assert.ok(manager.getStatus().generation > before);
  });

  it("validate returns ok for loaded module and fails for unknown", async () => {
    const manager = createKnowledgeManager();
    await manager.loadAll();
    assert.equal(manager.validate("services").ok, true);
    assert.equal(manager.validate("not_a_module").ok, false);
  });

  it("client API serves published personality without touching placeholders", async () => {
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    await ensureKnowledgeReady();
    const client = createKnowledgeClient({ shop: "demo.myshopify.com", locale: "ar" });
    const personality = await client.get("assistant_personality");
    assert.equal(personality.status, KNOWLEDGE_STATUS.READY);
    assert.equal(personality.data.content.identity.name, "ENARTE AI Assistant");
    assert.ok(personality.data.content.specialization.domains.includes("lighting"));
  });

  it("query requires moduleId", async () => {
    const manager = createKnowledgeManager();
    const result = await manager.query({});
    assert.equal(result.status, KNOWLEDGE_STATUS.ERROR);
  });
});
