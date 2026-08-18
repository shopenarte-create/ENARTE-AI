/**
 * Structured product card contract for assistant workflows.
 * Cards are built only from ENARTE Shopify catalog data.
 */

import { toEnarteStoreUrl } from "../core/domain-scope.js";

/**
 * @typedef {object} ProductCard
 * @property {string} id
 * @property {string} title
 * @property {string|null} image
 * @property {string|null} price
 * @property {string} currency
 * @property {string} availability
 * @property {string} url
 * @property {string|null} collection
 * @property {string[]} tags
 * @property {number} [score]
 * @property {string} [matchType] exact | ranked | similar
 * @property {number} [rank] 1 = best match
 * @property {string|null} [matchReason] short human why this fits
 */

/**
 * Map a Shopify catalog product into a stable product card.
 * @param {object} product
 * @param {object} [extra]
 * @returns {ProductCard}
 */
export function toProductCard(product, extra = {}) {
  if (!product?.id) {
    throw new Error("toProductCard requires a product with id.");
  }

  const availability =
    extra.availability ||
    (product.availability != null
      ? product.availability
      : "available");

  return Object.freeze({
    id: product.id,
    title: product.title || "",
    image: product.image || null,
    price: product.price != null ? String(product.price) : null,
    currency: product.currency || "JOD",
    availability,
    url: toEnarteStoreUrl(product.url, product.handle) || product.url || "",
    collection: product.collection || null,
    tags: Object.freeze([
      ...(Array.isArray(product.tags) ? product.tags : []),
    ]),
    score: typeof extra.score === "number" ? extra.score : extra.score ?? null,
    matchType: extra.matchType || null,
    rank: typeof extra.rank === "number" ? extra.rank : null,
    matchReason: extra.matchReason || null,
  });
}

export function toProductCards(products, mapExtra) {
  return Object.freeze(
    (products || []).map((product, index) =>
      toProductCard(
        product,
        typeof mapExtra === "function" ? mapExtra(product, index) : mapExtra || {},
      ),
    ),
  );
}
