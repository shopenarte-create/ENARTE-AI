/**
 * Unit tests — product search ranking + adapter (no live Shopify).
 * Run: npm run test:product-search
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import {
  parseProductSearchQuery,
  rankCatalogProducts,
} from "./catalog/search-rank.js";
import { toProductCard } from "./catalog/product-card.js";
import {
  createShopifyCatalogAdapter,
  resetShopifyCatalogAdapter,
} from "./adapters/shopify-catalog.js";
import { resetAssistantConfigCache } from "./config/index.js";
import productSearch from "./workflows/product-search.js";
import { WORKFLOW_STATUS } from "./constants.js";

const SAMPLE_CATALOG = [
  {
    id: "gid://shopify/Product/1",
    title: "Crystal Chandelier Aurora",
    price: "450.00",
    currency: "JOD",
    image: "https://cdn.example/aurora.jpg",
    url: "https://shop.myshopify.com/products/aurora",
    collection: "CHANDELIERS",
    tags: ["crystal", "luxury", "gold"],
    productType: "Chandelier",
    categoryName: "Chandeliers",
  },
  {
    id: "gid://shopify/Product/2",
    title: "LED Pendant Nova",
    price: "120.00",
    currency: "JOD",
    image: "https://cdn.example/nova.jpg",
    url: "https://shop.myshopify.com/products/nova",
    collection: "LED PENDANTS",
    tags: ["led", "modern"],
    productType: "Pendant",
    categoryName: "Pendants",
  },
  {
    id: "gid://shopify/Product/3",
    title: "Brass Wall Sconce",
    price: "80.00",
    currency: "JOD",
    image: null,
    url: "https://shop.myshopify.com/products/sconce",
    collection: "CATALOG",
    tags: ["brass", "wall"],
    productType: "Sconce",
    categoryName: "Wall lights",
  },
];

describe("Product search ranking", () => {
  it("parses keywords from message", () => {
    const q = parseProductSearchQuery({ message: "أبحث عن ثريا crystal" });
    assert.ok(q.keywords.includes("ثريا") || q.keywords.includes("crystal"));
  });

  it("ranks exact / strong chandelier matches first", () => {
    const query = parseProductSearchQuery({
      message: "crystal chandelier",
    });
    const ranked = rankCatalogProducts(SAMPLE_CATALOG, query);
    assert.ok(["exact", "ranked", "similar"].includes(ranked.mode));
    assert.ok(ranked.results.length >= 1);
    assert.match(ranked.results[0].product.title, /Crystal Chandelier/i);
    // Must not mix in wall sconces when customer asked for a chandelier.
    assert.ok(
      ranked.results.every((row) =>
        /chandelier|pendant/i.test(row.product.productType || row.product.title),
      ),
    );
  });

  it("returns similar when only weak overlap", () => {
    const query = parseProductSearchQuery({ message: "brass light" });
    const ranked = rankCatalogProducts(SAMPLE_CATALOG, query);
    assert.ok(ranked.results.length >= 1);
    assert.ok(["ranked", "similar", "exact"].includes(ranked.mode));
    assert.match(ranked.results[0].product.title, /Brass Wall Sconce/i);
  });

  it("hard-filters products above the customer's budget", () => {
    const budgetCatalog = [
      {
        id: "gid://shopify/Product/10",
        title: "Halo LED Crystal Chandelier",
        price: "140.00",
        priceAmount: 140,
        currency: "JOD",
        collection: "CHANDELIERS",
        tags: ["crystal", "led"],
        productType: "Chandelier",
        categoryName: "Chandeliers",
      },
      {
        id: "gid://shopify/Product/11",
        title: "Marble Tubli LED Chandelier",
        price: "400.00",
        priceAmount: 400,
        currency: "JOD",
        collection: "CHANDELIERS",
        tags: ["marble", "led"],
        productType: "Chandelier",
        categoryName: "Chandeliers",
      },
      {
        id: "gid://shopify/Product/12",
        title: "Murano Pearl LED chandelier",
        price: "70.00",
        priceAmount: 70,
        currency: "JOD",
        collection: "CHANDELIERS",
        tags: ["led"],
        productType: "Chandelier",
        categoryName: "Chandeliers",
      },
    ];

    const query = parseProductSearchQuery({
      message: "طيب ثرية بحدود 150",
    });
    assert.equal(query.maxPrice, 150);
    assert.equal(query.budgetMode, "approx");

    const ranked = rankCatalogProducts(budgetCatalog, query);
    assert.ok(ranked.results.length >= 1);
    assert.ok(
      ranked.results.every((row) => {
        const p = Number(row.product.priceAmount ?? row.product.price);
        return p <= 150 * 1.12;
      }),
    );
    assert.ok(
      !ranked.results.some((row) => /400|Tubli/i.test(row.product.title)),
      "must not suggest 400 JOD chandelier for 150 budget",
    );
  });

  it("parses Eastern Arabic digits in budget asks", () => {
    const query = parseProductSearchQuery({
      message: "بدي ثريا ب ١٥٠",
    });
    assert.equal(query.maxPrice, 150);
  });

  it("explains attribute similarity for closest alternatives", () => {
    const query = parseProductSearchQuery({
      message: "modern gold crystal chandelier",
    });
    const ranked = rankCatalogProducts(SAMPLE_CATALOG, query, { locale: "en" });
    assert.ok(ranked.results.length >= 1);
    assert.match(
      ranked.results[0].matchReason || "",
      /type|color|material|style|crystal|gold|chandelier/i,
    );
  });

  it("builds product cards with required fields", () => {
    const card = toProductCard(SAMPLE_CATALOG[0], {
      score: 42,
      matchType: "exact",
    });
    assert.equal(card.title, "Crystal Chandelier Aurora");
    assert.equal(card.image, "https://cdn.example/aurora.jpg");
    assert.equal(card.price, "450.00");
    assert.equal(card.availability, "available");
    assert.ok(card.url);
    assert.equal(card.collection, "CHANDELIERS");
    assert.ok(card.tags.includes("crystal"));
  });
});

describe("Shopify catalog adapter + product_search workflow", () => {
  before(() => {
    resetShopifyCatalogAdapter();
    resetAssistantConfigCache();
    process.env.ASSISTANT_FEATURE_SHOPIFY_TOOLS = "true";
    process.env.ASSISTANT_FEATURE_LLM = "false";
  });

  it("adapter returns ranked cards from injected catalog", async () => {
    const adapter = createShopifyCatalogAdapter({
      loadCatalog: async () => ({
        shop: "demo.myshopify.com",
        products: SAMPLE_CATALOG,
        count: SAMPLE_CATALOG.length,
        source: "injected",
      }),
    });

    const result = await adapter.search({
      shop: "demo.myshopify.com",
      message: "LED pendant",
      products: SAMPLE_CATALOG,
    });

    assert.equal(result.ok, true);
    assert.ok(result.count >= 1);
    assert.equal(result.cards[0].title, "LED Pendant Nova");
    assert.ok(result.cards[0].url);
  });

  it("product_search refuses unrelated off-domain dump", async () => {
    assert.equal(productSearch.status, WORKFLOW_STATUS.ACTIVE);

    const result = await productSearch.run(
      { shop: "demo.myshopify.com", conversationId: "test_conv" },
      {
        message: "refrigerator freezer microwave",
        products: SAMPLE_CATALOG,
      },
    );

    // Quality rule: do not recommend lighting just because the catalog exists.
    assert.equal(result.action, "sourcing_triggered");
    assert.ok(!result.data?.cards?.length);
  });

  it("product_search triggers sourcing only when catalog is empty", async () => {
    const result = await productSearch.run(
      { shop: "demo.myshopify.com", conversationId: "test_conv_empty" },
      {
        message: "crystal chandelier for living room gold",
        products: [],
      },
    );

    assert.equal(result.action, "sourcing_triggered");
    assert.equal(result.delegated?.workflowId, "product_sourcing");
  });

  it("product_search returns cards for catalog hits", async () => {
    const result = await productSearch.run(
      { shop: "demo.myshopify.com" },
      {
        message: "crystal chandelier gold",
        products: SAMPLE_CATALOG,
      },
    );

    assert.ok(["products_found", "similar_products"].includes(result.action));
    assert.ok(result.data.cards.length >= 1);
    assert.equal(result.data.cards[0].collection, "CHANDELIERS");
  });
});
