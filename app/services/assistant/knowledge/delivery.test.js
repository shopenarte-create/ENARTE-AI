/**
 * Knowledge Module 4 — delivery population tests.
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
  getAmmanDeliveryEstimate,
  getDeliveryCustomerMessage,
  getDeliveryKnowledge,
  getDeliveryRegion,
} from "./readers/delivery.js";
import { loadPublishedDocument } from "./documents/index.js";

describe("Knowledge Module 4 — delivery", () => {
  before(async () => {
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    await ensureKnowledgeReady();
  });

  it("publishes a schema-valid versioned document", () => {
    const doc = loadPublishedDocument("delivery");
    assert.ok(doc);
    assert.equal(doc.version, "1.0.0");
    assert.equal(doc.status, "published");
    assert.ok(doc.locales.includes("ar"));
    assert.ok(doc.locales.includes("en"));
    assert.equal(typeof doc.meta.schemaVersion, "string");
    assert.equal(doc.meta.sources.json, true);
    assert.equal(doc.meta.sync.database.enabled, false);
    assert.equal(doc.meta.sync.cms.enabled, false);
    assert.equal(validateKnowledgeDocument(doc).ok, true);
  });

  it("loads via Knowledge Manager as READY", async () => {
    const manager = getKnowledgeManager();
    const record = await manager.get("delivery", { locale: "en" });
    assert.equal(record.status, KNOWLEDGE_STATUS.READY);
    assert.equal(record.data.content.amman.estimatedDelivery.minHours, 6);
    assert.equal(record.data.content.amman.estimatedDelivery.maxHours, 8);
  });

  it("exposes current ENARTE delivery rules exactly", async () => {
    const content = await getDeliveryKnowledge({ locale: "en" });
    const amman = await getAmmanDeliveryEstimate();
    assert.equal(amman.minHours, 6);
    assert.equal(amman.maxHours, 8);
    assert.equal(amman.unit, "hours");

    assert.equal(content.otherCities.supported, true);
    assert.equal(content.otherCities.timesConfigurable, true);
    assert.equal(content.otherCities.doNotHardcodeEstimates, true);
    assert.equal(content.otherCities.estimatedDelivery, null);

    assert.equal(
      content.customerCommunication.alwaysProvideEstimatedTimeWhenAvailable,
      true,
    );
    assert.equal(
      content.customerCommunication.ifUnknownPolitelyInformConfirmedAfterOrderReview,
      true,
    );

    const unknown = await getDeliveryCustomerMessage("unknown", "en");
    assert.match(unknown, /confirmed after the order is reviewed/i);

    const region = await getDeliveryRegion("amman");
    assert.equal(region.estimatedDelivery.minHours, 6);
  });

  it("reserves future support structures without enabling them", async () => {
    const content = await getDeliveryKnowledge();
    assert.deepEqual(content.zones, []);
    assert.equal(content.pricing.enabled, false);
    assert.deepEqual(content.pricing.entries, []);
    assert.equal(content.expressDelivery.enabled, false);
    assert.equal(content.scheduledDelivery.enabled, false);
    assert.equal(content.orderTracking.enabled, false);
    assert.deepEqual(content.shippingProviders, []);
    assert.deepEqual(content.holidaySchedules, []);
    assert.equal(content.futureSupport.deliveryZones, true);
    assert.equal(content.futureSupport.orderTracking, true);
    assert.equal(content.futureSupport.holidaySchedules, true);
  });
});
