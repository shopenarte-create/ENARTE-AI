/**
 * Read helpers for business_rules via Knowledge Manager.
 * Safe for UX / Decision Engine — not for embedding rules inside workflows.
 */

import { KNOWLEDGE_MODULE_ID } from "../constants.js";
import { getKnowledgeManager } from "../manager.js";
import { pickLocale } from "../../utils/locale.js";

/**
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {ReturnType<import("../manager.js").createKnowledgeManager>} [options.manager]
 */
export async function getBusinessRules(options = {}) {
  const manager = options.manager || getKnowledgeManager();
  const record = await manager.get(KNOWLEDGE_MODULE_ID.BUSINESS_RULES, {
    locale: options.locale,
  });
  return record?.data?.content || null;
}

export async function getBusinessRuleMessage(section, locale = "ar", options = {}) {
  const content = await getBusinessRules({ ...options, locale });
  if (!content?.[section]?.messages) return "";
  return pickLocale(content[section].messages, locale);
}

export async function getInstallationContact(options = {}) {
  const content = await getBusinessRules(options);
  return content?.installationMaintenance?.contact || null;
}

export async function getAmmanDeliveryWindow(options = {}) {
  const content = await getBusinessRules(options);
  return content?.delivery?.amman || null;
}
