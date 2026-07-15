import { resolveCatalogProducts } from "./adapters/enarte-catalog.adapter.js";

/**
 * @param {object|null|undefined} product
 */
function normalizeProduct(product) {
  if (!product) return null;
  return {
    id: product.id || product.productId || null,
    title: product.title || product.name || "",
    image: product.image || product.imageUrl || product.featuredImage || null,
    price: product.price ?? null,
    currency: product.currency || "JOD",
    url: product.url || product.onlineStoreUrl || null,
    collection: product.collection || null,
  };
}

/**
 * Resolve one product per mount.
 * Locked product → same SKU on every mount.
 * Else catalog picks (cycled if pool smaller than count).
 *
 * @param {{
 *   layout: import('./types.js').LayoutPlan,
 *   lockedProduct?: object|null,
 *   analysis?: import('./types.js').RoomAnalysis,
 *   budgetId?: string,
 *   shop?: string|null,
 * }} input
 * @returns {Promise<import('./types.js').FixtureSpec[]>}
 */
export async function resolveFixtureProducts(input) {
  const {
    layout,
    lockedProduct = null,
    analysis = null,
    budgetId,
    shop = null,
  } = input;

  const mounts = layout?.mounts || [];
  if (!mounts.length) {
    throw new Error("Layout has no mount points");
  }

  const locked = normalizeProduct(lockedProduct);
  let catalogProducts = [];

  if (!locked) {
    const resolved = await resolveCatalogProducts({
      analysisText: analysis?.summaryAr || analysis?.rawText || "",
      budgetId,
      count: mounts.length,
      shop,
    });
    catalogProducts = resolved.products || [];
    if (!catalogProducts.length) {
      throw new Error("لا تتوفر منتجات مناسبة من الكتالوج لهذه الغرفة.");
    }
  }

  return mounts.map((m, index) => {
    const product = locked
      ? locked
      : normalizeProduct(catalogProducts[index % catalogProducts.length]);

    return {
      id: m.id,
      x: m.x,
      y: m.y,
      scaleRatio: m.scaleRatio ?? 1,
      fixtureKind: m.fixtureKind || layout.fixtureKind || "chandelier",
      product,
      lightingType: "enarte_decide",
    };
  });
}
