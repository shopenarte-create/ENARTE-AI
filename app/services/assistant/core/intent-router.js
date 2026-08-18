/**
 * Scalable Intent Router.
 *
 * Responsibility: decide WHERE a request goes.
 * Does NOT contain business logic, LLM calls, Shopify, or feature implementations.
 *
 * Decision sources (priority):
 * 1. Explicit workflowId
 * 2. Explicit intent id
 * 3. Message pattern match against the intent catalog (config)
 */

import { getWorkflow, findWorkflowsByIntent } from "../workflows/registry.js";
import {
  INTENT_DEFINITIONS,
  OUT_OF_DOMAIN_PATTERNS,
  ENGINE_REPLY_TEMPLATES,
  INTENT_ROUTER_SETTINGS,
  ROUTE_DECISION,
  ROUTING_INTENT,
  loadIntentCatalog,
  resolveReplyTemplate,
} from "../config/intent-catalog.js";
import { isLightingStoreTopic, isOffStoreTopic } from "./domain-scope.js";

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function scorePatterns(text, patterns) {
  let score = 0;
  const hits = [];
  for (const pattern of patterns || []) {
    const needle = normalizeText(pattern);
    if (!needle) continue;
    if (text.includes(needle)) {
      score += 1;
      hits.push(pattern);
    }
  }
  return { score, hits };
}

/**
 * Hard out-of-domain check (pattern catalog). Used by Decision Engine even when
 * the LLM is ready — so off-topic turns never continue a prior product reply.
 */
export function matchesOutOfDomainMessage(message, catalog = null) {
  const text = normalizeText(message);
  if (!text) return false;
  if (isOffStoreTopic(text)) return true;
  if (isLightingStoreTopic(text)) return false;

  const loaded = catalog || loadIntentCatalog();
  const settings = loaded.settings || INTENT_ROUTER_SETTINGS;
  const patterns = loaded.outOfDomainPatterns || OUT_OF_DOMAIN_PATTERNS;
  const ood = scorePatterns(text, patterns);
  if (ood.score < (settings.outOfDomainMinScore ?? 1)) return false;

  // If a strong in-domain intent also matches, don't hard-block.
  const intents = loaded.intents || INTENT_DEFINITIONS;
  let topDomainScore = 0;
  for (const entry of intents) {
    if (entry.decision === ROUTE_DECISION.GENERAL) continue;
    const { score } = scorePatterns(text, entry.patterns);
    if (score > topDomainScore) topDomainScore = score;
  }
  return ood.score >= topDomainScore;
}

function buildDecision(partial) {
  return Object.freeze({
    resolved: Boolean(partial.resolved),
    decision: partial.decision || ROUTE_DECISION.CLARIFY,
    intent: partial.intent || null,
    workflowId: partial.workflowId || null,
    candidates: Object.freeze([...(partial.candidates || [])]),
    strategy: partial.strategy || "unresolved",
    confidence: partial.confidence ?? 0,
    scores: Object.freeze([...(partial.scores || [])]),
    replyKey: partial.replyKey || null,
    note: partial.note || null,
  });
}

function decideFromMessage(message, catalog) {
  const text = normalizeText(message);
  if (!text) {
    return buildDecision({
      resolved: true,
      decision: ROUTE_DECISION.CLARIFY,
      intent: ROUTING_INTENT.UNCLEAR,
      strategy: "empty_message",
      replyKey: "clarify",
      confidence: 0,
      note: "Empty message — one clarifying question.",
    });
  }

  const settings = catalog.settings || INTENT_ROUTER_SETTINGS;
  const intents = catalog.intents || INTENT_DEFINITIONS;

  const scores = intents
    .map((entry) => {
      const { score, hits } = scorePatterns(text, entry.patterns);
      return {
        id: entry.id,
        workflowId: entry.workflowId,
        decision: entry.decision,
        priority: entry.priority || 0,
        score,
        hits,
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.priority - a.priority;
    });

  const ood = scorePatterns(
    text,
    catalog.outOfDomainPatterns || OUT_OF_DOMAIN_PATTERNS,
  );
  const top = scores[0] || null;
  const second = scores[1] || null;

  const domainStrong =
    top &&
    top.score >= settings.minRouteScore &&
    top.decision !== ROUTE_DECISION.GENERAL;

  const generalHit =
    top &&
    top.decision === ROUTE_DECISION.GENERAL &&
    top.score >= settings.minRouteScore;

  if (
    ood.score >= settings.outOfDomainMinScore &&
    (!top || ood.score > top.score)
  ) {
    return buildDecision({
      resolved: true,
      decision: ROUTE_DECISION.OUT_OF_DOMAIN,
      intent: ROUTING_INTENT.OUT_OF_DOMAIN,
      strategy: "message_out_of_domain",
      confidence: ood.score,
      scores,
      replyKey: "out_of_domain",
      note: "Message matched out-of-domain routing patterns.",
    });
  }

  if (
    top &&
    second &&
    top.score >= settings.minRouteScore &&
    top.score - second.score <= settings.ambiguityMargin &&
    top.workflowId !== second.workflowId &&
    // Same score but a clear priority winner → route; don't ask clarify.
    Math.abs((top.priority || 0) - (second.priority || 0)) < 5
  ) {
    return buildDecision({
      resolved: true,
      decision: ROUTE_DECISION.CLARIFY,
      intent: ROUTING_INTENT.UNCLEAR,
      candidates: [top.workflowId, second.workflowId].filter(Boolean),
      strategy: "message_ambiguous",
      confidence: top.score,
      scores,
      replyKey: "clarify",
      note: "Multiple workflows scored equally — one clarifying question.",
    });
  }

  if (generalHit) {
    return buildDecision({
      resolved: true,
      decision: ROUTE_DECISION.GENERAL,
      intent: top.id,
      workflowId: "general_chat",
      candidates: ["general_chat"],
      strategy: "message_general",
      confidence: top.score,
      scores,
      replyKey: top.id === "help" ? "help" : "greeting",
    });
  }

  if (domainStrong && getWorkflow(top.workflowId)) {
    return buildDecision({
      resolved: true,
      decision: ROUTE_DECISION.ROUTE,
      intent: top.id,
      workflowId: top.workflowId,
      candidates: scores.map((s) => s.workflowId),
      strategy: "message_match",
      confidence: top.score,
      scores,
    });
  }

  if (domainStrong && !getWorkflow(top.workflowId)) {
    return buildDecision({
      resolved: false,
      decision: ROUTE_DECISION.CLARIFY,
      intent: top.id,
      workflowId: top.workflowId,
      strategy: "workflow_missing",
      confidence: top.score,
      scores,
      replyKey: "clarify",
      note: `Intent matched workflow "${top.workflowId}" but it is not registered.`,
    });
  }

  return buildDecision({
    resolved: true,
    decision: ROUTE_DECISION.CLARIFY,
    intent: ROUTING_INTENT.UNCLEAR,
    strategy: "message_unclear",
    confidence: top?.score || 0,
    scores,
    replyKey: "clarify",
    note: "Intent unclear — one clarifying question.",
  });
}

/**
 * @param {object} input
 * @param {string} [input.workflowId]
 * @param {string} [input.intent]
 * @param {string} [input.message]
 * @param {object} [input.catalog] optional catalog override (tests)
 */
export function routeIntent(input = {}) {
  const catalog = input.catalog || loadIntentCatalog();

  if (input.workflowId) {
    const workflow = getWorkflow(input.workflowId);
    return buildDecision({
      resolved: Boolean(workflow),
      decision: workflow ? ROUTE_DECISION.ROUTE : ROUTE_DECISION.CLARIFY,
      intent: input.intent || null,
      workflowId: workflow ? workflow.id : null,
      candidates: workflow ? [workflow.id] : [],
      strategy: "explicit_workflow",
      confidence: workflow ? 1 : 0,
      replyKey: workflow ? null : "clarify",
      note: workflow
        ? "Explicit workflow selection."
        : `Unknown workflow "${input.workflowId}".`,
    });
  }

  if (input.intent) {
    const intentId = String(input.intent).toLowerCase();

    if (intentId === ROUTING_INTENT.OUT_OF_DOMAIN) {
      return buildDecision({
        resolved: true,
        decision: ROUTE_DECISION.OUT_OF_DOMAIN,
        intent: ROUTING_INTENT.OUT_OF_DOMAIN,
        strategy: "explicit_intent",
        confidence: 1,
        replyKey: "out_of_domain",
      });
    }

    if (intentId === ROUTING_INTENT.UNCLEAR) {
      return buildDecision({
        resolved: true,
        decision: ROUTE_DECISION.CLARIFY,
        intent: ROUTING_INTENT.UNCLEAR,
        strategy: "explicit_intent",
        confidence: 1,
        replyKey: "clarify",
      });
    }

    const fromCatalog = (catalog.intents || INTENT_DEFINITIONS).find(
      (entry) => entry.id === intentId,
    );
    if (fromCatalog) {
      const workflow = getWorkflow(fromCatalog.workflowId);
      return buildDecision({
        resolved: Boolean(workflow) || fromCatalog.decision === ROUTE_DECISION.GENERAL,
        decision: fromCatalog.decision,
        intent: fromCatalog.id,
        workflowId: fromCatalog.workflowId,
        candidates: [fromCatalog.workflowId],
        strategy: "explicit_intent",
        confidence: 1,
        replyKey:
          fromCatalog.decision === ROUTE_DECISION.GENERAL
            ? fromCatalog.id === "help"
              ? "help"
              : "greeting"
            : null,
      });
    }

    const matches = findWorkflowsByIntent(intentId);
    return buildDecision({
      resolved: matches.length > 0,
      decision: matches.length
        ? ROUTE_DECISION.ROUTE
        : ROUTE_DECISION.CLARIFY,
      intent: intentId,
      workflowId: matches[0]?.id || null,
      candidates: matches.map((w) => w.id),
      strategy: "explicit_intent",
      confidence: matches.length ? 1 : 0,
      replyKey: matches.length ? null : "clarify",
    });
  }

  if (input.message !== undefined && input.message !== null) {
    return decideFromMessage(input.message, catalog);
  }

  return buildDecision({
    resolved: true,
    decision: ROUTE_DECISION.CLARIFY,
    intent: ROUTING_INTENT.UNCLEAR,
    strategy: "unresolved",
    confidence: 0,
    replyKey: "clarify",
    note: "No workflowId, intent, or message provided.",
  });
}

/**
 * Resolve a canned engine reply for a routing decision (no LLM).
 */
export function resolveRouteReply(decision, locale = "ar", catalog = loadIntentCatalog()) {
  if (!decision?.replyKey) return "";
  return resolveReplyTemplate(
    catalog.replies || ENGINE_REPLY_TEMPLATES,
    decision.replyKey,
    locale,
  );
}

export { ROUTE_DECISION, ROUTING_INTENT, loadIntentCatalog };
