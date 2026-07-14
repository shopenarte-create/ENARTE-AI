/**
 * Delivery Workflow — V1.
 * Answers from Knowledge Layer (delivery module) only. No OpenAI.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory } from "../core/memory.js";
import {
  getAmmanDeliveryMessage,
  getDeliveryCustomerMessage,
  getDeliveryKnowledge,
} from "../knowledge/readers/delivery.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";
import { pickLocale } from "../utils/locale.js";

export default Object.freeze({
  id: "delivery",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint5",
  intents: Object.freeze(["delivery", "shipping"]),
  capabilities: Object.freeze([
    "knowledge.read",
    "memory.write",
    "ai.nlu",
  ]),
  description: "Delivery information from ENARTE Knowledge Layer.",

  async run(ctx, _input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const knowledgeOpts = knowledgeOptsFromCtx(ctx, locale);

    const content = await getDeliveryKnowledge(knowledgeOpts);
    const amman =
      (await getAmmanDeliveryMessage(locale, knowledgeOpts)) ||
      pickLocale(content?.amman?.messages, locale);
    const other = pickLocale(content?.otherCities?.messages, locale);
    const unknown = await getDeliveryCustomerMessage(
      "unknown",
      locale,
      knowledgeOpts,
    );

    const message = [amman, other].filter(Boolean).join(" ") || unknown || null;

    if (!message) {
      return createWorkflowResult({
        ok: true,
        workflowId: "delivery",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "placeholder",
        message: null,
        note: "Delivery knowledge missing — placeholder chrome.",
      });
    }

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        content: message,
        workflowId: "delivery",
      });
    }

    return createWorkflowResult({
      ok: true,
      workflowId: "delivery",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "reply",
      message,
      data: Object.freeze({
        amman: content?.amman?.estimatedDelivery || null,
        otherCitiesSupported: Boolean(content?.otherCities?.supported),
      }),
      note: "Delivery reply from Knowledge Layer.",
    });
  },
});
