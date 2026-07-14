/**
 * ENARTE Phase 4 — Intelligent Recommendation Engine.
 *
 * Active:
 * - Room profile from existing analysis text (type/size/ceiling/style/budget)
 * - Configurable scoring over Product Type / Category / Tags / Title
 * - Top 3 recommendations
 *
 * Prepared (not implemented):
 * - AI product metafields + Admin enrichment roadmap
 * - See future-extensions.js for reserved module IDs
 */

export {
  RECOMMENDATION_VERSION,
  TOP_N,
  SCORE_WEIGHTS,
  PRODUCT_AI_METAFIELD_NAMESPACE,
  PRODUCT_AI_METAFIELD_KEYS,
  buildProductAiMetafieldQueryAliases,
} from "./config.js";

export { buildRoomProfileFromAnalysis } from "./room-profile.js";
export {
  resolveProductAiMetadata,
  buildCatalogSignals,
  buildProductAiEnrichmentPlan,
} from "./product-metadata.js";
export { scoreProduct, rankProducts } from "./score.js";
export { runRecommendationEngine } from "./engine.js";
export {
  FUTURE_EXTENSIONS,
  FUTURE_EXTENSION_STATUS,
  getFutureExtension,
  findSimilarProductsPlaceholder,
} from "./future-extensions.js";
