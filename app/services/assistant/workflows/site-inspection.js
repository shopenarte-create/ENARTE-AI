/**
 * Site Inspection Journey — MVP/V1.
 * Knowledge Layer (services.site_inspection) only.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory } from "../core/memory.js";
import {
  getServiceOffering,
  getServicesContact,
} from "../knowledge/readers/services.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";
import { pickLocale } from "../utils/locale.js";

export default Object.freeze({
  id: "site_inspection",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint5",
  intents: Object.freeze(["site_inspection", "site_visit"]),
  capabilities: Object.freeze([
    "knowledge.read",
    "memory.write",
    "ai.nlu",
  ]),
  description: "Site inspection service from ENARTE Knowledge Layer.",

  async run(ctx, _input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const opts = knowledgeOptsFromCtx(ctx, locale);
    const offering = await getServiceOffering("site_inspection", opts);
    const contact = await getServicesContact(opts);
    const message = pickLocale(offering?.description, locale);

    if (!message) {
      return createWorkflowResult({
        ok: true,
        workflowId: "site_inspection",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "placeholder",
        message: null,
        note: "Site inspection knowledge missing.",
      });
    }

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        content: message,
        workflowId: "site_inspection",
      });
    }

    return createWorkflowResult({
      ok: true,
      workflowId: "site_inspection",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "reply",
      message,
      data: Object.freeze({
        contactPhone: contact?.phone || null,
        suitableFor: offering?.suitableFor || [],
      }),
      note: "Site inspection reply from Knowledge Layer.",
    });
  },
});
