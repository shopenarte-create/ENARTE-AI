/**
 * Permanent in-chat support / problem sheet.
 * WhatsApp + Call use ENARTE customer support (+962792404023 / 00962792404023).
 * Maintenance number stays separate in services knowledge.
 */

const SUPPORT_PHONE = "+962792404023";
const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`;

export function getSupportActions(locale = "ar") {
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  return Object.freeze([
    Object.freeze({
      id: "support_whatsapp",
      kind: "external",
      href: WHATSAPP_URL,
      label: useEn ? "WhatsApp Support" : "دعم واتساب",
    }),
    Object.freeze({
      id: "support_call",
      kind: "external",
      href: `tel:${SUPPORT_PHONE}`,
      label: useEn ? "Call Us" : "اتصل بنا",
    }),
    Object.freeze({
      id: "support_report",
      kind: "escalate",
      message: useEn
        ? "I want to report a technical issue with the assistant."
        : "أريد الإبلاغ عن مشكلة تقنية في المساعد.",
      label: useEn ? "Report a Technical Issue" : "الإبلاغ عن مشكلة تقنية",
    }),
    Object.freeze({
      id: "support_human",
      kind: "escalate",
      message: useEn
        ? "Please connect me with a human representative."
        : "أريد التحدث مع ممثل بشري من ENARTE.",
      label: useEn
        ? "Talk to a Human Representative"
        : "التحدث مع ممثل بشري",
    }),
    Object.freeze({
      id: "support_feedback",
      kind: "action",
      actionId: "suggestions_feedback",
      label: useEn
        ? "Send Feedback about the AI Assistant"
        : "إرسال ملاحظات عن المساعد",
    }),
  ]);
}

export function getSupportTriggerLabel(locale = "ar") {
  return String(locale || "ar").toLowerCase().startsWith("en")
    ? "Having a problem?"
    : "هل تواجه مشكلة؟";
}

export function getSupportSheetTitle(locale = "ar") {
  return String(locale || "ar").toLowerCase().startsWith("en")
    ? "How can we help?"
    : "كيف نقدر نساعدك؟";
}

export { SUPPORT_PHONE, WHATSAPP_URL };
