/**
 * Returns / exchange policy — from Knowledge Layer business_rules only.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory } from "../core/memory.js";
import { getBusinessRuleMessage } from "../knowledge/readers/business-rules.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";

const FALLBACK = Object.freeze({
  ar: "يمكنك استبدال أو ترجيع المنتج خلال 24 ساعة في حال عدم الاقتناع بالمنتج على الواقع.",
  en: "You can exchange or return the product within 24 hours if you are not satisfied with it in person.",
});

export default Object.freeze({
  id: "returns",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint5",
  intents: Object.freeze(["returns", "exchange", "refund"]),
  capabilities: Object.freeze(["knowledge.read", "memory.write"]),
  description: "Returns and exchange policy from ENARTE business rules.",

  async run(ctx, _input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const knowledgeOpts = knowledgeOptsFromCtx(ctx, locale);
    const useEn = String(locale).toLowerCase().startsWith("en");

    const message =
      (await getBusinessRuleMessage(
        "returnsExchange",
        locale,
        knowledgeOpts,
      )) ||
      (useEn ? FALLBACK.en : FALLBACK.ar);

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        content: message,
        workflowId: "returns",
      });
    }

    return createWorkflowResult({
      ok: true,
      workflowId: "returns",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "reply",
      message,
      data: Object.freeze({
        withinHours: 24,
        allowExchange: true,
        allowReturn: true,
      }),
      note: "Returns/exchange reply from Knowledge Layer.",
    });
  },
});
