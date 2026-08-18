/**
 * Catalog-independent product consultation.
 *
 * Keeps the sales conversation moving when the Shopify catalog is offline
 * or when one more preference is needed before a useful search.
 * Never invents products or prices — Knowledge copy + slot extraction only.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { getPersonalityMessage } from "../knowledge/readers/assistant-personality.js";
import {
  DESCRIBE_STEPS,
  extractDescribeSlots,
} from "./describe-looking-for.js";

/** Lighting / product signals that mean “search or consult”, not small talk. */
const SEARCHABLE_HINT =
  /chandelier|ثريا|ثرية|نجفة|fan|مروحة|pendant|bulb|bulbs|بلب|بلبات|لمبة|لمبات|lamp|light|lighting|إضاءة|إنارة|انارة|outdoor|خارج|sconce|wall\s*light|ceiling|ابجور|أبجور|ستاند|spot|سبوت|led|ليد|fixture|lampshade|نقطتين|نقطة إنارة|تراك|track|بروفايل|profile|مغناطيس|magnetic|كشاف|ديكور\s*إضاءة/i;

const TOPIC_LABEL = Object.freeze({
  chandelier: Object.freeze({ en: "chandeliers", ar: "الثريات" }),
  ceiling: Object.freeze({ en: "ceiling lights", ar: "الإضاءة السقفية" }),
  wall: Object.freeze({ en: "wall lights", ar: "الإضاءة الجدارية" }),
  pendant: Object.freeze({ en: "pendants", ar: "المعلقات" }),
  fan: Object.freeze({ en: "fans", ar: "المراوح" }),
  table: Object.freeze({ en: "table lamps", ar: "أبجورات الطاولة" }),
  floor: Object.freeze({ en: "floor lamps", ar: "ستاند الإنارة" }),
  outdoor: Object.freeze({ en: "outdoor lighting", ar: "الإضاءة الخارجية" }),
  bulb: Object.freeze({ en: "light bulbs", ar: "اللمبات" }),
  other: Object.freeze({ en: "lighting", ar: "الإضاءة" }),
});

/** Sales follow-ups: product type first, then room, then refining prefs. */
const FOLLOW_UP_ORDER = Object.freeze([
  "productType",
  "room",
  "color",
  "style",
  "size",
  "installation",
]);

const FOLLOW_UP_QUESTION = Object.freeze({
  productType: Object.freeze({
    en: "What type of ENARTE lighting are you looking for?",
    ar: "ما نوع إضاءة ENARTE التي تبحث عنها؟",
  }),
  room: Object.freeze({
    en: "Which room is it for?",
    ar: "لأي غرفة؟",
  }),
  color: Object.freeze({
    en: "Any preferred color for the ENARTE pieces?",
    ar: "هل لديك لون مفضل لمنتجات ENARTE؟",
  }),
  style: Object.freeze({
    en: "Do you prefer a specific style?",
    ar: "هل تفضل ستايل معيّن؟",
  }),
  size: Object.freeze({
    en: "What approximate size works best?",
    ar: "ما الحجم التقريبي المناسب؟",
  }),
  installation: Object.freeze({
    en: "Any preference on installation type?",
    ar: "هل لديك تفضيل لنوع التركيب؟",
  }),
});

function useEn(locale) {
  return String(locale || "ar").toLowerCase().startsWith("en");
}

function knowledgeOpts(ctx) {
  return {
    manager: ctx?.knowledge
      ? { get: (id, opts) => ctx.knowledge.get(id, opts) }
      : undefined,
  };
}

/**
 * Merge free-text into describe slots. Never wipes known preferences.
 * @returns {Readonly<Record<string, string>>}
 */
export function mergeConversationSlots(message = "", existing = {}) {
  return Object.freeze({
    ...extractDescribeSlots(message, existing || {}),
  });
}

/**
 * True when slots or message clearly signal a product/lighting ask.
 * Multi-word shopping requests (including out-of-catalog items) still count
 * so the catalog can run and fall through to product sourcing.
 */
export function hasSearchableIntent(slots = {}, message = "") {
  if (
    slots.productType ||
    slots.style ||
    slots.color ||
    slots.room ||
    slots.installation ||
    slots.size
  ) {
    return true;
  }
  const text = String(message || "").trim();
  if (!text) return false;
  if (SEARCHABLE_HINT.test(text)) return true;
  const tokens = text.split(/\s+/).filter((t) => t.length > 2);
  if (
    tokens.length >= 2 &&
    !/^(hi|hello|hey|thanks|thank you|مرحبا|السلام|شكرا)/i.test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Next preference to ask for (one at a time). Prefers room after product type.
 */
export function nextFollowUpSlot(slots = {}) {
  return FOLLOW_UP_ORDER.find((key) => !slots[key]) || null;
}

/**
 * Catalog search artifacts derived from known slots (ENARTE-only keywords).
 */
export function buildSearchArtifactsFromSlots(slots = {}) {
  const keywords = [];
  const tags = [];
  let category = null;

  for (const step of DESCRIBE_STEPS) {
    const id = slots[step];
    if (!id) continue;
    tags.push(id);
    keywords.push(id);
    if (step === "productType") {
      if (id === "chandelier") category = "chandeliers";
      else if (id === "fan") category = "fans";
      else if (id === "outdoor") category = "outdoor";
      else if (id === "bulb") {
        keywords.push("bulb", "bulbs", "light bulb", "لمبة");
      }
    }
  }

  return Object.freeze({
    category,
    keywords: Object.freeze([...new Set(keywords.filter(Boolean))]),
    tags: Object.freeze([...new Set(tags)]),
    describeSlots: Object.freeze({ ...slots }),
  });
}

function topicForSlots(slots, locale) {
  const id = slots.productType || "other";
  const pack = TOPIC_LABEL[id] || TOPIC_LABEL.other;
  return useEn(locale) ? pack.en : pack.ar;
}

function summarizeKnownSlots(slots, locale) {
  const parts = [];
  for (const key of FOLLOW_UP_ORDER) {
    if (!slots[key]) continue;
    parts.push(String(slots[key]).replace(/_/g, " "));
  }
  if (!parts.length) {
    return useEn(locale) ? "your preferences" : "تفضيلاتك";
  }
  return parts.join(", ");
}

async function resolveConsultMessage(ctx, locale, slots, options = {}) {
  const missing = nextFollowUpSlot(slots);
  const opts = knowledgeOpts(ctx);
  const topic = topicForSlots(slots, locale);

  if (missing === "room" && slots.productType) {
    const templated =
      (await getPersonalityMessage("productInterestWithTopic", locale, opts)) ||
      "";
    if (templated.includes("{topic}")) {
      return templated.replaceAll("{topic}", topic);
    }
    if (templated) return templated;
    return useEn(locale)
      ? `Yes — I can help you with ${topic} from ENARTE lighting. Which room is it for?`
      : `نعم — أقدر أساعدك بخصوص ${topic} من إضاءة ENARTE. لأي غرفة تحتاجها؟`;
  }

  if (missing === "productType") {
    return (
      (await getPersonalityMessage("productInterestConsult", locale, opts)) ||
      FOLLOW_UP_QUESTION.productType[useEn(locale) ? "en" : "ar"]
    );
  }

  if (missing) {
    const known = summarizeKnownSlots(slots, locale);
    const ask =
      FOLLOW_UP_QUESTION[missing]?.[useEn(locale) ? "en" : "ar"] ||
      (useEn(locale)
        ? "What else should I know to match ENARTE lighting?"
        : "ماذا أحتاج أيضاً لأختار إضاءة ENARTE المناسبة؟");
    return useEn(locale)
      ? `Noted — ${known}. ${ask}`
      : `تم — ${known}. ${ask}`;
  }

  const known = summarizeKnownSlots(slots, locale);
  if (options.catalogUnavailable) {
    return useEn(locale)
      ? `Yes — ENARTE can help with that. I have ${known}. Share one more detail anytime, or try again shortly while the catalog reconnects.`
      : `نعم — ENARTE تقدر تساعد بذلك. سجّلت ${known}. أضف أي تفصيل إضافي متى شئت، أو أعد المحاولة بعد لحظات عند عودة الكتالوج.`;
  }

  return useEn(locale)
    ? `Great — I have ${known} for your ENARTE lighting match. Anything else to refine?`
    : `ممتاز — لدي ${known} لمطابقة إضاءة ENARTE. هل تريد إضافة تفصيل آخر؟`;
}

/**
 * Build a consult reply that advances the sale without product invention.
 *
 * @param {object} ctx
 * @param {object} input
 * @param {object} [options]
 * @param {string} [options.workflowId]
 * @param {boolean} [options.catalogUnavailable]
 * @param {object} [options.describeSlots]
 * @param {object} [options.search]
 * @param {boolean} [options.resumeConsult]
 */
export async function buildCatalogIndependentConsult(
  ctx,
  input = {},
  options = {},
) {
  const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
  const workflowId = options.workflowId || "product_search";
  const message = String(input.message || "").trim();
  const slots = mergeConversationSlots(
    message,
    options.describeSlots || input.artifacts?.describeSlots || {},
  );
  const missing = nextFollowUpSlot(slots);
  const reply = await resolveConsultMessage(ctx, locale, slots, options);

  return createWorkflowResult({
    ok: true,
    workflowId,
    status: WORKFLOW_STATUS.ACTIVE,
    action: "reply",
    message: reply,
    data: Object.freeze({
      catalogIndependent: true,
      catalogUnavailable: Boolean(options.catalogUnavailable),
      awaitingConsultDetail: Boolean(missing),
      describeSlots: Object.freeze({ ...slots }),
      search: options.search || null,
      resumeConsult: Boolean(options.resumeConsult),
    }),
    note: options.catalogUnavailable
      ? "Catalog offline — consult with Knowledge + slots only."
      : "Catalog-independent consult follow-up.",
  });
}
