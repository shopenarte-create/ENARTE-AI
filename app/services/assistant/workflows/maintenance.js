/**
 * Maintenance Workflow — V1.
 * Knowledge Layer (services) only. No technical repair DIY guidance. No OpenAI.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory } from "../core/memory.js";
import {
  getServiceOffering,
  getServiceRuleMessage,
  getServicesContact,
} from "../knowledge/readers/services.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";
import { pickLocale } from "../utils/locale.js";

export default Object.freeze({
  id: "maintenance",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint5",
  intents: Object.freeze(["maintenance", "care"]),
  capabilities: Object.freeze([
    "knowledge.read",
    "memory.write",
    "ai.nlu",
  ]),
  description: "Maintenance information from ENARTE Knowledge Layer.",

  async run(ctx, _input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const knowledgeOpts = knowledgeOptsFromCtx(ctx, locale);

    const maintenance = await getServiceOffering("maintenance", knowledgeOpts);
    const contact = await getServicesContact(knowledgeOpts);
    const rule = await getServiceRuleMessage(locale, knowledgeOpts);

    const message = [
      pickLocale(maintenance?.description, locale),
      rule,
    ]
      .filter(Boolean)
      .join(" ");

    if (!message) {
      return createWorkflowResult({
        ok: true,
        workflowId: "maintenance",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "placeholder",
        message: null,
        note: "Services knowledge missing — placeholder chrome.",
      });
    }

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        content: message,
        workflowId: "maintenance",
      });
    }

    return createWorkflowResult({
      ok: true,
      workflowId: "maintenance",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "reply",
      message,
      data: Object.freeze({
        contactPhone: contact?.phone || null,
      }),
      note: "Maintenance reply from Knowledge Layer.",
    });
  },
});
