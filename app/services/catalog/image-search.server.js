/**
 * Image search orchestrator:
 * 1) Vision → structured attributes → Shopify attribute ranking (strict)
 * 2) Soft similar (same type, lower floor)
 * 3) Fingerprint fallback filtered by Vision type when available
 * 4) Unavailable → WhatsApp sourcing message (ENARTE only)
 */

import {
  extractLightingAttributesFromImage,
  hasUsableVisionAttributes,
  LIGHTING_VISION_MODES,
} from "../vision/index.js";
import {
  searchCatalogByAttributes,
  MIN_ATTR_SCORE_SIMILAR,
} from "./attribute-match.server.js";
import { searchCatalogByImage as searchCatalogByVisualFingerprint } from "./visual-match.server.js";

/** True close match: type + multiple traits (not type+one color alone). */
const STRONG_ATTR_SCORE = 72;
/** Below this confidence, skip attribute ranking and go soft/fingerprint. */
const MIN_VISION_CONFIDENCE = 0.45;

export const IMAGE_SEARCH_SOURCING_MESSAGE = Object.freeze({
  ar: "سنحاول تأمين طلبك خلال ثلاثة أيام. يمكنك تأكيد الطلب عن طريق إرسال طلبك للرقم 00962792404023",
  en: "We will try to source your request within three days. You can confirm by sending your request to 00962792404023",
});

export function imageSearchSourcingMessage(locale = "ar") {
  return String(locale || "ar").toLowerCase().startsWith("en")
    ? IMAGE_SEARCH_SOURCING_MESSAGE.en
    : IMAGE_SEARCH_SOURCING_MESSAGE.ar;
}

function withSourcing(result, locale, { mode, unavailable }) {
  const sourcingMessage = imageSearchSourcingMessage(locale);
  const showSourcingOffer = unavailable || mode === "similar";
  return {
    ...result,
    ok: true,
    mode,
    unavailable: Boolean(unavailable),
    showSourcingOffer,
    sourcingMessage: showSourcingOffer ? sourcingMessage : null,
  };
}

function filterProductsByType(products, type) {
  if (!type || !products?.length) return products || [];
  return products.filter((p) => {
    const t = p.attributes?.type || null;
    if (!t) return true;
    if (t === type) return true;
    // Allow pendant↔chandelier only in fingerprint similar lists.
    if (
      (type === "chandelier" && t === "pendant") ||
      (type === "pendant" && t === "chandelier")
    ) {
      return true;
    }
    return false;
  });
}

/**
 * @param {object} options
 * @param {Buffer} options.imageBuffer
 * @param {string} [options.shop]
 * @param {number} [options.limit]
 * @param {string} [options.locale]
 */
export async function searchCatalogByImage({
  imageBuffer,
  shop = null,
  limit = 8,
  locale = "ar",
} = {}) {
  if (!imageBuffer?.length) {
    return withSourcing(
      {
        error: "missing_image",
        products: [],
        count: 0,
        engine: "vision-attributes+shopify",
      },
      locale,
      { mode: "unavailable", unavailable: true },
    );
  }

  const vision = await extractLightingAttributesFromImage({
    imageBuffer,
    mode: LIGHTING_VISION_MODES.PRODUCT,
  });

  const visionUsable =
    vision.ok &&
    hasUsableVisionAttributes(vision.attributes) &&
    (vision.attributes?.confidence == null ||
      vision.attributes.confidence >= MIN_VISION_CONFIDENCE);

  if (visionUsable) {
    // Path A1 — strict: exact type + secondary trait
    const attrResult = await searchCatalogByAttributes({
      attributes: vision.attributes,
      shop,
      limit,
      locale,
      requireType: true,
      requireExactType: true,
      requireSecondaryTrait: true,
    });

    if (attrResult.count > 0) {
      const strong = (attrResult.bestScore || 0) >= STRONG_ATTR_SCORE;
      return withSourcing(
        {
          ...attrResult,
          engine: "vision-attributes+shopify",
          vision: {
            used: true,
            ok: true,
            attributes: vision.attributes,
            error: null,
          },
          fallback: null,
        },
        locale,
        {
          mode: strong ? "match" : "similar",
          unavailable: false,
        },
      );
    }

    // Path A2 — soft similar: same type family, lower floor, still needs a trait
    const softAttr = await searchCatalogByAttributes({
      attributes: vision.attributes,
      shop,
      limit,
      locale,
      minScore: MIN_ATTR_SCORE_SIMILAR,
      requireType: true,
      requireExactType: false,
      requireSecondaryTrait: true,
    });
    if (softAttr.count > 0) {
      return withSourcing(
        {
          ...softAttr,
          engine: "vision-attributes+shopify-similar",
          note: "similar_attribute_match",
          vision: {
            used: true,
            ok: true,
            attributes: vision.attributes,
            error: null,
          },
          fallback: null,
        },
        locale,
        { mode: "similar", unavailable: false },
      );
    }
  }

  // Path B — fingerprint (always presented as similar, never confident match)
  const visual = await searchCatalogByVisualFingerprint({
    imageBuffer,
    shop,
    limit: Math.max(limit, 12),
  });

  if (visual?.products?.length) {
    const typed = filterProductsByType(
      visual.products,
      vision.attributes?.type || null,
    ).slice(0, limit);

    if (typed.length) {
      return withSourcing(
        {
          ...visual,
          products: typed,
          count: typed.length,
          unavailable: false,
          vision: {
            used: Boolean(vision.ok),
            ok: Boolean(vision.ok),
            attributes: vision.attributes || null,
            error: vision.ok ? null : vision.error || "vision_unavailable",
          },
          fallback: visionUsable
            ? "visual-fingerprint-similar"
            : "visual-fingerprint",
          engine: visual.engine
            ? `${visual.engine}+similar`
            : "shopify-fingerprint-similar",
        },
        locale,
        { mode: "similar", unavailable: false },
      );
    }
  }

  return withSourcing(
    {
      products: [],
      count: 0,
      engine: vision.ok
        ? "vision-attributes+shopify"
        : "shopify-fingerprint-fallback",
      vision: {
        used: Boolean(vision.ok),
        ok: Boolean(vision.ok),
        attributes: vision.attributes || null,
        error: vision.ok ? null : vision.error || "vision_unavailable",
      },
      fallback: vision.ok ? null : "visual-fingerprint",
      note: "no_match",
    },
    locale,
    { mode: "unavailable", unavailable: true },
  );
}

export { searchCatalogByVisualFingerprint };
