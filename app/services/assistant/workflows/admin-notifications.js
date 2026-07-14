/**
 * Admin notifications — V1 minimal.
 * Records an admin event via persistence; customer copy from Knowledge when available.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { invokeCapability } from "../capabilities/registry.js";
import { appendMemory } from "../core/memory.js";
import { getPersonalityMessage } from "../knowledge/readers/assistant-personality.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";

export default Object.freeze({
  id: "admin_notifications",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint7",
  intents: Object.freeze(["notify_admin", "escalate"]),
  capabilities: Object.freeze([
    "notify.admin",
    "knowledge.read",
    "memory.write",
    "ai.nlu",
  ]),
  description: "Queue an admin notification event (no external inbox UI yet).",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const opts = knowledgeOptsFromCtx(ctx, locale);

    const notify = await invokeCapability("notify.admin", ctx, {
      type: input.type || "assistant_escalation",
      message: input.message || null,
      reason: input.reason || "customer_escalate",
      payload: input.payload || {},
    });

    const message =
      (await getPersonalityMessage("adminNotifyAck", locale, opts)) ||
      (await getPersonalityMessage("feedbackAck", locale, opts)) ||
      null;

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        workflowId: "admin_notifications",
        content: message || "admin_notified",
        metadata: { notify },
      });
    }

    return createWorkflowResult({
      ok: Boolean(notify?.ok !== false),
      workflowId: "admin_notifications",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "reply",
      message,
      data: Object.freeze({ notify }),
      note: "Admin notification queued via capability.",
    });
  },
});
