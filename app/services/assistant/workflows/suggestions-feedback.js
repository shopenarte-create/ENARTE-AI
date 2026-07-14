/**
 * Suggestions & Feedback Workflow — MVP.
 * Collects customer feedback via Knowledge Layer prompts. No OpenAI. No FAQ invention.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory } from "../core/memory.js";
import { getPersonalityMessage } from "../knowledge/readers/assistant-personality.js";

export default Object.freeze({
  id: "suggestions_feedback",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint4",
  intents: Object.freeze([
    "suggestions_feedback",
    "feedback",
    "suggestion",
  ]),
  capabilities: Object.freeze([
    "knowledge.read",
    "memory.write",
    "notify.admin",
    "ai.nlu",
  ]),
  description: "Collect suggestions/feedback using Knowledge Layer copy.",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const knowledgeOpts = {
      locale,
      manager: ctx?.knowledge
        ? { get: (id, opts) => ctx.knowledge.get(id, opts) }
        : undefined,
    };

    const feedbackText = String(
      input.artifacts?.feedbackBody ||
        (input.artifacts?.resumeFeedback ? input.message : "") ||
        "",
    ).trim();

    // First step: ask for the suggestion/feedback text.
    if (!feedbackText) {
      const prompt =
        (await getPersonalityMessage(
          "feedbackPrompt",
          locale,
          knowledgeOpts,
        )) || null;

      if (!prompt) {
        return createWorkflowResult({
          ok: true,
          workflowId: "suggestions_feedback",
          status: WORKFLOW_STATUS.ACTIVE,
          action: "placeholder",
          message: null,
          note: "Feedback prompt missing from knowledge.",
        });
      }

      if (ctx.conversationId) {
        appendMemory(ctx.conversationId, {
          role: "assistant",
          content: prompt,
          workflowId: "suggestions_feedback",
          metadata: { awaitingFeedback: true },
        });
      }

      return createWorkflowResult({
        ok: true,
        workflowId: "suggestions_feedback",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "clarify",
        message: prompt,
        data: Object.freeze({ awaitingFeedback: true }),
        note: "Ask for feedback text (Knowledge).",
      });
    }

    const ack =
      (await getPersonalityMessage("feedbackAck", locale, knowledgeOpts)) ||
      null;

    if (!ack) {
      return createWorkflowResult({
        ok: true,
        workflowId: "suggestions_feedback",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "placeholder",
        message: null,
        note: "Feedback ack missing from knowledge.",
      });
    }

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        content: ack,
        workflowId: "suggestions_feedback",
        metadata: Object.freeze({
          feedbackQueued: true,
          feedbackText,
        }),
      });
    }

    return createWorkflowResult({
      ok: true,
      workflowId: "suggestions_feedback",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "reply",
      message: ack,
      data: Object.freeze({
        feedbackQueued: true,
        feedbackText,
      }),
      note: "Feedback collected — Knowledge ack.",
    });
  },
});
