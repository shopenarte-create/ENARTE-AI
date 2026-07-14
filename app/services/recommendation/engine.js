import {
  RECOMMENDATION_VERSION,
  TOP_N,
} from "./config.js";
import { buildRoomProfileFromAnalysis } from "./room-profile.js";
import { rankProducts } from "./score.js";

/**
 * Configurable recommendation engine entry point.
 *
 * Phase 4: parse room analysis → score catalog fields → top 3
 * Phase 5: optional marker zone hint for per-position recommendations
 *
 * @param {object} params
 * @param {string} params.analysisText
 * @param {object} params.budgetRange
 * @param {object[]} params.products
 * @param {number} [params.limit]
 * @param {{ zone?: string, labelAr?: string, fixturePreference?: string }|null} [params.markerZone]
 */
export function runRecommendationEngine({
  analysisText = "",
  budgetRange = null,
  products = [],
  limit = TOP_N,
  markerZone = null,
} = {}) {
  const enrichedAnalysis = markerZone?.labelAr
    ? `${analysisText}\n\nنقطة التركيب المحددة: ${markerZone.labelAr}`
    : analysisText;

  const roomProfile = buildRoomProfileFromAnalysis(
    enrichedAnalysis,
    budgetRange,
  );

  if (
    markerZone?.fixturePreference &&
    markerZone.fixturePreference !== "any"
  ) {
    roomProfile.fixturePreference = markerZone.fixturePreference;
  }

  const ranked = rankProducts(products, roomProfile, limit);

  return {
    version: RECOMMENDATION_VERSION,
    roomProfile: {
      roomType: roomProfile.roomType,
      roomSize: roomProfile.roomSize,
      ceilingHeight: roomProfile.ceilingHeight,
      styles: roomProfile.styles,
      fixturePreference: roomProfile.fixturePreference,
      budget: roomProfile.budget,
      markerZone: markerZone
        ? {
            zone: markerZone.zone,
            labelAr: markerZone.labelAr,
          }
        : null,
    },
    products: ranked.map((entry) => entry.product),
    rankings: ranked.map((entry) => ({
      id: entry.product.id,
      title: entry.product.title,
      score: entry.score,
      usedMetadata: entry.usedMetadata,
      breakdown: entry.breakdown,
    })),
    count: ranked.length,
  };
}
