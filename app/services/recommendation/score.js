import {
  PRODUCT_SIGNAL_VOCAB,
  SCORE_WEIGHTS,
} from "./config.js";
import {
  buildCatalogSignals,
  resolveProductAiMetadata,
} from "./product-metadata.js";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function textHasAny(haystack, keywords) {
  const text = normalizeText(haystack);
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function listIncludesNormalized(list, value) {
  const target = normalizeText(value);
  return (list || []).some((item) => normalizeText(item) === target);
}

/**
 * Score one product against a room profile.
 * Prefers Phase 2 AI metadata when present; otherwise Product Type / Category / Title / Tags.
 *
 * @returns {{ score: number, breakdown: Record<string, number>, usedMetadata: boolean }}
 */
export function scoreProduct(product, roomProfile) {
  const weights = SCORE_WEIGHTS;
  const breakdown = {};
  let score = 0;
  const add = (key, points) => {
    if (!points) return;
    breakdown[key] = (breakdown[key] || 0) + points;
    score += points;
  };

  const metadata = resolveProductAiMetadata(product);
  const catalog = buildCatalogSignals(product);
  const blob = catalog.blob;

  // Base lighting relevance from catalog fields
  if (textHasAny(blob, PRODUCT_SIGNAL_VOCAB.lighting)) {
    add("lightingRelevance", weights.lightingRelevance);
  }

  // --- Phase 2 metadata path (when fields exist) ---
  if (metadata.hasAny) {
    if (
      metadata.recommendedRoomTypes.length &&
      listIncludesNormalized(
        metadata.recommendedRoomTypes,
        roomProfile.roomType,
      )
    ) {
      add("metadataRoomType", weights.metadataRoomType);
    }

    if (
      metadata.recommendedRoomSize &&
      normalizeText(metadata.recommendedRoomSize) ===
        normalizeText(roomProfile.roomSize)
    ) {
      add("metadataRoomSize", weights.metadataRoomSize);
    }

    if (
      metadata.recommendedCeilingHeight &&
      normalizeText(metadata.recommendedCeilingHeight) ===
        normalizeText(roomProfile.ceilingHeight)
    ) {
      add("metadataCeiling", weights.metadataCeiling);
    }

    if (metadata.recommendedStyle.length && roomProfile.styles.length) {
      const styleHit = roomProfile.styles.some((style) =>
        listIncludesNormalized(metadata.recommendedStyle, style),
      );
      if (styleHit) {
        add("metadataStyle", weights.metadataStyle);
      }
    }

    if (
      metadata.luxuryLevel &&
      (roomProfile.styles.includes("luxury") ||
        roomProfile.styles.includes("crystal") ||
        roomProfile.styles.includes("gold"))
    ) {
      add("metadataLuxury", weights.metadataLuxury);
    }
  }

  // --- Phase 1 catalog fallback (always contributes; primary when no metadata) ---
  if (roomProfile.fixturePreference === "chandelier") {
    if (
      textHasAny(blob, PRODUCT_SIGNAL_VOCAB.chandelier) ||
      catalog.collection === "CHANDELIERS"
    ) {
      add("roomTypeMatch", weights.roomTypeMatch);
    }
  } else if (roomProfile.fixturePreference === "pendant") {
    if (
      textHasAny(blob, PRODUCT_SIGNAL_VOCAB.pendant) ||
      catalog.collection === "LED PENDANTS"
    ) {
      add("roomTypeMatch", weights.roomTypeMatch);
    }
  } else if (textHasAny(blob, PRODUCT_SIGNAL_VOCAB.lighting)) {
    add("roomTypeMatch", Math.round(weights.roomTypeMatch * 0.5));
  }

  if (roomProfile.roomSize === "large") {
    if (textHasAny(blob, PRODUCT_SIGNAL_VOCAB.chandelier)) {
      add("roomSizeMatch", weights.roomSizeMatch);
    }
  } else if (roomProfile.roomSize === "small") {
    if (textHasAny(blob, PRODUCT_SIGNAL_VOCAB.pendant)) {
      add("roomSizeMatch", weights.roomSizeMatch);
    }
  } else {
    add("roomSizeMatch", Math.round(weights.roomSizeMatch * 0.35));
  }

  if (roomProfile.ceilingHeight === "high") {
    if (textHasAny(blob, PRODUCT_SIGNAL_VOCAB.chandelier)) {
      add("ceilingMatch", weights.ceilingMatch);
    }
  } else if (roomProfile.ceilingHeight === "low") {
    if (textHasAny(blob, [...PRODUCT_SIGNAL_VOCAB.pendant, "flat", "فلات"])) {
      add("ceilingMatch", weights.ceilingMatch);
    }
  } else {
    add("ceilingMatch", Math.round(weights.ceilingMatch * 0.3));
  }

  for (const style of roomProfile.styles) {
    const styleKeywords = PRODUCT_SIGNAL_VOCAB[style];
    if (styleKeywords && textHasAny(blob, styleKeywords)) {
      add("styleMatch", weights.styleMatch);
    } else if (
      PRODUCT_SIGNAL_VOCAB.luxury &&
      (style === "luxury" || style === "crystal" || style === "gold") &&
      textHasAny(blob, PRODUCT_SIGNAL_VOCAB.luxury)
    ) {
      add("styleMatch", weights.styleMatch);
    }
  }

  // Token overlap across Title / Product Type / Category / Tags
  for (const token of roomProfile.tokens || []) {
    if (normalizeText(catalog.title).includes(token)) {
      add("titleToken", weights.titleToken);
    }
    if (normalizeText(catalog.productType).includes(token)) {
      add("productTypeToken", weights.productTypeToken);
    }
    if (
      normalizeText(catalog.categoryName).includes(token) ||
      normalizeText(catalog.categoryFullName).includes(token)
    ) {
      add("categoryToken", weights.categoryToken);
    }
    if (
      catalog.tags.some((tag) => normalizeText(tag).includes(token))
    ) {
      add("tagToken", weights.tagToken);
    }
  }

  if (
    catalog.collection === "CHANDELIERS" ||
    catalog.collection === "LED PENDANTS"
  ) {
    add("collectionHint", weights.collectionHint);
  }

  // Soft budget proximity (hard filter applied before scoring)
  if (roomProfile.budget?.hasLimit && product.priceAmount != null) {
    const min = roomProfile.budget.min ?? 0;
    const max = roomProfile.budget.max ?? Number.POSITIVE_INFINITY;
    const mid = (min + (Number.isFinite(max) ? max : min + 50)) / 2;
    const distance = Math.abs(Number(product.priceAmount) - mid);
    const span = Math.max(1, (Number.isFinite(max) ? max : mid + 50) - min);
    const proximity = Math.max(0, 1 - distance / span);
    add("budgetFit", Math.round(weights.budgetFit * proximity));
  }

  return {
    score,
    breakdown,
    usedMetadata: metadata.hasAny,
  };
}

/**
 * Rank products and return the top N with scores.
 */
export function rankProducts(products, roomProfile, limit = 3) {
  const scored = products.map((product) => {
    const result = scoreProduct(product, roomProfile);
    return {
      product,
      score: result.score,
      breakdown: result.breakdown,
      usedMetadata: result.usedMetadata,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const priceA = a.product.priceAmount ?? Number.POSITIVE_INFINITY;
    const priceB = b.product.priceAmount ?? Number.POSITIVE_INFINITY;
    return priceA - priceB;
  });

  return scored.slice(0, limit);
}
