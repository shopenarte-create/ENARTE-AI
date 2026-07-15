/**
 * Brand catalog adapter — only place that knows Shopify/ENARTE collections.
 */

import { recommendProducts } from "../shopify-products.server.js";

/**
 * @param {{ analysisText?: string, budgetId?: string, count?: number, shop?: string|null }} input
 */
export async function resolveCatalogProducts(input = {}) {
  const { analysisText = "", budgetId, count = 1, shop = null } = input;
  const result = await recommendProducts({
    budgetId,
    analysisText,
    markers: [],
    shop,
  });

  const products = Array.isArray(result.products) ? result.products : [];
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    const product = products[i % Math.max(products.length, 1)] || null;
    if (product) picked.push(product);
  }

  return {
    products: picked,
    pool: products,
    shop: result.shop || shop,
    budgetRange: result.budgetRange || null,
    roomProfile: result.roomProfile || null,
  };
}
