/**
 * Soft-disable stubs for MVP-disabled capabilities.
 * Return Knowledge Layer "not available yet" copy — no OpenAI / vision.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { getPersonalityMessage } from "../knowledge/readers/assistant-personality.js";

async function disabledCapabilityReply(workflowId, ctx, capabilityKey) {
  const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
  const message =
    (await getPersonalityMessage(capabilityKey, locale, {
      manager: ctx?.knowledge
        ? { get: (id, opts) => ctx.knowledge.get(id, opts) }
        : undefined,
    })) || null;

  if (!message) {
    return createWorkflowResult({
      ok: true,
      workflowId,
      status: WORKFLOW_STATUS.PLACEHOLDER,
      action: "placeholder",
      message: null,
      note: `${workflowId} disabled for MVP — knowledge message missing.`,
    });
  }

  return createWorkflowResult({
    ok: true,
    workflowId,
    status: WORKFLOW_STATUS.PLACEHOLDER,
    action: "reply",
    message,
    data: Object.freeze({ mvpDisabled: true }),
    note: `${workflowId} disabled for MVP — Knowledge reply.`,
  });
}

export function createMvpDisabledWorkflow(spec) {
  const { id, intents, description, capabilityKey } = spec;
  return Object.freeze({
    id,
    status: WORKFLOW_STATUS.PLACEHOLDER,
    phase: "sprint4",
    intents: Object.freeze([...(intents || [])]),
    capabilities: Object.freeze(["knowledge.read"]),
    description: description || "",
    async run(ctx, _input = {}) {
      return disabledCapabilityReply(id, ctx, capabilityKey);
    },
  });
}
