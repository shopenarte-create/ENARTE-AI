import { PRODUCT_AI_METAFIELD_KEYS } from "./config.js";

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (value == null || value === "") {
    return [];
  }
  return String(value)
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeScalar(value) {
  if (value == null || value === "") {
    return null;
  }
  return String(value).trim();
}

/**
 * Phase 2 product AI metadata shape.
 * Populated from Shopify metafields when present; otherwise null/empty
 * so scoring falls back to Product Type / Category / Title / Tags.
 */

/**
 * Read AI metadata from a product object.
 * Accepts either:
 * - product.aiMetadata (already normalized)
 * - product.metafields / product.enarteAiMetafields (raw Shopify values)
 *
 * Future: Admin "Analyze product" button writes these metafields;
 * this reader will pick them up with no scoring-code rewrite.
 */
export function resolveProductAiMetadata(product = {}) {
  if (product.aiMetadata && typeof product.aiMetadata === "object") {
    return normalizeMetadataRecord(product.aiMetadata);
  }

  const fromMetafields = readFromMetafieldContainers(product);
  return normalizeMetadataRecord(fromMetafields);
}

function readFromMetafieldContainers(product) {
  const containers = [
    product.enarteAiMetafields,
    product.metafields,
    product.metafield,
  ].filter(Boolean);

  const bag = {};

  for (const container of containers) {
    if (Array.isArray(container)) {
      for (const field of container) {
        const key = field?.key || field?.keyName;
        const value = field?.value ?? field?.jsonValue;
        if (key) {
          bag[key] = value;
        }
      }
      continue;
    }

    if (typeof container === "object") {
      Object.assign(bag, container);
    }
  }

  return {
    recommendedRoomTypes:
      bag[PRODUCT_AI_METAFIELD_KEYS.recommendedRoomTypes] ??
      bag.recommended_room_types,
    recommendedRoomSize:
      bag[PRODUCT_AI_METAFIELD_KEYS.recommendedRoomSize] ??
      bag.recommended_room_size,
    recommendedCeilingHeight:
      bag[PRODUCT_AI_METAFIELD_KEYS.recommendedCeilingHeight] ??
      bag.recommended_ceiling_height,
    recommendedStyle:
      bag[PRODUCT_AI_METAFIELD_KEYS.recommendedStyle] ??
      bag.recommended_style,
    recommendedAreaM2:
      bag[PRODUCT_AI_METAFIELD_KEYS.recommendedAreaM2] ??
      bag.recommended_area_m2,
    installationType:
      bag[PRODUCT_AI_METAFIELD_KEYS.installationType] ??
      bag.installation_type,
    hangingLength:
      bag[PRODUCT_AI_METAFIELD_KEYS.hangingLength] ?? bag.hanging_length,
    luxuryLevel:
      bag[PRODUCT_AI_METAFIELD_KEYS.luxuryLevel] ?? bag.luxury_level,
  };
}

function normalizeMetadataRecord(raw = {}) {
  const recommendedRoomTypes = normalizeList(raw.recommendedRoomTypes);
  const recommendedStyle = normalizeList(raw.recommendedStyle);
  const recommendedRoomSize = normalizeScalar(raw.recommendedRoomSize);
  const recommendedCeilingHeight = normalizeScalar(
    raw.recommendedCeilingHeight,
  );
  const installationType = normalizeScalar(raw.installationType);
  const hangingLength = normalizeScalar(raw.hangingLength);
  const luxuryLevel = normalizeScalar(raw.luxuryLevel);

  let recommendedAreaM2 = null;
  if (raw.recommendedAreaM2 != null && raw.recommendedAreaM2 !== "") {
    const parsed = Number(raw.recommendedAreaM2);
    recommendedAreaM2 = Number.isFinite(parsed) ? parsed : null;
  }

  const hasAny = Boolean(
    recommendedRoomTypes.length ||
      recommendedStyle.length ||
      recommendedRoomSize ||
      recommendedCeilingHeight ||
      recommendedAreaM2 != null ||
      installationType ||
      hangingLength ||
      luxuryLevel,
  );

  return {
    recommendedRoomTypes,
    recommendedRoomSize,
    recommendedCeilingHeight,
    recommendedStyle,
    recommendedAreaM2,
    installationType,
    hangingLength,
    luxuryLevel,
    hasAny,
  };
}

/**
 * Catalog fallback signals used when AI metadata is missing (Phase 1).
 */
export function buildCatalogSignals(product = {}) {
  const tags = Array.isArray(product.tags)
    ? product.tags
    : String(product.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

  return {
    title: String(product.title || ""),
    productType: String(product.productType || ""),
    categoryName: String(product.categoryName || ""),
    categoryFullName: String(product.categoryFullName || ""),
    tags,
    collection: String(product.collection || ""),
    handle: String(product.handle || ""),
    blob: [
      product.title,
      product.productType,
      product.categoryName,
      product.categoryFullName,
      ...tags,
      product.collection,
      product.handle,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

/**
 * Placeholder for Phase 2 Admin action:
 * analyze a Shopify product with AI and return metafield write payload.
 * Not implemented yet — architecture hook only.
 */
export function buildProductAiEnrichmentPlan(product) {
  return {
    status: "not_implemented",
    productId: product?.id || null,
    namespace: "enarte_ai",
    fields: Object.values(PRODUCT_AI_METAFIELD_KEYS),
    note:
      "Future: Admin button calls OpenAI on product image/title and writes these metafields.",
  };
}
