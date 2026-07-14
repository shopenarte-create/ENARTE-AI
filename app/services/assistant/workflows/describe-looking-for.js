/**
 * Guided “Describe What You're Looking For” flow.
 * Asks ONE question at a time; extracts already-stated slots; searches ENARTE catalog only.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { invokeCapability } from "../capabilities/registry.js";
import { extractBudgetConstraint } from "../catalog/budget-constraint.js";

export const DESCRIBE_STEPS = Object.freeze([
  "productType",
  "style",
  "installation",
  "color",
  "size",
  "room",
]);

const OPTIONS = Object.freeze({
  productType: Object.freeze([
    { id: "chandelier", en: "Chandelier", ar: "ثريا", keywords: ["chandelier", "ثريا", "ثرية", "الثريا", "الثرية"] },
    { id: "ceiling", en: "Ceiling Light", ar: "سقفية", keywords: ["ceiling", "سقف"] },
    { id: "wall", en: "Wall Light", ar: "جدارية", keywords: ["wall", "جدار"] },
    { id: "pendant", en: "Pendant", ar: "معلقة", keywords: ["pendant", "معلق"] },
    { id: "fan", en: "Fan", ar: "مروحة", keywords: ["fan", "مروحة"] },
    { id: "table", en: "Table Lamp", ar: "أبجورة طاولة", keywords: ["table lamp", "table", "أبجورة"] },
    { id: "floor", en: "Floor Lamp", ar: "ستاند", keywords: ["floor", "ستاند"] },
    { id: "outdoor", en: "Outdoor Lighting", ar: "إضاءة خارجية", keywords: ["outdoor", "خارج"] },
    {
      id: "bulb",
      en: "Light Bulb",
      ar: "لمبة",
      keywords: ["bulb", "bulbs", "light bulb", "light bulbs", "لمبة", "لمبات", "بلب", "بلبات"],
    },
    { id: "other", en: "Other", ar: "أخرى", keywords: [] },
  ]),
  style: Object.freeze([
    { id: "crystal", en: "Crystal", ar: "كريستال", keywords: ["crystal", "كريستال"] },
    { id: "led", en: "LED", ar: "LED", keywords: ["led", "ليد"] },
    { id: "modern", en: "Modern", ar: "حديث", keywords: ["modern", "حديث"] },
    { id: "classic", en: "Classic", ar: "كلاسيك", keywords: ["classic", "كلاسيك"] },
    { id: "luxury", en: "Luxury", ar: "فاخر", keywords: ["luxury", "فاخر"] },
    { id: "minimal", en: "Minimal", ar: "بسيط", keywords: ["minimal", "minimalist", "بسيط"] },
    { id: "unsure", en: "I'm not sure", ar: "غير متأكد", keywords: [] },
  ]),
  installation: Object.freeze([
    { id: "hanging", en: "Hanging", ar: "معلقة", keywords: ["hanging", "معلق", "تعليق"] },
    { id: "flush", en: "Flush to the ceiling", ar: "ملاصقة للسقف", keywords: ["flush", "ملاصق"] },
    { id: "either", en: "Either is fine", ar: "أي نوع", keywords: [] },
  ]),
  color: Object.freeze([
    { id: "gold", en: "Gold", ar: "ذهبي", keywords: ["gold", "ذهبي", "ذهب"] },
    { id: "black", en: "Black", ar: "أسود", keywords: ["black", "أسود"] },
    { id: "white", en: "White", ar: "أبيض", keywords: ["white", "أبيض"] },
    { id: "chrome", en: "Chrome", ar: "كروم", keywords: ["chrome", "كروم", "فضي"] },
    { id: "wood", en: "Wood", ar: "خشب", keywords: ["wood", "خشب"] },
    { id: "none", en: "No preference", ar: "بدون تفضيل", keywords: [] },
  ]),
  size: Object.freeze([
    { id: "small", en: "Small", ar: "صغير", keywords: ["small", "صغير"] },
    { id: "medium", en: "Medium", ar: "متوسط", keywords: ["medium", "متوسط"] },
    { id: "large", en: "Large", ar: "كبير", keywords: ["large", "كبير"] },
    { id: "unsure", en: "Not sure", ar: "غير متأكد", keywords: [] },
  ]),
  room: Object.freeze([
    { id: "living", en: "Living Room", ar: "صالة", keywords: ["living", "صالة", "جلوس"] },
    { id: "bedroom", en: "Bedroom", ar: "غرفة نوم", keywords: ["bedroom", "نوم"] },
    { id: "dining", en: "Dining Room", ar: "طعام", keywords: ["dining", "طعام"] },
    { id: "kitchen", en: "Kitchen", ar: "مطبخ", keywords: ["kitchen", "مطبخ"] },
    { id: "hallway", en: "Hallway", ar: "ممر", keywords: ["hallway", "ممر", "مدخل"] },
    { id: "office", en: "Office", ar: "مكتب", keywords: ["office", "مكتب"] },
    { id: "outdoor", en: "Outdoor", ar: "خارجي", keywords: ["outdoor", "خارج", "garage", "كراج"] },
    { id: "other", en: "Other", ar: "أخرى", keywords: [] },
  ]),
});

const QUESTIONS = Object.freeze({
  productType: Object.freeze({
    en: "What type of lighting are you looking for?",
    ar: "ما نوع الإضاءة التي تبحث عنها؟",
  }),
  style: Object.freeze({
    en: "Which style do you prefer?",
    ar: "ما الستايل المفضل لديك؟",
  }),
  installation: Object.freeze({
    en: "Installation type?",
    ar: "ما نوع التركيب؟",
  }),
  color: Object.freeze({
    en: "Preferred color?",
    ar: "ما اللون المفضل؟",
  }),
  size: Object.freeze({
    en: "Approximate size?",
    ar: "ما الحجم التقريبي؟",
  }),
  room: Object.freeze({
    en: "Which room is it for?",
    ar: "لأي غرفة؟",
  }),
});

function useEn(locale) {
  return String(locale || "ar").toLowerCase().startsWith("en");
}

function q(locale, key) {
  return useEn(locale) ? QUESTIONS[key].en : QUESTIONS[key].ar;
}

function choiceActions(locale, stepKey) {
  return OPTIONS[stepKey].map((opt) =>
    Object.freeze({
      id: `choice:${stepKey}:${opt.id}`,
      label: useEn(locale) ? opt.en : opt.ar,
      workflowId: "describe_looking_for",
    }),
  );
}

/**
 * Extract describe slots from free text (EN + AR). Never invent catalog facts.
 */
export function extractDescribeSlots(text = "", existing = {}) {
  const raw = String(text || "").toLowerCase();
  const slots = { ...existing };

  for (const step of DESCRIBE_STEPS) {
    if (slots[step]) continue;
    for (const opt of OPTIONS[step]) {
      if (!opt.keywords.length) continue;
      if (opt.keywords.some((k) => raw.includes(String(k).toLowerCase()))) {
        slots[step] = opt.id;
        break;
      }
    }
  }

  // Budget ceiling (e.g. "ثرية بحدود 150") — remember for the whole chat.
  const budget = extractBudgetConstraint(text);
  if (budget?.max != null) {
    slots.maxPrice = String(budget.max);
    slots.budgetMode = budget.mode;
  }

  return slots;
}

function resolveChoiceValue(stepKey, text) {
  const raw = String(text || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith(`choice:${stepKey}:`)) {
    return raw.slice(`choice:${stepKey}:`.length);
  }
  for (const opt of OPTIONS[stepKey]) {
    if (
      raw === opt.id ||
      raw === opt.en.toLowerCase() ||
      raw === opt.ar.toLowerCase() ||
      opt.keywords.some((k) => raw === String(k).toLowerCase())
    ) {
      return opt.id;
    }
  }
  // Soft match: contains keyword
  for (const opt of OPTIONS[stepKey]) {
    if (opt.keywords.some((k) => raw.includes(String(k).toLowerCase()))) {
      return opt.id;
    }
  }
  return null;
}

function nextMissingStep(slots) {
  return DESCRIBE_STEPS.find((key) => !slots[key]) || null;
}

function buildSearchArtifacts(slots) {
  const keywords = [];
  const tags = [];
  let category = null;

  for (const step of DESCRIBE_STEPS) {
    const id = slots[step];
    if (!id) continue;
    const opt = OPTIONS[step].find((o) => o.id === id);
    if (!opt) continue;
    for (const k of opt.keywords) keywords.push(k);
    if (step === "productType") {
      if (id === "chandelier") category = "chandeliers";
      else if (id === "fan") category = "fans";
      else if (id === "outdoor") category = "outdoor";
      tags.push(id);
    } else if (id !== "unsure" && id !== "none" && id !== "either" && id !== "other") {
      tags.push(id);
      keywords.push(opt.en);
    }
  }

  return Object.freeze({
    category,
    keywords: Object.freeze([...new Set(keywords)]),
    tags: Object.freeze([...new Set(tags)]),
    describeSlots: Object.freeze({ ...slots }),
  });
}

function guideAsk(locale, stepKey, slots) {
  return createWorkflowResult({
    ok: true,
    workflowId: "describe_looking_for",
    status: WORKFLOW_STATUS.ACTIVE,
    action: "guide_ask",
    message: q(locale, stepKey),
    data: Object.freeze({
      awaitingDescribe: true,
      describeStep: stepKey,
      describeSlots: Object.freeze({ ...slots }),
      choices: choiceActions(locale, stepKey),
    }),
    note: `Describe flow — ask ${stepKey} only.`,
  });
}

export default Object.freeze({
  id: "describe_looking_for",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "conversation_ux",
  intents: Object.freeze(["describe_looking_for", "describe_needs"]),
  capabilities: Object.freeze(["catalog.search", "knowledge.read", "memory.write"]),
  description:
    "Guided lighting discovery — one question at a time, then ENARTE catalog search.",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const prevSlots =
      input.artifacts?.describeSlots ||
      ctx.metadata?.describeSlots ||
      {};
    const message = String(input.message || "").trim();
    const choiceId = input.artifacts?.choiceId || null;

    let slots = extractDescribeSlots(message, prevSlots);

    // Apply explicit choice for the awaited step.
    const awaitingStep =
      input.artifacts?.describeStep ||
      ctx.metadata?.describeStep ||
      null;
    if (awaitingStep) {
      const picked =
        resolveChoiceValue(awaitingStep, choiceId || message) ||
        resolveChoiceValue(awaitingStep, message);
      if (picked) {
        slots = { ...slots, [awaitingStep]: picked };
      }
    }

    // Seed from first free-text turn even when starting fresh.
    if (!awaitingStep && message) {
      slots = extractDescribeSlots(message, slots);
    }

    const missing = nextMissingStep(slots);
    if (missing) {
      return guideAsk(locale, missing, slots);
    }

    const artifacts = buildSearchArtifacts(slots);
    const searchMessage = [
      slots.productType,
      slots.style,
      slots.color,
      slots.installation,
      slots.size,
      slots.room,
    ]
      .filter(Boolean)
      .join(" ");

    const search = await invokeCapability("catalog.search", ctx, {
      shop: ctx.shop || input.shop,
      message: searchMessage,
      artifacts,
      products: input.products,
    });

    if (!search.ok && search.error === "shopify_tools_disabled") {
      const { buildCatalogIndependentConsult } = await import(
        "./_catalog-independent-consult.js"
      );
      return buildCatalogIndependentConsult(ctx, input, {
        workflowId: "describe_looking_for",
        catalogUnavailable: true,
        search,
        describeSlots: slots,
      });
    }

    if (!search.ok && search.mode === "error") {
      const { buildCatalogIndependentConsult } = await import(
        "./_catalog-independent-consult.js"
      );
      return buildCatalogIndependentConsult(
        ctx,
        {
          ...input,
          message: input.message || searchMessage,
        },
        {
          workflowId: "describe_looking_for",
          catalogUnavailable: true,
          search,
          describeSlots: slots,
        },
      );
    }

    if (
      search.ok &&
      (search.mode === "exact" ||
        search.mode === "ranked" ||
        (search.mode === "similar" && search.count > 0))
    ) {
      return createWorkflowResult({
        ok: true,
        workflowId: "describe_looking_for",
        status: WORKFLOW_STATUS.ACTIVE,
        action:
          search.mode === "similar" ? "similar_products" : "products_found",
        message: null,
        data: Object.freeze({
          mode: search.mode,
          cards: search.cards,
          count: search.count,
          query: search.query,
          shop: search.shop,
          source: search.source,
          describeSlots: Object.freeze({ ...slots }),
          awaitingDescribe: false,
        }),
        note: "Describe flow complete — ENARTE catalog matches only.",
      });
    }

    // Soft handoff to sourcing via product_search semantics (ENARTE only).
    return createWorkflowResult({
      ok: true,
      workflowId: "describe_looking_for",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "sourcing_triggered",
      message: null,
      data: Object.freeze({
        describeSlots: Object.freeze({ ...slots }),
        awaitingDescribe: false,
        search,
      }),
      note: "Describe flow — no ENARTE match; sourcing path.",
    });
  },
});
