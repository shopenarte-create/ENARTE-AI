/**
 * Configurable ENARTE recommendation engine settings.
 * Tune weights / vocab here — do not hardcode product IDs or titles elsewhere.
 */

/** Phase 4 intelligent recommendation engine. */
export const RECOMMENDATION_VERSION = "recommendation.engine.phase4.v1";

/** How many products to return to the customer. */
export const TOP_N = 3;

/**
 * Phase 2 Shopify metafield namespace/keys for AI product enrichment.
 * Ready for a future Admin button that analyzes each product and writes these.
 * Namespace: app.enarte_ai (Shopify app-owned metafields).
 */
export const PRODUCT_AI_METAFIELD_NAMESPACE = "enarte_ai";

export const PRODUCT_AI_METAFIELD_KEYS = Object.freeze({
  recommendedRoomTypes: "recommended_room_types",
  recommendedRoomSize: "recommended_room_size",
  recommendedCeilingHeight: "recommended_ceiling_height",
  recommendedStyle: "recommended_style",
  recommendedAreaM2: "recommended_area_m2",
  installationType: "installation_type",
  hangingLength: "hanging_length",
  luxuryLevel: "luxury_level",
});

/**
 * Scoring weights (configurable). Higher = stronger influence.
 * Phase 1 uses catalog fields; Phase 2 metadata uses metadata* weights when present.
 */
export const SCORE_WEIGHTS = Object.freeze({
  lightingRelevance: 12,
  roomTypeMatch: 18,
  roomSizeMatch: 14,
  ceilingMatch: 10,
  styleMatch: 14,
  budgetFit: 8,
  titleToken: 3,
  productTypeToken: 4,
  categoryToken: 4,
  tagToken: 4,
  collectionHint: 3,
  /** Extra when Phase 2 AI metadata is present and matches */
  metadataRoomType: 22,
  metadataRoomSize: 16,
  metadataCeiling: 12,
  metadataStyle: 16,
  metadataLuxury: 6,
});

/**
 * Room-type vocabulary inferred from Arabic/English analysis text.
 * Maps canonical id → detection keywords in the analysis.
 */
export const ROOM_TYPE_VOCAB = Object.freeze({
  living_room: ["غرفة معيشة", "معيشة", "living room", "living"],
  salon: ["صالون", "salon"],
  guest_room: ["غرفة ضيوف", "ضيوف", "guest"],
  dining_room: ["غرفة طعام", "طعام", "dining"],
  large_bedroom: ["غرفة نوم كبيرة", "نوم كبيرة", "large bedroom", "master bedroom"],
  small_bedroom: ["غرفة نوم صغيرة", "نوم صغيرة", "small bedroom", "bedroom"],
  hallway: ["ممر", "hallway", "corridor"],
  entrance: ["مدخل", "entrance", "foyer"],
  kitchen: ["مطبخ", "kitchen"],
  office: ["مكتب", "office", "study"],
  compact_space: ["مساحة صغيرة", "compact", "صغير"],
});

/** Room types that prefer larger fixtures (chandeliers). */
export const LARGE_FIXTURE_ROOM_TYPES = Object.freeze([
  "living_room",
  "salon",
  "guest_room",
  "dining_room",
  "large_bedroom",
]);

/** Room types that prefer compact fixtures (pendants / wall lights). */
export const COMPACT_FIXTURE_ROOM_TYPES = Object.freeze([
  "small_bedroom",
  "hallway",
  "entrance",
  "kitchen",
  "office",
  "compact_space",
]);

export const ROOM_SIZE_VOCAB = Object.freeze({
  large: ["كبيرة", "واسع", "واسعة", "كبير", "large", "spacious", "wide"],
  medium: ["متوسطة", "متوسط", "medium", "moderate"],
  small: ["صغيرة", "صغير", "ضيق", "ضيقة", "small", "compact", "narrow"],
});

export const CEILING_HEIGHT_VOCAB = Object.freeze({
  high: ["سقف مرتفع", "مرتفع", "عالي", "high ceiling", "tall ceiling", "high"],
  standard: ["سقف عادي", "متوسط الارتفاع", "standard ceiling", "normal ceiling"],
  low: ["سقف منخفض", "منخفض", "low ceiling", "low"],
});

export const STYLE_VOCAB = Object.freeze({
  modern: ["مودرن", "عصري", "حديث", "modern", "contemporary"],
  classic: ["كلاسيك", "كلاسيكي", "classic", "traditional"],
  luxury: ["فاخر", "فخمة", "luxury", "luxurious", "elegant", "أنيق"],
  crystal: ["كريستال", "crystal"],
  gold: ["ذهبي", "ذهب", "gold", "golden"],
  minimal: ["بسيط", "مينيمال", "minimal", "minimalist"],
  industrial: ["صناعي", "industrial"],
  led: ["led", "إل إي دي", "اضاءة ليد"],
});

/**
 * Product catalog signals (Phase 1 fallback when AI metadata is absent).
 * Maps room/fixture intent → keywords found in title/type/category/tags.
 */
export const PRODUCT_SIGNAL_VOCAB = Object.freeze({
  lighting: [
    "ثريا",
    "chandelier",
    "pendant",
    "led",
    "أبليك",
    "إنارة",
    "اضاءة",
    "إضاءة",
    "lighting",
    "light fixture",
    "lamp",
    "لامب",
    "سقف",
    "ceiling",
    "wall light",
  ],
  chandelier: [
    "ثريا",
    "chandelier",
    "chandeliers",
    "ceiling light",
    "pendant light fixtures",
  ],
  pendant: [
    "pendant",
    "led pendants",
    "أبليك",
    "wall light",
    "sconce",
    "wall light fixtures",
  ],
  luxury: ["فاخر", "luxury", "كريستال", "crystal", "ذهبي", "gold"],
  modern: ["مودرن", "modern", "عصري", "led"],
  classic: ["كلاسيك", "classic"],
});

/**
 * GraphQL metafield identifiers to request later when enriching products.
 * Not queried in Phase 1 (fields usually empty); engine already accepts them.
 */
export function buildProductAiMetafieldQueryAliases() {
  return Object.entries(PRODUCT_AI_METAFIELD_KEYS).map(([alias, key]) => ({
    alias,
    namespace: PRODUCT_AI_METAFIELD_NAMESPACE,
    key,
  }));
}
