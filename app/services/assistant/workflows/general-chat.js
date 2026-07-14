/**
 * General Conversation Workflow — entry dispatcher.
 *
 * Routes via Intent Router. Customer-facing copy for clarify / OOD / greeting
 * is resolved from Knowledge Layer (assistant_personality), not hardcoded rules.
 */

import { EVENT_TYPE, WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import {
  ROUTE_DECISION,
  resolveRouteReply,
  routeIntent,
} from "../core/intent-router.js";
import { executeWorkflow } from "../core/workflow-runner.js";
import { publish } from "../core/event-bus.js";
import { appendMemory } from "../core/memory.js";
import { getPersonalityMessage } from "../knowledge/readers/assistant-personality.js";

const REPLY_KEY_TO_PERSONALITY = Object.freeze({
  out_of_domain: "outOfDomain",
  clarify: "clarify",
  greeting: "greeting",
  help: "help",
});

async function resolveReply(decision, locale, ctx) {
  const personalityKey = REPLY_KEY_TO_PERSONALITY[decision.replyKey];
  if (personalityKey) {
    try {
      const fromKnowledge = await getPersonalityMessage(personalityKey, locale, {
        manager: ctx?.knowledge
          ? { get: (id, opts) => ctx.knowledge.get(id, opts) }
          : undefined,
      });
      if (fromKnowledge) return fromKnowledge;
    } catch {
      // fall through to router scaffold
    }
  }
  return resolveRouteReply(decision, locale);
}

export default Object.freeze({
  id: "general_chat",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "phase2",
  intents: Object.freeze(["general", "greeting", "help"]),
  capabilities: Object.freeze([
    "knowledge.read",
    "memory.read",
    "memory.write",
    "ai.nlu",
  ]),
  description:
    "General conversation entry: intent detection, routing, clarify, out-of-domain.",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const message = input.message;

    if (input.artifacts?.forceOutOfDomain) {
      const reply = await resolveReply(
        { replyKey: "out_of_domain" },
        locale,
        ctx,
      );
      appendAssistantReply(ctx, reply);
      return createWorkflowResult({
        ok: true,
        workflowId: "general_chat",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "out_of_domain",
        message: reply,
        note: "Forced out-of-domain refuse (no prior product context).",
      });
    }

    if (input.artifacts?.conversationContinue) {
      const slots = input.artifacts?.describeSlots || {};
      if (
        slots.productType ||
        slots.style ||
        slots.color ||
        slots.room ||
        input.artifacts?.awaitingConsultDetail
      ) {
        const { buildCatalogIndependentConsult } = await import(
          "./_catalog-independent-consult.js"
        );
        return buildCatalogIndependentConsult(
          ctx,
          { ...input, message: message || input.message },
          {
            workflowId: "general_chat",
            describeSlots: slots,
            resumeConsult: true,
          },
        );
      }

      const reply =
        (await getPersonalityMessage("help", locale, {
          manager: ctx?.knowledge
            ? { get: (id, opts) => ctx.knowledge.get(id, opts) }
            : undefined,
        })) ||
        (await getPersonalityMessage("clarify", locale, {
          manager: ctx?.knowledge
            ? { get: (id, opts) => ctx.knowledge.get(id, opts) }
            : undefined,
        })) ||
        (await resolveReply({ replyKey: "clarify" }, locale, ctx));
      appendAssistantReply(ctx, reply);
      return createWorkflowResult({
        ok: true,
        workflowId: "general_chat",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "reply",
        message: reply,
        data: Object.freeze({
          conversationContinue: true,
          describeSlots: input.artifacts?.describeSlots || {},
        }),
        note: "Active conversation — contextual consultant reply.",
      });
    }

    const decision = routeIntent({
      message,
      intent: input.intent,
      catalog: ctx.config?.intentCatalog,
    });

    await publish(EVENT_TYPE.INTENT_ROUTED, {
      conversationId: ctx.conversationId,
      decision: decision.decision,
      intent: decision.intent,
      workflowId: decision.workflowId,
      strategy: decision.strategy,
    });

    if (decision.decision === ROUTE_DECISION.OUT_OF_DOMAIN) {
      const reply = await resolveReply(decision, locale, ctx);
      appendAssistantReply(ctx, reply);
      return createWorkflowResult({
        ok: true,
        workflowId: "general_chat",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "out_of_domain",
        message: reply,
        route: decision,
        note: "Out of scope — personality knowledge.",
      });
    }

    if (decision.decision === ROUTE_DECISION.CLARIFY) {
      const reply = await resolveReply(decision, locale, ctx);
      appendAssistantReply(ctx, reply);
      return createWorkflowResult({
        ok: true,
        workflowId: "general_chat",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "clarify",
        message: reply,
        route: decision,
        note: "Clarification — one question (personality knowledge).",
      });
    }

    if (decision.decision === ROUTE_DECISION.GENERAL) {
      const reply = await resolveReply(decision, locale, ctx);
      appendAssistantReply(ctx, reply);
      return createWorkflowResult({
        ok: true,
        workflowId: "general_chat",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "reply",
        message: reply,
        route: decision,
        note: "Greeting/help — personality knowledge.",
      });
    }

    if (
      decision.decision === ROUTE_DECISION.ROUTE &&
      decision.workflowId &&
      decision.workflowId !== "general_chat"
    ) {
      await publish(EVENT_TYPE.WORKFLOW_DELEGATED, {
        from: "general_chat",
        to: decision.workflowId,
        intent: decision.intent,
      });

      const delegated = await executeWorkflow(decision.workflowId, ctx, {
        ...input,
        message,
        intent: decision.intent,
        routedBy: "general_chat",
        skipGeneralDispatch: true,
      });

      return createWorkflowResult({
        ok: Boolean(delegated?.ok),
        workflowId: "general_chat",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "delegate",
        message: delegated?.message ?? null,
        route: decision,
        delegated,
        note: `Delegated to workflow "${decision.workflowId}".`,
      });
    }

    const fallback = await resolveReply(
      { replyKey: "clarify" },
      locale,
      ctx,
    );
    appendAssistantReply(ctx, fallback);
    return createWorkflowResult({
      ok: true,
      workflowId: "general_chat",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "clarify",
      message: fallback,
      route: decision,
      note: "Fallback clarifying question.",
    });
  },
});

function appendAssistantReply(ctx, message) {
  if (!ctx?.conversationId || !message) return;
  appendMemory(ctx.conversationId, {
    role: "assistant",
    content: message,
    workflowId: "general_chat",
  });
}
