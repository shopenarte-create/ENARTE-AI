/**
 * Knowledge Module 2 — business_rules population tests.
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
  getAmmanDeliveryWindow,
  getBusinessRules,
  getInstallationContact,
} from "./readers/business-rules.js";
import { loadPublishedDocument } from "./documents/index.js";

describe("Knowledge Module 2 — business_rules", () => {
  before(async () => {
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    await ensureKnowledgeReady();
  });

  it("publishes a schema-valid document", () => {
    const doc = loadPublishedDocument("business_rules");
    assert.ok(doc);
    assert.equal(doc.version, "1.0.0");
    assert.equal(doc.status, "published");
    assert.equal(validateKnowledgeDocument(doc).ok, true);
  });

  it("loads via Knowledge Manager as READY", async () => {
    const manager = getKnowledgeManager();
    const record = await manager.get("business_rules", { locale: "en" });
    assert.equal(record.status, KNOWLEDGE_STATUS.READY);
    assert.equal(record.data.content.delivery.amman.minHours, 6);
    assert.equal(record.data.content.delivery.amman.maxHours, 8);
  });

  it("exposes ENARTE business rules exactly", async () => {
    const content = await getBusinessRules({ locale: "en" });

    assert.equal(content.delivery.otherCities.configurableLater, true);
    assert.equal(content.installationMaintenance.available, true);
    assert.deepEqual(content.installationMaintenance.services, [
      "installation",
      "maintenance",
      "site_inspection",
    ]);

    const contact = await getInstallationContact();
    assert.equal(contact.phone, "+962782404023");

    const amman = await getAmmanDeliveryWindow();
    assert.equal(amman.minHours, 6);
    assert.equal(amman.maxHours, 8);
    assert.equal(amman.unit, "hours");

    assert.equal(content.garageLighting.considerRainAndHumidity, true);
    assert.equal(
      content.garageLighting.recommendOnlyOutdoorWeatherResistant,
      true,
    );
    assert.equal(content.productSearch.searchEnarteCatalogOnly, true);
    assert.equal(content.productSearch.neverSearchInternet, true);
    assert.equal(content.productSearch.neverRecommendOutsideEnarte, true);
    assert.equal(content.unavailableProducts.informTrySourceWithinDays, 3);
    assert.equal(
      content.unavailableProducts.informIfUnsuccessfulWithinHours,
      24,
    );
    assert.equal(
      content.unavailableProducts.createProductSourcingRequest,
      true,
    );
    assert.equal(content.returnsExchange.withinHours, 24);
    assert.equal(content.returnsExchange.allowExchange, true);
    assert.equal(content.returnsExchange.allowReturn, true);
    assert.match(
      content.returnsExchange.messages.ar,
      /24 ساعة|استبدال|ترجيع/,
    );
    assert.equal(
      content.roomRecommendation.offerRoomPhotoAnalysisWhenLookingForRoomLighting,
      true,
    );
    assert.equal(content.imageSearch.offerWheneverAppropriate, true);
    assert.equal(content.buttonsPolicy.preferSmartActionButtons, true);
    assert.equal(content.generalRules.doNotInventPrices, true);
    assert.equal(
      content.generalRules.alwaysRelyOnEnarteKnowledgeAndCatalog,
      true,
    );
    assert.ok(content.rules.some((r) => r.id === "delivery.amman"));
    assert.equal(content.escalation.channels[0].value, "+962782404023");
  });
});
