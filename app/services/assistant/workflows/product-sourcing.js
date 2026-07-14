/**
 * Product Sourcing Workflow — no catalog match.
 * Creates a sourcing request; customer copy from Knowledge Layer.
 * Does NOT search the internet. Does NOT call OpenAI.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory } from "../core/memory.js";
import { getAdapter } from "../adapters/registry.js";
import { getBusinessRuleMessage } from "../knowledge/readers/business-rules.js";
import { getPersonalitySourcingMessage } from "../knowledge/readers/assistant-personality.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";
import { logAssistant } from "../utils/logging.js";

export default Object.freeze({
  id: "product_sourcing",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint5",
  intents: Object.freeze(["sourcing", "source_product"]),
  capabilities: Object.freeze([
    "knowledge.read",
    "notify.admin",
    "memory.write",
    "ai.nlu",
  ]),
  description:
    "Capture a product sourcing request when the ENARTE catalog has no match.",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const opts = knowledgeOptsFromCtx(ctx, locale);

    const request = Object.freeze({
      shop: ctx.shop || null,
      conversationId: ctx.conversationId || null,
      message: input.message || null,
      query: input.query || null,
      reason: input.reason || "manual",
      routedBy: input.routedBy || null,
      createdAt: new Date().toISOString(),
      status: "queued",
      channels: Object.freeze(["admin"]),
    });

    const message =
      (await getBusinessRuleMessage("unavailableProducts", locale, opts)) ||
      (await getPersonalitySourcingMessage(locale, opts)) ||
      null;

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        workflowId: "product_sourcing",
        content: message || "sourcing_request_queued",
        metadata: request,
      });
    }

    const persistence = getAdapter("persistence.prisma");
    if (persistence?.api?.recordEvent && ctx.shop) {
      await persistence.api.recordEvent({
        shop: ctx.shop,
        conversationId: ctx.conversationId || null,
        type: "product_sourcing_queued",
        payload: request,
      });
    }

    logAssistant("product_sourcing.queued", {
      conversationId: ctx.conversationId,
      shop: ctx.shop,
      reason: request.reason,
    });

    return createWorkflowResult({
      ok: true,
      workflowId: "product_sourcing",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "sourcing_queued",
      message,
      data: { request },
      note: "Sourcing request queued for ENARTE ops — no external web search.",
    });
  },
});
