/**
 * Knowledge Module 3 — services population tests.
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
import {
  getServiceOffering,
  getServicesContact,
  getServicesKnowledge,
} from "./readers/services.js";
import { loadPublishedDocument } from "./documents/index.js";

describe("Knowledge Module 3 — services", () => {
  before(async () => {
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    await ensureKnowledgeReady();
  });

  it("publishes a schema-valid document", () => {
    const doc = loadPublishedDocument("services");
    assert.ok(doc);
    assert.equal(doc.version, "1.2.0");
    assert.equal(doc.status, "published");
    assert.equal(validateKnowledgeDocument(doc).ok, true);
  });

  it("loads via Knowledge Manager as READY", async () => {
    const manager = getKnowledgeManager();
    const record = await manager.get("services", { locale: "en" });
    assert.equal(record.status, KNOWLEDGE_STATUS.READY);
    assert.equal(record.data.content.offerings.length, 4);
  });

  it("exposes ENARTE services exactly", async () => {
    const content = await getServicesKnowledge({ locale: "en" });
    const contact = await getServicesContact();
    assert.equal(contact.phone, "+962782404023");

    const installation = await getServiceOffering("installation");
    assert.equal(installation.available, true);
    assert.equal(installation.customersCanRequest, true);
    assert.equal(installation.contactPhone, "+962782404023");

    const maintenance = await getServiceOffering("maintenance");
    assert.equal(maintenance.available, true);
    assert.equal(maintenance.contactPhone, "+962782404023");

    const site = await getServiceOffering("site_inspection");
    assert.equal(site.customersCanRequestSiteVisitBeforePurchasing, true);
    assert.ok(site.suitableFor.includes("villas"));
    assert.ok(site.suitableFor.includes("hotels"));
    assert.ok(site.suitableFor.includes("custom_lighting_projects"));
    assert.equal(site.contactPhone, "+962782404023");

    const custom = await getServiceOffering("custom_lighting");
    assert.equal(custom.availableWhenApplicable, true);
    assert.equal(custom.collectRequestAndDirectToResponsibleTeam, true);
    assert.equal(content.customLighting.collectRequestAndDirectToResponsibleTeam, true);

    assert.equal(content.serviceRules.doNotProvideTechnicalRepairGuidance, true);
    assert.equal(content.serviceRules.whenAskingHowToInstallChandelier, true);
    assert.equal(content.serviceRules.whenAskingToFixElectricalIssue, true);
    assert.match(
      content.serviceRules.messages.en,
      /00962782404023|specialized installation team/i,
    );
    assert.match(
      content.serviceRules.messages.ar,
      /فريق تركيب مختص|00962782404023/,
    );
  });
});
