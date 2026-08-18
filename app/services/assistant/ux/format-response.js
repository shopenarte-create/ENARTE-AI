/**
 * Welcome + chat formatting.
 *
 * Business-facing copy is loaded from Knowledge Layer (assistant_personality)
 * when available. Scaffolding fallbacks remain only for non-business chrome.
 */

import {
  getPersonalityMessage,
  getPersonalitySourcingMessage,
  getPersonalityImageAskMessage,
  getPersonalityRoomAskMessage,
} from "../knowledge/readers/assistant-personality.js";
import { getBusinessRuleMessage } from "../knowledge/readers/business-rules.js";
import {
  getCustomLightingMessage,
  getServiceOffering,
} from "../knowledge/readers/services.js";
import { pickLocale } from "../utils/locale.js";
import { filterEnarteCatalogCards } from "../core/domain-scope.js";

async function servicesTextForWorkflow(workflowId, locale = "ar") {
  try {
    if (workflowId === "installation") {
      const offering = await getServiceOffering("installation", { locale });
      return pickLocale(offering?.description, locale);
    }
    if (workflowId === "maintenance") {
      const offering = await getServiceOffering("maintenance", { locale });
      return pickLocale(offering?.description, locale);
    }
    if (workflowId === "custom_chandeliers") {
      return (await getCustomLightingMessage(locale)) || "";
    }
    return "";
  } catch {
    return "";
  }
}

/** Non-business scaffolding only (errors / unfinished feature chrome). */
export const UX_COPY = Object.freeze({
  placeholder: Object.freeze({
    ar: "هذه الميزة قيد التفعيل. اختر زراً آخر أو اكتب طلبك.",
    en: "This capability is being activated. Choose another action or type your request.",
  }),
  error: Object.freeze({
    ar: "تعذر إكمال الطلب الآن. حاول مرة أخرى.",
    en: "Could not complete that request right now. Please try again.",
  }),
});

export function uxText(key, locale = "ar") {
  const pack = UX_COPY[key];
  if (!pack) return "";
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  return useEn ? pack.en : pack.ar;
}

/**
 * Resolve a personality message from Knowledge Layer.
 */
export async function personalityText(key, locale = "ar") {
  try {
    if (key === "sourcing") {
      const fromRules =
        (await getBusinessRuleMessage("unavailableProducts", locale)) || "";
      if (fromRules) return fromRules;
      return (await getPersonalitySourcingMessage(locale)) || "";
    }
    return (await getPersonalityMessage(key, locale)) || "";
  } catch {
    return "";
  }
}

/**
 * Map workflow / turn results into user-visible chat messages.
 * When the turn came from OpenAI (`data.ai`), pass through the model reply —
 * Decision Engine / personality must not rewrite customer-facing AI text.
 * Personality templates remain only for LLM-off / orchestration chrome.
 */
export async function formatTurnForChat(turn, locale = "ar") {
  const messages = [];
  const leaf =
    turn?.workflowResult?.action === "delegate" && turn.workflowResult.delegated
      ? turn.workflowResult.delegated
      : turn?.workflowResult;
  const isAiReply = Boolean(leaf?.data?.ai);

  if (!leaf) {
    messages.push({
      role: "assistant",
      type: "text",
      content: uxText("error", locale),
    });
    return Object.freeze(messages);
  }

  if (leaf.action === "clarify") {
    messages.push({
      role: "assistant",
      type: "text",
      content:
        leaf.message ||
        (!isAiReply ? await personalityText("clarify", locale) : null) ||
        uxText("placeholder", locale),
    });
    return Object.freeze(messages);
  }

  if (leaf.action === "guide_ask") {
    messages.push({
      role: "assistant",
      type: "text",
      content:
        leaf.message ||
        (!isAiReply ? await personalityText("clarify", locale) : null) ||
        uxText("placeholder", locale),
      actions: Array.isArray(leaf.data?.choices)
        ? Object.freeze([...leaf.data.choices])
        : null,
    });
    return Object.freeze(messages);
  }

  if (leaf.action === "out_of_domain") {
    messages.push({
      role: "assistant",
      type: "text",
      content:
        (isAiReply && leaf.message
          ? leaf.message
          : null) ||
        (await personalityText("outOfDomain", locale)) ||
        leaf.message ||
        uxText("placeholder", locale),
    });
    return Object.freeze(messages);
  }

  if (leaf.action === "ask_photo") {
    const photoKind = leaf.data?.photoKind === "product" ? "product" : "room";
    const askFallback =
      photoKind === "product"
        ? await getPersonalityImageAskMessage(locale)
        : await getPersonalityRoomAskMessage(locale);
    messages.push({
      role: "assistant",
      type: "photo_prompt",
      content: leaf.message || askFallback || uxText("placeholder", locale),
      meta: Object.freeze({
        photoKind,
        /** Camera / file picker must wait for an explicit customer tap. */
        openCamera: false,
      }),
    });
    return Object.freeze(messages);
  }

  if (leaf.action === "reply") {
    messages.push({
      role: "assistant",
      type: "text",
      content:
        leaf.message ||
        (isAiReply
          ? uxText("error", locale)
          : leaf.data?.catalogIndependent || leaf.data?.catalogUnavailable
            ? await personalityText("productInterestConsult", locale)
            : null) ||
        (!isAiReply ? await personalityText("help", locale) : null) ||
        uxText("error", locale),
      actions: leaf.data?.actions ? Object.freeze([...leaf.data.actions]) : null,
    });
    return Object.freeze(messages);
  }

  if (leaf.action === "products_found" || leaf.action === "similar_products") {
    const budgetMax = Number.parseFloat(
      String(leaf.data?.describeSlots?.maxPrice || leaf.data?.maxPrice || ""),
    );
    const budgetMode =
      leaf.data?.describeSlots?.budgetMode === "approx" ||
      leaf.data?.budgetMode === "approx"
        ? "approx"
        : "hard";
    const ceiling =
      Number.isFinite(budgetMax) && budgetMax >= 20
        ? budgetMax * (budgetMode === "approx" ? 1.12 : 1.02)
        : null;
    let cards = filterEnarteCatalogCards(leaf.data?.cards || []);
    if (ceiling != null) {
      cards = cards.filter((card) => {
        const price = Number.parseFloat(String(card.price || ""));
        return !Number.isFinite(price) || price <= ceiling;
      });
    }
    const isRecommend = leaf.workflowId === "product_recommendations";
    const introKey =
      isRecommend
        ? "recommendationsIntro"
        : leaf.action === "similar_products"
          ? "similarProductsIntro"
          : "productsFoundIntro";
    const intro =
      leaf.message ||
      (isAiReply
        ? null
        : await personalityText(introKey, locale)) ||
      (isAiReply
        ? null
        : await personalityText(
            leaf.action === "similar_products"
              ? "similarProductsIntro"
              : "productsFoundIntro",
            locale,
          )) ||
      (isAiReply
        ? null
        : leaf.action === "similar_products"
          ? locale?.toLowerCase?.().startsWith("en")
            ? "No exact match — closest ENARTE options, best first:"
            : "لا يوجد تطابق تام — أقرب خيارات ENARTE، الأنسب أولاً:"
          : locale?.toLowerCase?.().startsWith("en")
            ? "Best ENARTE matches for you:"
            : "أنسب منتجات ENARTE لك:");

    messages.push({
      role: "assistant",
      type: "text",
      content: intro || (cards.length ? "" : uxText("error", locale)),
    });
    if (cards.length) {
      messages.push({
        role: "assistant",
        type: "product_cards",
        content: null,
        cards,
      });
    }
    if (
      leaf.data?.showSourcingOffer ||
      leaf.action === "similar_products" ||
      leaf.data?.sourcingMessage
    ) {
      const sourcing =
        leaf.data?.sourcingMessage ||
        (!isAiReply ? await personalityText("sourcing", locale) : null);
      if (sourcing) {
        messages.push({
          role: "assistant",
          type: "text",
          content: sourcing,
        });
      }
    }
    return Object.freeze(messages);
  }

  if (
    leaf.action === "sourcing_triggered" ||
    leaf.action === "sourcing_queued"
  ) {
    messages.push({
      role: "assistant",
      type: "text",
      content:
        leaf.message ||
        (!isAiReply ? await personalityText("sourcing", locale) : null) ||
        uxText("placeholder", locale),
    });
    return Object.freeze(messages);
  }

  if (leaf.action === "placeholder" || leaf.status === "placeholder") {
    const fromServices =
      (await servicesTextForWorkflow(leaf.workflowId, locale)) || "";
    messages.push({
      role: "assistant",
      type: "text",
      content: fromServices || uxText("placeholder", locale),
    });
    return Object.freeze(messages);
  }

  if (leaf.action === "error") {
    const raw = String(leaf.note || leaf.message || "");
    const isCatalogInfrastructure =
      /could not find a session for shop|catalog_load_failed|shopify_tools_disabled/i.test(
        raw,
      );
    messages.push({
      role: "assistant",
      type: "text",
      content: isCatalogInfrastructure
        ? (await personalityText("productInterestConsult", locale)) ||
          (await personalityText("help", locale)) ||
          uxText("error", locale)
        : leaf.note || uxText("error", locale),
    });
    return Object.freeze(messages);
  }

  messages.push({
    role: "assistant",
    type: "text",
    content: leaf.message || leaf.note || uxText("placeholder", locale),
  });
  return Object.freeze(messages);
}
