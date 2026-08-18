/**
 * Shopify Catalog Adapter — interface-only boundary for ENARTE store catalog.
 *
 * Workflows talk to this adapter (or catalog.search capability), never to
 * Shopify GraphQL / Admin SDK directly. No internet product search.
 */

import { ADAPTER_STATUS } from "../constants.js";
import { getAssistantConfig } from "../config/index.js";
import {
  parseProductSearchQuery,
  rankCatalogProducts,
  SEARCH_CONFIG,
} from "../catalog/search-rank.js";
import { toProductCards } from "../catalog/product-card.js";
import { filterEnarteCatalogCards } from "../core/domain-scope.js";

const CATALOG_CACHE_TTL_MS = 180_000;
/** Keep brief so a brief Admin blip does not block catalog for long. */
const CATALOG_ERROR_CACHE_TTL_MS = 3_000;

/** @type {Map<string, { at: number, ttl: number, payload: object }>} */
const catalogCache = new Map();
/** @type {Map<string, Promise<object>>} */
const inflightCatalog = new Map();

/**
 * @typedef {object} CatalogSearchInput
 * @property {string} [shop]
 * @property {string} [message]
 * @property {string} [query]
 * @property {object} [artifacts]
 * @property {object[]} [products]  Optional preloaded catalog (tests)
 */

/**
 * Create the Shopify catalog adapter API.
 * `loadCatalog` is injectable for tests; default uses ENARTE Shopify loader.
 */
export function createShopifyCatalogAdapter({ loadCatalog } = {}) {
  const loader =
    loadCatalog ||
    (async (shop) => {
      const { loadEnarteCatalog } = await import(
        "../../shopify-products.server.js"
      );
      return loadEnarteCatalog({ shop });
    });

  async function loadCatalogCached(shop) {
    const key = String(shop || "default");
    const cached = catalogCache.get(key);
    if (cached && Date.now() - cached.at < (cached.ttl || CATALOG_CACHE_TTL_MS)) {
      if (cached.payload?.__loadError) {
        const err = new Error(cached.payload.message || "catalog_load_failed");
        err.code = "catalog_load_failed";
        throw err;
      }
      return cached.payload;
    }

    if (inflightCatalog.has(key)) {
      return inflightCatalog.get(key);
    }

    const pending = Promise.resolve()
      .then(() => loader(shop))
      .then((payload) => {
        catalogCache.set(key, {
          at: Date.now(),
          ttl: CATALOG_CACHE_TTL_MS,
          payload,
        });
        inflightCatalog.delete(key);
        return payload;
      })
      .catch((error) => {
        catalogCache.set(key, {
          at: Date.now(),
          ttl: CATALOG_ERROR_CACHE_TTL_MS,
          payload: Object.freeze({
            __loadError: true,
            message: error instanceof Error ? error.message : String(error),
            products: Object.freeze([]),
            count: 0,
            source: "error",
          }),
        });
        inflightCatalog.delete(key);
        throw error;
      });

    inflightCatalog.set(key, pending);
    return pending;
  }

  return Object.freeze({
    id: "shopify.catalog",
    status: ADAPTER_STATUS.ACTIVE,
    description:
      "ENARTE Shopify catalog search adapter (name/category/keywords/tags).",

    /**
     * Search only the shop's ENARTE catalog.
     * @param {CatalogSearchInput} input
     */
    async search(input = {}) {
      const config = getAssistantConfig();
      if (config.features.enableLlm) {
        // Hard guard: this adapter never calls an LLM even if misconfigured.
      }
      if (!config.features.enableShopifyTools && !input.products) {
        return Object.freeze({
          ok: false,
          error: "shopify_tools_disabled",
          note: "Set ASSISTANT_FEATURE_SHOPIFY_TOOLS=true to enable catalog search.",
          cards: Object.freeze([]),
          mode: "disabled",
        });
      }

      const query = parseProductSearchQuery(input);
      const hasSignal =
        query.name ||
        query.category ||
        query.tags.length ||
        query.keywords.length;

      if (!hasSignal) {
        return Object.freeze({
          ok: true,
          mode: "none",
          query,
          cards: Object.freeze([]),
          count: 0,
          note: "No searchable name/category/keywords/tags in the request.",
        });
      }

      let catalogPayload;
      try {
        catalogPayload = input.products
          ? {
              shop: input.shop || null,
              products: input.products,
              count: input.products.length,
              source: "injected",
            }
          : await loadCatalogCached(input.shop);
      } catch (error) {
        return Object.freeze({
          ok: false,
          error: "catalog_load_failed",
          message: error instanceof Error ? error.message : String(error),
          cards: Object.freeze([]),
          mode: "error",
          query,
        });
      }

      const ranked = rankCatalogProducts(
        catalogPayload.products || [],
        query,
        {
          ...SEARCH_CONFIG,
          locale: input.locale || SEARCH_CONFIG.locale || "ar",
        },
      );

      const cards = filterEnarteCatalogCards(
        toProductCards(
          ranked.results.map((row) => row.product),
          (product, index) => ({
            score: ranked.results[index].score,
            matchType: ranked.results[index].matchType,
            rank: ranked.results[index].rank || index + 1,
            matchReason: ranked.results[index].matchReason || null,
            availability: "available",
          }),
        ),
      );

      return Object.freeze({
        ok: true,
        mode: ranked.mode,
        query,
        cards,
        count: cards.length,
        shop: catalogPayload.shop || input.shop || null,
        catalogCount:
          catalogPayload.count ?? catalogPayload.products?.length ?? 0,
        source: catalogPayload.source || "shopify",
        note:
          ranked.mode === "none"
            ? "No relevant ENARTE catalog matches."
            : ranked.mode === "similar"
              ? "No exact match — returning similar ENARTE products."
              : "Ranked ENARTE catalog matches.",
      });
    },
  });
}

let singleton = null;

export function getShopifyCatalogAdapter(options) {
  if (!singleton) {
    singleton = createShopifyCatalogAdapter(options);
  }
  return singleton;
}

export function resetShopifyCatalogAdapter() {
  singleton = null;
  catalogCache.clear();
  inflightCatalog.clear();
}
