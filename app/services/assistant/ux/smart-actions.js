/**
 * Smart Action Buttons — config only (not hardcoded in UI components).
 * Each action maps to a workflow / intent / artifacts for the engine.
 *
 * Welcome menu (showOnWelcome: true) is intentionally minimal — only 5 actions.
 */

export const SMART_ACTION_IDS = Object.freeze({
  SEARCH_PRODUCT: "search_product",
  SEARCH_BY_IMAGE: "search_by_image",
  DESCRIBE_LOOKING_FOR: "describe_looking_for",
  RECOMMEND_ROOM: "recommend_room",
  RECOMMEND_PRODUCTS: "recommend_products",
  CHANDELIERS: "chandeliers",
  FANS: "fans",
  OUTDOOR_LIGHTING: "outdoor_lighting",
  INSTALLATION_MAINTENANCE: "installation_maintenance",
  SITE_INSPECTION: "site_inspection",
  DELIVERY: "delivery",
  TALK_TO_ASSISTANT: "talk_to_assistant",
  SUGGESTIONS_FEEDBACK: "suggestions_feedback",
  CHECKOUT: "checkout",
  MAIN_MENU: "main_menu",
});

/**
 * @typedef {object} SmartAction
 * @property {string} id
 * @property {{ ar: string, en: string }} label
 * @property {string} workflowId
 * @property {string} [intent]
 * @property {string} [message]
 * @property {object} [artifacts]
 * @property {boolean} [showOnWelcome]
 */

export const SMART_ACTIONS = Object.freeze([
  // --- Welcome menu (exactly these 5, in this order) ---
  {
    id: SMART_ACTION_IDS.SUGGESTIONS_FEEDBACK,
    label: Object.freeze({
      ar: "اقتراحات وملاحظات",
      en: "Suggestions & Feedback",
    }),
    workflowId: "suggestions_feedback",
    intent: "suggestions_feedback",
    message: "لدي اقتراح أو ملاحظة",
    showOnWelcome: true,
  },
  {
    id: SMART_ACTION_IDS.SITE_INSPECTION,
    label: Object.freeze({ ar: "معاينة الموقع", en: "Site Inspection" }),
    workflowId: "site_inspection",
    intent: "site_inspection",
    message: "أريد معاينة موقع",
    showOnWelcome: true,
  },
  {
    id: SMART_ACTION_IDS.TALK_TO_ASSISTANT,
    label: Object.freeze({ ar: "تحدث مع المساعد", en: "Talk to the Assistant" }),
    workflowId: "general_chat",
    intent: "help",
    message: "تحدث مع المساعد",
    showOnWelcome: true,
  },
  {
    id: SMART_ACTION_IDS.DELIVERY,
    label: Object.freeze({ ar: "التوصيل", en: "Delivery" }),
    workflowId: "delivery",
    intent: "delivery",
    message: "أريد معرفة تفاصيل التوصيل",
    showOnWelcome: true,
  },
  {
    id: SMART_ACTION_IDS.SEARCH_BY_IMAGE,
    label: Object.freeze({ ar: "بحث بالصورة", en: "Search by Image" }),
    workflowId: "image_search",
    intent: "search_by_image",
    message: "أريد البحث بالصورة",
    showOnWelcome: true,
  },
  // --- Available later / by intent, not on welcome ---
  {
    id: SMART_ACTION_IDS.DESCRIBE_LOOKING_FOR,
    label: Object.freeze({
      ar: "صف ما تبحث عنه",
      en: "Describe What You're Looking For",
    }),
    workflowId: "describe_looking_for",
    intent: "describe_looking_for",
    message: "أريد وصف ما أبحث عنه",
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.RECOMMEND_ROOM,
    label: Object.freeze({
      ar: "إضاءة مناسبة لغرفتي",
      en: "Recommend Lighting for My Room",
    }),
    workflowId: "room_analysis",
    intent: "analyze_room",
    message: "أريد توصيات إضاءة لغرفتي",
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.CHANDELIERS,
    label: Object.freeze({ ar: "ثريات", en: "Chandeliers" }),
    workflowId: "chandelier",
    intent: "buy_chandelier",
    message: "I want a chandelier",
    artifacts: Object.freeze({
      category: "chandeliers",
      keywords: Object.freeze(["chandelier", "ثريا"]),
    }),
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.FANS,
    label: Object.freeze({ ar: "مراوح", en: "Fans" }),
    workflowId: "fan",
    intent: "buy_fan",
    message: "I want a fan",
    artifacts: Object.freeze({
      category: "fans",
      keywords: Object.freeze(["fan", "مروحة"]),
      tags: Object.freeze(["fan"]),
    }),
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.OUTDOOR_LIGHTING,
    label: Object.freeze({ ar: "إضاءة خارجية", en: "Outdoor Lighting" }),
    workflowId: "outdoor_lighting",
    intent: "buy_outdoor",
    message: "I want outdoor lighting",
    artifacts: Object.freeze({
      category: "outdoor",
      keywords: Object.freeze(["outdoor", "خارجية"]),
      tags: Object.freeze(["outdoor"]),
    }),
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.INSTALLATION_MAINTENANCE,
    label: Object.freeze({
      ar: "تركيب وصيانة",
      en: "Installation & Maintenance",
    }),
    workflowId: "installation",
    intent: "installation",
    message: "أحتاج مساعدة في التركيب والصيانة",
    artifacts: Object.freeze({ includeMaintenance: true }),
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.SEARCH_PRODUCT,
    label: Object.freeze({ ar: "بحث عن منتج", en: "Search Product" }),
    workflowId: "product_search",
    intent: "product_search",
    message: "أريد البحث عن منتج",
    artifacts: Object.freeze({}),
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.RECOMMEND_PRODUCTS,
    label: Object.freeze({
      ar: "منتجات مشابهة",
      en: "Similar Products",
    }),
    workflowId: "product_recommendations",
    intent: "recommend_products",
    message: "أريد منتجات مشابهة",
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.CHECKOUT,
    label: Object.freeze({ ar: "إتمام الشراء", en: "Checkout" }),
    workflowId: "checkout",
    intent: "checkout",
    message: "أريد إتمام الشراء",
    showOnWelcome: false,
  },
  {
    id: SMART_ACTION_IDS.MAIN_MENU,
    label: Object.freeze({ ar: "القائمة الرئيسية", en: "Main Menu" }),
    workflowId: "general_chat",
    intent: "main_menu",
    message: "main menu",
    showOnWelcome: false,
  },
]);

export function listSmartActions({ welcomeOnly = false } = {}) {
  return SMART_ACTIONS.filter((a) => (welcomeOnly ? a.showOnWelcome : true)).map(
    (a) =>
      Object.freeze({
        id: a.id,
        label: a.label,
        workflowId: a.workflowId,
      }),
  );
}

export function getSmartAction(actionId) {
  return SMART_ACTIONS.find((a) => a.id === actionId) || null;
}

export function resolveActionLabel(action, locale = "ar") {
  if (!action?.label) return action?.id || "";
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  return useEn ? action.label.en : action.label.ar;
}

/** Explicit request to reopen the initial menu. */
export function isMainMenuRequest(text = "") {
  const raw = String(text || "").trim().toLowerCase();
  if (!raw) return false;
  return (
    /^(main\s*menu|menu|start\s*over|show\s*(the\s*)?(menu|options)|options)$/i.test(
      raw,
    ) ||
    /^(القائمة|القائمة الرئيسية|عرض القائمة|البداية)$/i.test(raw) ||
    /main menu|show menu|show options|القائمة الرئيسية/.test(raw)
  );
}
