/**
 * Rank ENARTE Shopify products by structured attribute similarity.
 * Used after Vision extraction (and reusable for text attribute briefs).
 */

import {
  describeAttributeReasons,
  extractProductAttributes,
  scoreAttributeOverlap,
} from "./product-attributes.js";

const DEFAULT_TOP_N = 8;
/**
 * Floor after type-only scoring was rejected.
 * Type exact = 40 — alone must NOT pass; need shape/rings/color/material/style.
 */
const MIN_ATTR_SCORE = 52;
/** Softer floor for "similar" — still needs a real trait overlap, not color-only junk. */
const MIN_ATTR_SCORE_SIMILAR = 30;

function hasSecondaryTrait(reasons = []) {
  return reasons.some(
    (r) =>
      r.startsWith("shape:") ||
      r.startsWith("rings:") ||
      r.startsWith("rings_near:") ||
      r.startsWith("color:") ||
      r.startsWith("material:") ||
      r.startsWith("style:") ||
      r.startsWith("size:"),
  );
}

/**
 * @param {object[]} products
 * @param {object} queryAttrs Vision / structured attributes
 * @param {{
 *   topN?: number,
 *   minScore?: number,
 *   locale?: string,
 *   requireType?: boolean,
 *   requireExactType?: boolean,
 *   requireSecondaryTrait?: boolean,
 * }} [options]
 */
export function rankProductsByAttributes(
  products,
  queryAttrs,
  options = {},
) {
  const topN = Math.max(1, options.topN || DEFAULT_TOP_N);
  const minScore = Number.isFinite(options.minScore)
    ? options.minScore
    : MIN_ATTR_SCORE;
  const locale = options.locale || "ar";
  const requireType = options.requireType !== false;
  const requireExactType = options.requireExactType !== false;
  const requireSecondaryTrait = options.requireSecondaryTrait !== false;

  const scored = (products || [])
    .map((product) => {
      const attributes =
        product.attributes || extractProductAttributes(product);
      const overlap = scoreAttributeOverlap(queryAttrs, attributes);
      if (requireType && queryAttrs?.type && !overlap.typeOk) {
        return null;
      }
      if (
        requireExactType &&
        queryAttrs?.type &&
        (overlap.reasons || []).includes("type:near_fixture")
      ) {
        // Keep chandelier↔pendant out of primary ranking.
        return null;
      }
      if (overlap.score < minScore) {
        return null;
      }
      // Reject "any chandelier" dumps when Vision named a type but nothing else matched.
      if (
        requireSecondaryTrait &&
        queryAttrs?.type &&
        !hasSecondaryTrait(overlap.reasons)
      ) {
        return null;
      }
      return {
        product,
        attributes,
        score: overlap.score,
        reasons: overlap.reasons,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const ranked = scored.slice(0, topN).map((row, index) => {
    const attrBits = describeAttributeReasons(row.reasons, locale);
    const prefix =
      locale === "en"
        ? "Closest ENARTE match"
        : "أقرب منتج في كتالوج ENARTE";
    return {
      id: row.product.id,
      title: row.product.title,
      price: row.product.price,
      currency: row.product.currency,
      image: row.product.image,
      url: row.product.url,
      collection: row.product.collection,
      handle: row.product.handle,
      score: Math.round(row.score * 10) / 10,
      rank: index + 1,
      matchReason: [prefix, ...attrBits].filter(Boolean).slice(0, 4).join(" · "),
      attributes: {
        type: row.attributes?.type || null,
        shape: row.attributes?.shape || null,
        rings: row.attributes?.rings ?? null,
        colors: row.attributes?.colors || [],
        materials: row.attributes?.materials || [],
        styles: row.attributes?.styles || [],
        size: row.attributes?.size || null,
      },
    };
  });

  return {
    products: ranked,
    count: ranked.length,
    bestScore: ranked[0]?.score ?? 0,
    searchedProducts: (products || []).length,
  };
}

/**
 * Load full ENARTE Shopify catalog and rank by Vision attributes.
 */
export async function searchCatalogByAttributes({
  attributes,
  shop = null,
  limit = DEFAULT_TOP_N,
  locale = "ar",
  minScore = MIN_ATTR_SCORE,
  requireType = true,
  requireExactType = true,
  requireSecondaryTrait = true,
} = {}) {
  if (!attributes) {
    return {
      ok: true,
      products: [],
      count: 0,
      unavailable: true,
      note: "missing_attributes",
      engine: "shopify-attribute-rank",
    };
  }

  const { loadEnarteCatalogForVisualSearch } = await import(
    "../shopify-products.server.js"
  );
  const catalog = await loadEnarteCatalogForVisualSearch({ shop });
  const ranked = rankProductsByAttributes(catalog.products || [], attributes, {
    topN: limit,
    minScore,
    locale,
    requireType,
    requireExactType,
    requireSecondaryTrait,
  });

  return {
    ok: true,
    products: ranked.products,
    count: ranked.count,
    unavailable: ranked.count === 0,
    bestScore: ranked.bestScore,
    searchedProducts: ranked.searchedProducts,
    note: ranked.count ? "attribute_match" : "no_attribute_match",
    engine: "shopify-attribute-rank",
    shop: catalog.shop || shop || null,
    attributes,
  };
}

export { MIN_ATTR_SCORE, MIN_ATTR_SCORE_SIMILAR };
