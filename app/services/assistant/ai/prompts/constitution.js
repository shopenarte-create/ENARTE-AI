/**
 * AI Constitution — immutable governing charter for model calls.
 *
 * Single system-level constraint set for OpenAI: identity, specialization,
 * product rules, and general rules — composed ONLY from the Knowledge Layer.
 *
 * Philosophy: OpenAI is the ENARTE conversation brain (intent, tools, replies).
 * Decision Engine owns guardrails, safety, photos, and LLM-off orchestration.
 * Knowledge + Shopify catalog are truth tools — not customer reply authors.
 *
 * It does NOT:
 * - invent ENARTE business facts
 * - search the internet
 * - answer as a general-purpose ChatGPT
 */

import { KNOWLEDGE_MODULE_ID } from "../../knowledge/constants.js";
import { getKnowledgeManager } from "../../knowledge/manager.js";
import {
  AI_CONSTITUTION_PROMPT_ID,
  AI_CONSTITUTION_VERSION,
  PROMPT_KIND,
  PROMPT_ROLE,
  PROMPT_STATUS,
} from "./constants.js";
import { registerPrompt } from "./registry.js";
import { pickLocale } from "../../utils/locale.js";

/** @type {Map<string, object>} */
const constitutionCache = new Map();

/**
 * @typedef {object} AiConstitution
 * @property {string} promptId
 * @property {string} version
 * @property {boolean} knowledgeBound
 * @property {object} charter structured rules from Knowledge
 * @property {string} systemText flattened charter for future system messages
 */

/**
 * Build constitution charter from Knowledge Manager.
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {object} [options.manager]
 * @param {boolean} [options.refresh]
 */
export async function buildAiConstitution(options = {}) {
  const locale = options.locale || "ar";
  const cacheKey = String(locale).toLowerCase().slice(0, 2);
  if (!options.refresh && !options.manager && constitutionCache.has(cacheKey)) {
    return constitutionCache.get(cacheKey);
  }
  const manager = options.manager || getKnowledgeManager();

  const personalityRecord = await manager.get(
    KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY,
    { locale },
  );
  const rulesRecord = await manager.get(KNOWLEDGE_MODULE_ID.BUSINESS_RULES, {
    locale,
  });

  const personality = personalityRecord?.data?.content || {};
  const businessRules = rulesRecord?.data?.content || {};

  const charter = Object.freeze({
    identity: Object.freeze({
      name: personality.identity?.name || "ENARTE AI Assistant",
      role: personality.identity?.role || null,
      brandRef: personality.identity?.brandRef || "ENARTE",
      representsOnly: personality.identity?.representsOnly || "ENARTE",
      isGeneralAi: personality.identity?.isGeneralAi === true ? true : false,
    }),
    mission: Object.freeze({
      goals: Object.freeze([...(personality.mission?.goals || [])]),
    }),
    tone: Object.freeze({
      formality: personality.tone?.formality || null,
      warmth: personality.tone?.warmth || null,
      traits: Object.freeze([...(personality.tone?.traits || [])]),
      neverOverwhelmWithLongParagraphs: Boolean(
        personality.tone?.neverOverwhelmWithLongParagraphs,
      ),
      preferSmartActionButtons: Boolean(
        personality.tone?.preferSmartActionButtons,
      ),
    }),
    specialization: Object.freeze({
      domains: Object.freeze([...(personality.specialization?.domains || [])]),
      outOfScopePolicy: personality.specialization?.outOfScopePolicy || null,
      outOfScopeBehavior:
        personality.specialization?.outOfScopeBehavior || null,
    }),
    conversationPrinciples: Object.freeze({
      ...(personality.conversationPrinciples || {}),
    }),
    productRules: Object.freeze({
      recommendEnarteOnly: Boolean(personality.productRules?.recommendEnarteOnly),
      neverRecommendInternetProducts: Boolean(
        personality.productRules?.neverRecommendInternetProducts,
      ),
      neverInventProducts: Boolean(personality.productRules?.neverInventProducts),
      searchEnarteCatalogOnly: Boolean(
        businessRules.productSearch?.searchEnarteCatalogOnly,
      ),
      neverSearchInternet: Boolean(
        businessRules.productSearch?.neverSearchInternet,
      ),
      neverRecommendOutsideEnarte: Boolean(
        businessRules.productSearch?.neverRecommendOutsideEnarte,
      ),
    }),
    generalRules: Object.freeze({
      doNotInventInformation: Boolean(
        businessRules.generalRules?.doNotInventInformation,
      ),
      doNotInventProducts: Boolean(
        businessRules.generalRules?.doNotInventProducts,
      ),
      doNotInventPrices: Boolean(businessRules.generalRules?.doNotInventPrices),
      doNotInventAvailability: Boolean(
        businessRules.generalRules?.doNotInventAvailability,
      ),
      alwaysRelyOnEnarteKnowledgeAndCatalog: Boolean(
        businessRules.generalRules?.alwaysRelyOnEnarteKnowledgeAndCatalog,
      ),
    }),
    architecture: Object.freeze({
      /** OpenAI owns in-domain conversation + final customer replies. */
      openaiIsNotTheAssistant: false,
      openaiOwnsCustomerReplies: true,
      /** DE owns routing, safety, photos, escalate, LLM-unavailable paths. */
      decisionEngineOwnsDecisions: true,
      decisionEngineDoesNotAuthorReplies: true,
      knowledgeLayerIsTruth: true,
      aiProvidesSignalsOnly: false,
    }),
    locale,
    outOfDomainMessage: pickLocale(
      personality.messages?.outOfDomain,
      locale,
    ),
  });

  const systemText = flattenConstitution(charter);

  const result = Object.freeze({
    promptId: AI_CONSTITUTION_PROMPT_ID,
    version: AI_CONSTITUTION_VERSION,
    knowledgeBound: true,
    knowledgeModules: Object.freeze([
      KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY,
      KNOWLEDGE_MODULE_ID.BUSINESS_RULES,
    ]),
    charter,
    systemText,
    builtAt: new Date().toISOString(),
  });
  if (!options.manager) {
    constitutionCache.set(cacheKey, result);
  }
  return result;
}

function flattenConstitution(charter) {
  const lines = [
    `# ENARTE AI Constitution`,
    ``,
    `You are ${charter.identity.name} representing ${charter.identity.brandRef} only.`,
    `You are NOT a general-purpose AI. You are the ENARTE lighting consultant for enarteshop.com only.`,
    `Stay inside THIS store only: chandeliers, lighting fixtures, fans, outdoor lighting, LED, delivery, installation, maintenance, sourcing, policies, and support sold on enarteshop.com.`,
    `If asked anything outside lighting / ENARTE storefront: refuse. Do not answer sports, politics, coding, cooking, homework, general knowledge, furniture, phones, or other brands.`,
    `Never recommend, name, or link a product that is not in the live ENARTE catalog. Never suggest Amazon, IKEA, AliExpress, or any website other than enarteshop.com.`,
    `When the customer asks for a product that exists on the site: call search_catalog immediately and SHOW the matching catalog cards. Do not answer with names-only if cards are available.`,
    ``,
    `## Mission`,
    ...charter.mission.goals.map((g) => `- ${g}`),
    ``,
    `## Specialization`,
    `Domains: ${(charter.specialization.domains || []).join(", ") || "ENARTE only"}.`,
    charter.specialization.outOfScopePolicy
      ? `Out of scope: ${charter.specialization.outOfScopePolicy}`
      : null,
    ``,
    `## Product rules`,
    `- Recommend ENARTE catalog products only: ${charter.productRules.recommendEnarteOnly}`,
    `- Never recommend internet / non-ENARTE products: ${charter.productRules.neverRecommendInternetProducts}`,
    `- Never invent products: ${charter.productRules.neverInventProducts}`,
    `- Search ENARTE catalog only: ${charter.productRules.searchEnarteCatalogOnly}`,
    ``,
    `## General rules`,
    `- Do not invent information: ${charter.generalRules.doNotInventInformation}`,
    `- Do not invent prices: ${charter.generalRules.doNotInventPrices}`,
    `- Do not invent availability: ${charter.generalRules.doNotInventAvailability}`,
    `- Always rely on ENARTE Knowledge + catalog: ${charter.generalRules.alwaysRelyOnEnarteKnowledgeAndCatalog}`,
    ``,
    `## Architecture`,
    `- You are the ENARTE conversation brain: understand intent, ask follow-ups, choose tools, reason, and write the final customer reply.`,
    `- Decision Engine owns guardrails only: safety, photos, escalation, UX controls (main menu), and LLM-unavailable orchestration — it must NOT author or rewrite your replies.`,
    `- Knowledge Layer tools are the single source of business/policy truth — read them, then speak in your own consultant voice (never paste long scripts).`,
    `- Shopify catalog tools are the only product truth.`,
    `- Never act as a general ChatGPT. Stay strictly inside the ENARTE domain listed above.`,
  ].filter((line) => line != null);

  return lines.join("\n");
}

/**
 * Build constitution and register it in the Prompt Registry.
 */
export async function registerAiConstitution(options = {}) {
  const constitution = await buildAiConstitution(options);

  const record = registerPrompt(
    {
      promptId: constitution.promptId,
      version: constitution.version,
      kind: PROMPT_KIND.CONSTITUTION,
      packId: "constitution",
      description:
        "ENARTE AI Constitution — Knowledge-bound governing charter for AI capabilities.",
      variables: Object.freeze(["locale"]),
      messages: Object.freeze([
        Object.freeze({
          role: PROMPT_ROLE.SYSTEM,
          content: constitution.systemText,
          contentTemplate: null,
        }),
      ]),
      contentReady: true,
      knowledgeBound: true,
      knowledgeModules: constitution.knowledgeModules,
      status: PROMPT_STATUS.ACTIVE,
      source: "knowledge",
    },
    { allowContent: true },
  );

  return Object.freeze({
    constitution,
    record,
  });
}

export function getConstitutionSnapshot(constitution) {
  if (!constitution) return null;
  return Object.freeze({
    promptId: constitution.promptId,
    version: constitution.version,
    knowledgeBound: constitution.knowledgeBound,
    knowledgeModules: constitution.knowledgeModules,
    identityName: constitution.charter?.identity?.name || null,
    isGeneralAi: constitution.charter?.identity?.isGeneralAi === true,
    openaiIsNotTheAssistant:
      constitution.charter?.architecture?.openaiIsNotTheAssistant === true,
    openaiOwnsCustomerReplies:
      constitution.charter?.architecture?.openaiOwnsCustomerReplies === true,
    decisionEngineOwnsDecisions:
      constitution.charter?.architecture?.decisionEngineOwnsDecisions === true,
    systemTextLength: constitution.systemText?.length || 0,
  });
}
