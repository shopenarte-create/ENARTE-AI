/**
 * Future roadmap extension points (architecture only — NOT implemented).
 *
 * These stubs reserve stable module IDs and dependency contracts so later
 * phases can plug in without redesigning the recommendation engine.
 *
 * DO NOT implement business logic here until the matching phase is approved.
 */

export const FUTURE_EXTENSION_STATUS = Object.freeze({
  PLANNED: "planned",
  NOT_IMPLEMENTED: "not_implemented",
});

/**
 * Reserved future modules (Admin / enrichment / compositing).
 * Each entry documents where it will attach later.
 */
export const FUTURE_EXTENSIONS = Object.freeze({
  AI_PRODUCT_MANAGER: {
    id: "ai_product_manager",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["shopify.admin", "recommendation.product-metadata"],
    description: "Admin hub for AI product enrichment tools.",
  },
  AI_ANALYZE_PRODUCT_BUTTON: {
    id: "ai_analyze_product_button",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["product-metadata.buildProductAiEnrichmentPlan"],
    description:
      "Button that analyzes a Shopify product and writes enarte_ai metafields.",
  },
  AUTO_ENRICH_ALIBABA: {
    id: "auto_enrich_alibaba",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["AI_ANALYZE_PRODUCT_BUTTON"],
    description: "Import/enrich products from Alibaba listings.",
  },
  AUTO_ENRICH_MADE_IN_CHINA: {
    id: "auto_enrich_made_in_china",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["AI_ANALYZE_PRODUCT_BUTTON"],
    description: "Import/enrich products from Made-in-China listings.",
  },
  AUTO_ENRICH_ALIEXPRESS: {
    id: "auto_enrich_aliexpress",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["AI_ANALYZE_PRODUCT_BUTTON"],
    description: "Import/enrich products from AliExpress listings.",
  },
  AI_PRODUCT_CLASSIFICATION: {
    id: "ai_product_classification",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["recommendation.config", "product-metadata"],
    description: "Classify fixtures into chandelier/pendant/etc.",
  },
  AI_DESCRIPTION_WRITER: {
    id: "ai_description_writer",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["AI_PRODUCT_MANAGER"],
    description: "Generate Arabic/English product descriptions.",
  },
  AI_IMAGE_ENHANCEMENT: {
    id: "ai_image_enhancement",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["AI_PRODUCT_MANAGER"],
    description: "Enhance product images for storefront quality.",
  },
  AI_DUPLICATE_DETECTION: {
    id: "ai_duplicate_detection",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["AI_PRODUCT_MANAGER"],
    description: "Detect duplicate or near-duplicate catalog items.",
  },
  AI_SIMILAR_PRODUCT_FINDER: {
    id: "ai_similar_product_finder",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["recommendation.engine"],
    description: "Find similar products when exact matches are weak.",
  },
  AUTOMATIC_METADATA_GENERATION: {
    id: "automatic_metadata_generation",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "admin_only",
    attachesTo: ["product-metadata", "PRODUCT_AI_METAFIELD_KEYS"],
    description:
      "Batch-generate recommended_room_types and related metafields.",
  },
  TRY_IT_IN_YOUR_ROOM: {
    id: "try_it_in_your_room",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "customer",
    attachesTo: [
      "recommendation.engine",
      "customer.upload",
      "placement.markers",
      "placement.buildVirtualPlacementPlan",
    ],
    description:
      "Realistic chandelier placement into the uploaded room photo per marker.",
  },
  LIGHTING_PLACEMENT_MARKERS: {
    id: "lighting_placement_markers",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "customer",
    attachesTo: ["placement.markers", "recommendation.engine"],
    description:
      "Phase 5 active UI: customer clicks ceiling positions; each marker gets recommendations and later a generated fixture.",
  },
  AI_ASSISTANT: {
    id: "ai_assistant",
    status: FUTURE_EXTENSION_STATUS.PLANNED,
    audience: "customer_and_admin",
    attachesTo: [
      "services.assistant",
      "assistant.ports",
      "assistant.workflows",
    ],
    description:
      "ENARTE AI Assistant vertical (Phase 1 foundation under app/services/assistant). Independent of storefront try UI; connects via extension ports.",
  },
});

/**
 * Resolve a future extension contract. Always returns not_implemented for now.
 */
export function getFutureExtension(extensionId) {
  const byKey = FUTURE_EXTENSIONS[extensionId];
  const byId = Object.values(FUTURE_EXTENSIONS).find(
    (item) => item.id === extensionId,
  );
  const entry = byKey || byId;

  if (!entry) {
    return {
      id: extensionId,
      status: FUTURE_EXTENSION_STATUS.NOT_IMPLEMENTED,
      available: false,
    };
  }

  return {
    ...entry,
    available: false,
    status: FUTURE_EXTENSION_STATUS.NOT_IMPLEMENTED,
  };
}

/**
 * Stable hook the recommendation engine can call later for similar-product
 * fallback without changing the Phase 4 scoring API.
 */
export function findSimilarProductsPlaceholder() {
  return {
    status: FUTURE_EXTENSION_STATUS.NOT_IMPLEMENTED,
    products: [],
    note: "Reserved for AI_SIMILAR_PRODUCT_FINDER phase.",
  };
}
