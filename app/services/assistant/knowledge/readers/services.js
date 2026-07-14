/**
 * Read helpers for services via Knowledge Manager.
 * Safe for UX / Decision Engine — not for embedding service logic in workflows.
 */

import { KNOWLEDGE_MODULE_ID } from "../constants.js";
import { getKnowledgeManager } from "../manager.js";
import { pickLocale } from "../../utils/locale.js";

/**
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {ReturnType<import("../manager.js").createKnowledgeManager>} [options.manager]
 */
export async function getServicesKnowledge(options = {}) {
  const manager = options.manager || getKnowledgeManager();
  const record = await manager.get(KNOWLEDGE_MODULE_ID.SERVICES, {
    locale: options.locale,
  });
  return record?.data?.content || null;
}

export async function getServiceOffering(serviceId, options = {}) {
  const content = await getServicesKnowledge(options);
  return content?.offerings?.find((o) => o.id === serviceId) || null;
}

export async function getServicesContact(options = {}) {
  const content = await getServicesKnowledge(options);
  return content?.contact || null;
}

export async function getServiceRuleMessage(locale = "ar", options = {}) {
  const content = await getServicesKnowledge({ ...options, locale });
  return pickLocale(content?.serviceRules?.messages, locale);
}

export async function getCustomLightingMessage(locale = "ar", options = {}) {
  const content = await getServicesKnowledge({ ...options, locale });
  return pickLocale(content?.customLighting?.messages, locale);
}
