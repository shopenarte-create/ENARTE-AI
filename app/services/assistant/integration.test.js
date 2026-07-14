/**
 * Sprint 3 — End-to-end integration & architecture boundary validation.
 * Run: npm run test:integration
 *
 * Uses an injected in-memory ENARTE catalog (no live Shopify, no OpenAI).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  handleTurn,
  resetAssistantConfigCache,
  getAssistantFoundationStatus,
  getKnowledgeManager,
  ensureKnowledgeReady,
  createKnowledgeClient,
  routeIntent,
  ROUTE_DECISION,
} from "./index.js";
import { resetKnowledgeEngine, bootstrapKnowledgeEngine } from "./knowledge/index.js";
import { resetShopifyCatalogAdapter } from "./adapters/shopify-catalog.js";
import { resetMemoryStore } from "./core/memory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATALOG = [
  {
    id: "gid://shopify/Product/1",
    title: "Crystal Chandelier Aurora",
    price: "450.00",
    currency: "JOD",
    image: "https://cdn.example/aurora.jpg",
    url: "https://demo.myshopify.com/products/aurora",
    collection: "CHANDELIERS",
    tags: ["crystal", "luxury", "gold"],
    productType: "Chandelier",
    categoryName: "Chandeliers",
  },
  {
    id: "gid://shopify/Product/2",
    title: "Crystal Chandelier Luna",
    price: "520.00",
    currency: "JOD",
    image: "https://cdn.example/luna.jpg",
    url: "https://demo.myshopify.com/products/luna",
    collection: "CHANDELIERS",
    tags: ["crystal", "silver"],
    productType: "Chandelier",
    categoryName: "Chandeliers",
  },
  {
    id: "gid://shopify/Product/3",
    title: "LED Pendant Nova",
    price: "120.00",
    currency: "JOD",
    image: "https://cdn.example/nova.jpg",
    url: "https://demo.myshopify.com/products/nova",
    collection: "LED PENDANTS",
    tags: ["led", "modern"],
    productType: "Pendant",
    categoryName: "Pendants",
  },
  {
    id: "gid://shopify/Product/4",
    title: "Brass Wall Sconce",
    price: "80.00",
    currency: "JOD",
    image: null,
    url: "https://demo.myshopify.com/products/sconce",
    collection: "CATALOG",
    tags: ["brass", "wall"],
    productType: "Sconce",
    categoryName: "Wall lights",
  },
];

function leafResult(turn) {
  const wr = turn.workflowResult;
  if (wr?.action === "delegate" && wr.delegated) {
    return wr.delegated;
  }
  return wr;
}

function walkJsFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      walkJsFiles(full, acc);
    } else if (name.endsWith(".js") && !name.endsWith(".test.js")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Sprint 3 architecture boundaries", () => {
  it("workflows never import shopify-products, openai, or knowledge placeholders", () => {
    const workflowsDir = join(__dirname, "workflows");
    const files = walkJsFiles(workflowsDir);
    const violations = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (/shopify-products\.server/.test(src)) {
        violations.push(`${file}: shopify-products.server`);
      }
      if (/from\s+["']openai["']/.test(src) || /require\(["']openai["']\)/.test(src)) {
        violations.push(`${file}: openai`);
      }
      if (/knowledge\/placeholders/.test(src)) {
        violations.push(`${file}: knowledge/placeholders`);
      }
      if (/loadEnarteCatalog/.test(src)) {
        violations.push(`${file}: loadEnarteCatalog`);
      }
    }

    assert.deepEqual(violations, []);
  });

  it("product_search uses catalog.search capability, not adapter import", () => {
    const src = readFileSync(
      join(__dirname, "workflows", "product-search.js"),
      "utf8",
    );
    assert.match(src, /invokeCapability\(\s*["']catalog\.search["']/);
    assert.doesNotMatch(src, /getShopifyCatalogAdapter/);
  });

  it("only shopify-catalog adapter loads ENARTE catalog", () => {
    const adapterSrc = readFileSync(
      join(__dirname, "adapters", "shopify-catalog.js"),
      "utf8",
    );
    assert.match(adapterSrc, /loadEnarteCatalog/);

    const files = walkJsFiles(__dirname).filter(
      (f) => !f.includes(`${join("adapters", "shopify-catalog.js")}`),
    );
    for (const file of files) {
      if (file.endsWith("shopify-catalog.js")) continue;
      const src = readFileSync(file, "utf8");
      // Allow docs/comments; forbid import of shopify-products outside adapter
      if (/from\s+["'][^"']*shopify-products\.server/.test(src)) {
        assert.fail(`Unexpected shopify-products import in ${file}`);
      }
    }
  });

  it("foundation status exposes integrated modules", () => {
    const status = getAssistantFoundationStatus();
    assert.ok(status.architecture.workflowEngine);
    assert.ok(status.architecture.intentRouter);
    assert.ok(status.architecture.knowledgeEngine);
    assert.ok(status.architecture.knowledgeManager);
    assert.ok(status.architecture.shopifyCatalogAdapter);
    assert.equal(status.architecture.aiResponses, false);
    assert.equal(status.architecture.internetProductSearch, false);
    assert.equal(status.runtime.enableLlm, false);
  });
});

describe("Sprint 3 end-to-end scenarios", () => {
  before(async () => {
    resetMemoryStore();
    resetShopifyCatalogAdapter();
    resetAssistantConfigCache();
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    process.env.ASSISTANT_FEATURE_WORKFLOW_ENGINE = "true";
    process.env.ASSISTANT_FEATURE_SHOPIFY_TOOLS = "true";
    process.env.ASSISTANT_FEATURE_LLM = "false";
    resetAssistantConfigCache();
    await ensureKnowledgeReady();
  });

  after(() => {
    resetMemoryStore();
    resetShopifyCatalogAdapter();
    resetAssistantConfigCache();
  });

  it("Knowledge Manager loads Sprint 1 modules for the turn context", async () => {
    const client = createKnowledgeClient({
      shop: "demo.myshopify.com",
      locale: "ar",
    });
    const delivery = await client.get("delivery");
    assert.equal(delivery.data.document.moduleId, "delivery");
    assert.ok(getKnowledgeManager().getStatus().ready);
  });

  it("Product found (single strong match)", async () => {
    const turn = await handleTurn({
      shop: "demo.myshopify.com",
      locale: "ar",
      message: "Crystal Chandelier Aurora",
      workflowId: "product_search",
      skipGeneralDispatch: true,
      products: CATALOG,
    });

    assert.equal(turn.ok, true);
    assert.equal(turn.workflowResult.workflowId, "product_search");

    const leaf = leafResult(turn);
    assert.ok(["products_found", "similar_products"].includes(leaf.action));
    assert.ok(leaf.data.count >= 1);
    assert.equal(leaf.data.cards[0].title, "Crystal Chandelier Aurora");
    assert.ok(leaf.data.cards[0].url);
    assert.ok(leaf.data.cards[0].price);
    assert.equal(leaf.data.cards[0].availability, "available");
  });

  it("Multiple products found", async () => {
    const turn = await handleTurn({
      shop: "demo.myshopify.com",
      message: "crystal chandelier",
      workflowId: "product_search",
      skipGeneralDispatch: true,
      products: CATALOG,
    });

    const leaf = leafResult(turn);
    assert.equal(leaf.action, "products_found");
    assert.ok(leaf.data.count >= 2, `expected multiple cards, got ${leaf.data.count}`);
    const titles = leaf.data.cards.map((c) => c.title);
    assert.ok(titles.some((t) => /Aurora/i.test(t)));
    assert.ok(titles.some((t) => /Luna/i.test(t)));
  });

  it("Similar products found", async () => {
    // Route to product_search; keep query weak enough for similar (not exact) ranking.
    const turn = await handleTurn({
      shop: "demo.myshopify.com",
      message: "product brass wall",
      products: CATALOG,
    });

    assert.equal(turn.workflowResult.action, "delegate");
    const leaf = leafResult(turn);
    assert.ok(
      ["similar_products", "products_found"].includes(leaf.action),
      `unexpected action ${leaf.action}`,
    );
    assert.ok(leaf.data.count >= 1);
    assert.ok(
      leaf.data.cards.some(
        (c) => c.tags.includes("brass") || /sconce/i.test(c.title),
      ),
    );
  });

  it("Off-domain product query → closest ENARTE alternatives", async () => {
    const turn = await handleTurn({
      shop: "demo.myshopify.com",
      message: "refrigerator freezer microwave",
      // Force product_search intent; message alone may not route there.
      intent: "product_search",
      products: CATALOG,
    });

    // Intent product_search routes to product_search workflow via catalog intent id
    const route = routeIntent({ intent: "product_search" });
    assert.equal(route.workflowId, "product_search");

    const leaf = leafResult(turn);
    assert.equal(leaf.action, "similar_products");
    assert.ok(leaf.data.count >= 1);
    assert.ok(leaf.data.cards[0].matchReason || leaf.data.cards[0].rank === 1);
  });

  it("Empty catalog → sourcing workflow", async () => {
    const turn = await handleTurn({
      shop: "demo.myshopify.com",
      message: "crystal chandelier for dining room",
      intent: "product_search",
      products: [],
    });

    const leaf = leafResult(turn);
    assert.equal(leaf.action, "sourcing_triggered");
    assert.equal(leaf.delegated.workflowId, "product_sourcing");
    assert.equal(leaf.delegated.action, "sourcing_queued");
  });

  it("Unknown intent → one clarifying question", async () => {
    const turn = await handleTurn({
      shop: "demo.myshopify.com",
      message: "hmm",
      products: CATALOG,
    });

    assert.equal(turn.workflowResult.action, "clarify");
    assert.ok(turn.workflowResult.message);
    assert.equal(turn.route.decision, ROUTE_DECISION.CLARIFY);
  });

  it("Unsupported / out-of-domain request", async () => {
    const turn = await handleTurn({
      shop: "demo.myshopify.com",
      message: "what is the weather today",
      products: CATALOG,
    });

    assert.equal(turn.workflowResult.action, "out_of_domain");
    assert.ok(turn.workflowResult.message);
    assert.equal(turn.route.decision, ROUTE_DECISION.OUT_OF_DOMAIN);
  });

  it("Intent router and knowledge remain independent of Shopify failures", async () => {
    const decision = routeIntent({ message: "مرحبا" });
    assert.equal(decision.decision, ROUTE_DECISION.GENERAL);

    const km = getKnowledgeManager();
    const validation = km.validate(
      (await km.get("faq")).data.document,
    );
    assert.equal(validation.ok, true);
  });
});
