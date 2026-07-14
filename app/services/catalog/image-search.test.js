/**
 * Tests — Vision attribute normalize + Shopify attribute ranking (no live OpenAI).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hasUsableVisionAttributes,
  normalizeVisionAttributes,
} from "../vision/normalize-attributes.js";
import { rankProductsByAttributes } from "./attribute-match.server.js";

const SAMPLE = [
  {
    id: "1",
    title: "Crystal Gold Chandelier Aurora 3 Rings",
    productType: "Chandelier",
    collection: "CHANDELIERS",
    tags: ["crystal", "luxury", "gold"],
    image: "https://cdn.example/a.jpg",
    price: "450.00",
    currency: "JOD",
    url: "https://shop.example/products/a",
    handle: "aurora",
  },
  {
    id: "2",
    title: "LED Pendant Nova",
    productType: "Pendant",
    collection: "LED PENDANTS",
    tags: ["led", "modern", "black"],
    image: "https://cdn.example/b.jpg",
    price: "120.00",
    currency: "JOD",
    url: "https://shop.example/products/b",
    handle: "nova",
  },
  {
    id: "3",
    title: "Brass Wall Sconce",
    productType: "Sconce",
    collection: "CATALOG",
    tags: ["brass", "wall"],
    image: "https://cdn.example/c.jpg",
    price: "80.00",
    currency: "JOD",
    url: "https://shop.example/products/c",
    handle: "sconce",
  },
];

describe("Vision lighting attributes", () => {
  it("normalizes Vision JSON into catalog attribute shape", () => {
    const attrs = normalizeVisionAttributes({
      type: "chandelier",
      style: "crystal",
      shape: "round",
      rings: 3,
      materials: ["crystal", "metal"],
      colors: ["gold"],
      size: "large",
      confidence: 0.9,
    });
    assert.equal(attrs.type, "chandelier");
    assert.equal(attrs.shape, "round");
    assert.equal(attrs.rings, 3);
    assert.ok(attrs.colors.includes("gold"));
    assert.ok(attrs.materials.includes("crystal"));
    assert.ok(attrs.styles.includes("crystal"));
    assert.equal(attrs.size, "large");
    assert.equal(hasUsableVisionAttributes(attrs), true);
  });

  it("rejects empty Vision payloads as unusable", () => {
    const attrs = normalizeVisionAttributes({ type: null, colors: [] });
    assert.equal(hasUsableVisionAttributes(attrs), false);
  });
});

describe("Attribute catalog ranking", () => {
  it("ranks chandelier vision attrs above wall sconce", () => {
    const query = normalizeVisionAttributes({
      type: "chandelier",
      style: "crystal",
      colors: ["gold"],
      materials: ["crystal"],
      rings: 3,
    });
    const ranked = rankProductsByAttributes(SAMPLE, query, {
      locale: "en",
      minScore: 20,
    });
    assert.ok(ranked.count >= 1);
    assert.match(ranked.products[0].title, /Crystal Gold Chandelier/i);
    assert.ok(
      ranked.products.every((p) => !/Wall Sconce/i.test(p.title)),
    );
  });

  it("returns empty when no reasonable type match exists", () => {
    const query = normalizeVisionAttributes({
      type: "fan",
      colors: ["black"],
      styles: ["modern"],
    });
    const ranked = rankProductsByAttributes(SAMPLE, query, { minScore: 28 });
    assert.equal(ranked.count, 0);
  });
});
