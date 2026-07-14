/**
 * Custom chandelier / lighting inquiry — Knowledge Layer only.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory } from "../core/memory.js";
import { invokeCapability } from "../capabilities/registry.js";
import {
  getCustomLightingMessage,
  getServicesContact,
} from "../knowledge/readers/services.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";

export default Object.freeze({
  id: "custom_chandeliers",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint7",
  intents: Object.freeze(["custom_chandelier", "bespoke", "custom_lighting"]),
  capabilities: Object.freeze([
    "knowledge.read",
    "notify.admin",
    "memory.write",
    "ai.nlu",
  ]),
  description:
    "Custom lighting inquiry from Knowledge services module (no LLM).",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const opts = knowledgeOptsFromCtx(ctx, locale);

    const customMsg = await getCustomLightingMessage(locale, opts);
    const contact = await getServicesContact(opts);
    const parts = [customMsg];
    if (contact?.phone) {
      parts.push(contact.phone);
    }
    const message = parts.filter(Boolean).join("\n") || null;

    await invokeCapability("notify.admin", ctx, {
      type: "custom_lighting_inquiry",
      message: input.message || null,
      reason: "custom_chandelier",
    });

    if (ctx.conversationId && message) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        workflowId: "custom_chandeliers",
        content: message,
      });
    }

    return createWorkflowResult({
      ok: Boolean(message),
      workflowId: "custom_chandeliers",
      status: WORKFLOW_STATUS.ACTIVE,
      action: message ? "reply" : "placeholder",
      message,
      data: Object.freeze({
        contactPhone: contact?.phone || null,
      }),
      note: "Custom lighting reply from Knowledge Layer.",
    });
  },
});
