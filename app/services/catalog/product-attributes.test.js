/**
 * Unit tests — product attribute extraction + overlap scoring.
 * Run: node --test ./app/services/catalog/product-attributes.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractProductAttributes,
  extractQueryAttributes,
  scoreAttributeOverlap,
  extractRingOrArmCount,
} from "./product-attributes.js";

describe("product attributes", () => {
  it("extracts type, material, color, style from catalog text", () => {
    const attrs = extractProductAttributes({
      title: "Crystal Gold Chandelier Aurora 3 Rings",
      productType: "Chandelier",
      tags: ["crystal", "luxury", "gold"],
      collection: "CHANDELIERS",
    });
    assert.equal(attrs.type, "chandelier");
    assert.ok(attrs.materials.includes("crystal"));
    assert.ok(attrs.colors.includes("gold"));
    assert.ok(attrs.styles.includes("crystal") || attrs.styles.includes("luxury"));
    assert.equal(attrs.rings, 3);
  });

  it("extracts ring counts from Arabic / English", () => {
    assert.equal(extractRingOrArmCount("ثريا 5 حلقات ذهبية"), 5);
    assert.equal(extractRingOrArmCount("double ring pendant"), 2);
  });

  it("rejects incompatible fixture types", () => {
    const query = extractQueryAttributes({
      text: "أريد ثريا كريستال ذهبية",
      keywords: ["ثريا", "كريستال", "ذهبية"],
    });
    const wall = extractProductAttributes({
      title: "Brass Wall Sconce",
      productType: "Sconce",
      tags: ["brass"],
    });
    const hit = scoreAttributeOverlap(query, wall);
    assert.equal(hit.typeOk, false);
  });

  it("scores closest chandelier over unrelated sconce", () => {
    const query = extractQueryAttributes({
      text: "modern gold crystal chandelier",
      keywords: ["modern", "gold", "crystal", "chandelier"],
    });
    const chandelier = extractProductAttributes({
      title: "Crystal Chandelier Aurora",
      productType: "Chandelier",
      tags: ["crystal", "luxury", "gold"],
      collection: "CHANDELIERS",
    });
    const sconce = extractProductAttributes({
      title: "Brass Wall Sconce",
      productType: "Sconce",
      tags: ["brass", "wall"],
    });
    const a = scoreAttributeOverlap(query, chandelier);
    const b = scoreAttributeOverlap(query, sconce);
    assert.ok(a.typeOk);
    assert.equal(b.typeOk, false);
    assert.ok(a.score > b.score);
  });
});
