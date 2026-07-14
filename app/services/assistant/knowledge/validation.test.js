/**
 * Unit tests — knowledge document validation (Sprint 1).
 * Run: npm run test:knowledge
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createKnowledgeDocument,
  createAssistantPersonalityContent,
  createDeliveryContent,
  createFaqContent,
  createBusinessRulesContent,
  createServicesContent,
  validateKnowledgeDocument,
  validateKnowledgeEnvelope,
  validateModuleContent,
  assertValidKnowledgeDocument,
} from "./schemas/index.js";
import { KNOWLEDGE_DOCUMENT_STATUS } from "./constants.js";
import { loadAllPlaceholderDocuments } from "./placeholders/index.js";

describe("Knowledge document validation", () => {
  it("accepts all Sprint 1 placeholder documents", () => {
    const all = loadAllPlaceholderDocuments();
    for (const [id, doc] of Object.entries(all)) {
      const result = validateKnowledgeDocument(doc);
      assert.equal(result.ok, true, `${id} should be valid: ${JSON.stringify(result.errors)}`);
    }
  });

  it("rejects missing version / meta", () => {
    const result = validateKnowledgeEnvelope({
      moduleId: "faq",
      locale: "und",
      locales: ["und"],
      status: KNOWLEDGE_DOCUMENT_STATUS.PLACEHOLDER,
      content: {},
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.path === "version"));
    assert.ok(result.errors.some((e) => e.path === "meta"));
  });

  it("rejects invalid semver", () => {
    const doc = createKnowledgeDocument({
      moduleId: "faq",
      version: "not-a-version",
      content: createFaqContent(),
    });
    // createKnowledgeDocument still builds it; validation catches format
    const result = validateKnowledgeEnvelope(doc);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "format"));
  });

  it("rejects delivery content with non-array regions", () => {
    const result = validateModuleContent("delivery", {
      ...createDeliveryContent(),
      regions: "amman",
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.path === "content.regions"));
  });

  it("rejects assistant_personality missing required keys", () => {
    const result = validateModuleContent("assistant_personality", {
      identity: {},
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.code === "required"));
  });

  it("assertValidKnowledgeDocument throws on invalid docs", () => {
    assert.throws(() =>
      assertValidKnowledgeDocument({
        moduleId: "services",
        version: "1.0.0",
        locale: "und",
        locales: ["und"],
        status: KNOWLEDGE_DOCUMENT_STATUS.PLACEHOLDER,
        content: createServicesContent(),
        // missing meta
      }),
    );
  });

  it("content factories produce required keys", () => {
    const samples = [
      ["assistant_personality", createAssistantPersonalityContent()],
      ["business_rules", createBusinessRulesContent()],
      ["services", createServicesContent()],
      ["delivery", createDeliveryContent()],
      ["faq", createFaqContent()],
    ];
    for (const [moduleId, content] of samples) {
      const result = validateModuleContent(moduleId, content);
      assert.equal(result.ok, true, moduleId);
    }
  });

  it("placeholders without published content stay empty of invented policies", () => {
    const all = loadAllPlaceholderDocuments();
    for (const [id, doc] of Object.entries(all)) {
      if (doc.status === "published") continue;
      const json = JSON.stringify(doc.content);
      assert.equal(json.includes("within 3 days"), false, id);
      assert.equal(json.includes("Amman"), false, id);
    }
  });

  it("published assistant_personality validates and contains ENARTE identity", () => {
    const all = loadAllPlaceholderDocuments();
    const doc = all.assistant_personality;
    assert.equal(doc.status, "published");
    assert.equal(doc.content.identity.name, "ENARTE AI Assistant");
    assert.equal(doc.content.constraints.maxClarifyingQuestions, 1);
    assert.equal(doc.content.productRules.neverRecommendInternetProducts, true);
    assert.equal(doc.content.sourcing.whenUnavailable.informTrySourceWithinDays, 3);
    assert.equal(
      validateKnowledgeDocument(doc).ok,
      true,
    );
  });

  it("published business_rules validates and contains ENARTE policies", () => {
    const all = loadAllPlaceholderDocuments();
    const doc = all.business_rules;
    assert.equal(doc.status, "published");
    assert.equal(doc.content.delivery.amman.minHours, 6);
    assert.equal(doc.content.delivery.amman.maxHours, 8);
    assert.equal(doc.content.installationMaintenance.contact.phone, "+962782404023");
    assert.equal(doc.content.garageLighting.recommendOnlyOutdoorWeatherResistant, true);
    assert.equal(doc.content.productSearch.neverSearchInternet, true);
    assert.equal(doc.content.unavailableProducts.createProductSourcingRequest, true);
    assert.equal(doc.content.generalRules.doNotInventPrices, true);
    assert.equal(validateKnowledgeDocument(doc).ok, true);
  });

  it("published services validates and contains ENARTE offerings", () => {
    const all = loadAllPlaceholderDocuments();
    const doc = all.services;
    assert.equal(doc.status, "published");
    assert.equal(doc.content.contact.phone, "+962782404023");
    assert.equal(doc.content.offerings.length, 4);
    assert.equal(doc.content.serviceRules.doNotProvideTechnicalRepairGuidance, true);
    assert.equal(
      doc.content.customLighting.collectRequestAndDirectToResponsibleTeam,
      true,
    );
    const site = doc.content.offerings.find((o) => o.id === "site_inspection");
    assert.ok(site.suitableFor.includes("restaurants"));
    assert.equal(validateKnowledgeDocument(doc).ok, true);
  });

  it("published delivery validates and contains Amman estimate only", () => {
    const all = loadAllPlaceholderDocuments();
    const doc = all.delivery;
    assert.equal(doc.status, "published");
    assert.equal(doc.content.amman.estimatedDelivery.minHours, 6);
    assert.equal(doc.content.amman.estimatedDelivery.maxHours, 8);
    assert.equal(doc.content.otherCities.supported, true);
    assert.equal(doc.content.otherCities.doNotHardcodeEstimates, true);
    assert.equal(doc.content.otherCities.estimatedDelivery, null);
    assert.equal(doc.content.pricing.enabled, false);
    assert.equal(doc.content.futureSupport.scheduledDelivery, true);
    assert.equal(validateKnowledgeDocument(doc).ok, true);
  });
});
