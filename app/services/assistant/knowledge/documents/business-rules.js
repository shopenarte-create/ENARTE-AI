/**
 * Knowledge Module 2 — business_rules
 * Content provided by ENARTE. Do not invent or alter business meaning.
 */

import { KNOWLEDGE_MODULE_ID } from "../constants.js";
import { createBusinessRulesContent } from "../schemas/content.js";

/**
 * Structured ENARTE business rules (exact business knowledge).
 */
export function buildBusinessRulesContent() {
  return createBusinessRulesContent({
    delivery: {
      amman: {
        minHours: 6,
        maxHours: 8,
        unit: "hours",
      },
      otherCities: {
        configurableLater: true,
      },
      messages: {
        ar: "التوصيل داخل عمّان خلال 6–8 ساعات. أوقات التوصيل للمدن الأخرى ستُضبط لاحقاً.",
        en: "Delivery inside Amman: 6–8 hours. Delivery times for other cities will be configurable later.",
      },
    },
    installationMaintenance: {
      available: true,
      services: Object.freeze([
        "installation",
        "maintenance",
        "site_inspection",
      ]),
      contact: {
        phone: "+962782404023",
        forServices: Object.freeze([
          "installation",
          "maintenance",
          "site_inspection",
        ]),
      },
      messages: {
        ar: `خدمات التركيب والصيانة ومعاينة الموقع متاحة. التواصل عبر 00962782404023.`,
        en: `Installation, maintenance, and site inspection are available. Contact 00962782404023.`,
      },
    },
    garageLighting: {
      considerRainAndHumidity: true,
      recommendOnlyOutdoorWeatherResistant: true,
      messages: {
        ar: "إضاءة الكراج قد تتعرض للمطر والرطوبة؛ نوصي فقط بإضاءة خارجية/مقاومة للعوامل الجوية المناسبة.",
        en: "Garages may be exposed to rain and humidity. Recommend only suitable outdoor/weather-resistant lighting.",
      },
    },
    productSearch: {
      searchEnarteCatalogOnly: true,
      neverSearchInternet: true,
      neverRecommendOutsideEnarte: true,
    },
    unavailableProducts: {
      informTrySourceWithinDays: 3,
      informIfUnsuccessfulWithinHours: 24,
      createProductSourcingRequest: true,
      messages: {
        ar: "سنحاول تأمين طلبك خلال ثلاثة أيام. يمكنك تأكيد الطلب عن طريق إرسال طلبك للرقم 00962792404023",
        en: "We will try to source your request within three days. You can confirm by sending your request to 00962792404023",
      },
    },
    returnsExchange: {
      withinHours: 24,
      allowExchange: true,
      allowReturn: true,
      condition: "if_unsatisfied_in_person",
      messages: {
        ar: "يمكنك استبدال أو ترجيع المنتج خلال 24 ساعة في حال عدم الاقتناع بالمنتج على الواقع.",
        en: "You can exchange or return the product within 24 hours if you are not satisfied with it in person.",
      },
    },
    roomRecommendation: {
      offerRoomPhotoAnalysisWhenLookingForRoomLighting: true,
      explainCanRecommendSuitableLighting: true,
      explainVirtualPlacementLater: true,
      messages: {
        ar: "إذا كنت تبحث عن إضاءة لغرفة، يمكننا تحليل صورة الغرفة واقتراح إضاءة مناسبة، ولاحقاً تجربة المنتجات داخل الغرفة افتراضياً.",
        en: "If you are looking for lighting for a room, we can offer room photo analysis, recommend suitable lighting, and later virtually place products inside the room.",
      },
    },
    imageSearch: {
      offerWheneverAppropriate: true,
      searchSameOrClosestEnarteOnly: true,
      messages: {
        ar: "يمكن البحث بالصورة عن نفس منتج ENARTE أو الأقرب مطابقة.",
        en: "Image search can find the same or the closest matching ENARTE product.",
      },
    },
    buttonsPolicy: {
      preferSmartActionButtons: true,
      keepConversationSimpleAndFast: true,
    },
    generalRules: {
      doNotInventInformation: true,
      doNotInventProducts: true,
      doNotInventPrices: true,
      doNotInventAvailability: true,
      alwaysRelyOnEnarteKnowledgeAndCatalog: true,
    },
    rules: Object.freeze([
      Object.freeze({
        id: "delivery.amman",
        category: "delivery",
        summary: "Delivery inside Amman: 6–8 hours.",
      }),
      Object.freeze({
        id: "delivery.other_cities",
        category: "delivery",
        summary: "Delivery times for other cities will be configurable later.",
      }),
      Object.freeze({
        id: "services.installation_maintenance_contact",
        category: "installation_maintenance",
        summary:
          "Direct customers to +962782404023 for installation, maintenance, and site inspection.",
      }),
      Object.freeze({
        id: "garage.weather_resistant_only",
        category: "garage_lighting",
        summary:
          "For garage lighting, consider rain/humidity; recommend only outdoor/weather-resistant lighting.",
      }),
      Object.freeze({
        id: "catalog.enarte_only",
        category: "product_search",
        summary:
          "Search only the ENARTE catalog; never search the internet or recommend outside ENARTE.",
      }),
      Object.freeze({
        id: "sourcing.unavailable_product",
        category: "unavailable_products",
        summary:
          "If product does not exist: try source within 3 days; notify within 24 hours if unsuccessful; create Product Sourcing Request.",
      }),
      Object.freeze({
        id: "returns.exchange_within_24h",
        category: "returns_exchange",
        summary:
          "Customer may exchange or return within 24 hours if unsatisfied with the product in person.",
      }),
      Object.freeze({
        id: "room.offer_photo_analysis",
        category: "room_recommendation",
        summary:
          "When looking for room lighting, offer room photo analysis, recommend suitable lighting, and explain virtual placement later.",
      }),
      Object.freeze({
        id: "image.offer_search",
        category: "image_search",
        summary:
          "Offer image search whenever appropriate; match same or closest ENARTE product.",
      }),
      Object.freeze({
        id: "ux.prefer_smart_buttons",
        category: "buttons_policy",
        summary:
          "Prefer Smart Action Buttons; keep the conversation simple and fast.",
      }),
      Object.freeze({
        id: "general.no_invention",
        category: "general",
        summary:
          "Do not invent information, products, prices, or availability; rely on ENARTE knowledge and catalog.",
      }),
    ]),
    policies: Object.freeze([
      Object.freeze({
        id: "policy.enarte_catalog_boundary",
        summary: "Never search the internet or recommend non-ENARTE products.",
      }),
      Object.freeze({
        id: "policy.no_invention",
        summary:
          "Do not invent information, products, prices, or availability.",
      }),
    ]),
    escalation: {
      channels: Object.freeze([
        Object.freeze({
          type: "phone",
          value: "+962782404023",
          purpose: Object.freeze([
            "installation",
            "maintenance",
            "site_inspection",
          ]),
        }),
      ]),
    },
  });
}

export const BUSINESS_RULES_MODULE_ID = KNOWLEDGE_MODULE_ID.BUSINESS_RULES;

export const BUSINESS_RULES_VERSION = "1.0.0";
