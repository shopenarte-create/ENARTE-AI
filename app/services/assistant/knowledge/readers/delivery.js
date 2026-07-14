/**
 * Read helpers for delivery via Knowledge Manager.
 * Knowledge access only — do not embed delivery business logic in workflows.
 */

import { KNOWLEDGE_MODULE_ID } from "../constants.js";
import { getKnowledgeManager } from "../manager.js";
import { pickLocale } from "../../utils/locale.js";

/**
 * @param {object} [options]
 * @param {string} [options.locale]
 * @param {ReturnType<import("../manager.js").createKnowledgeManager>} [options.manager]
 */
export async function getDeliveryKnowledge(options = {}) {
  const manager = options.manager || getKnowledgeManager();
  const record = await manager.get(KNOWLEDGE_MODULE_ID.DELIVERY, {
    locale: options.locale,
  });
  return record?.data?.content || null;
}

export async function getAmmanDeliveryEstimate(options = {}) {
  const content = await getDeliveryKnowledge(options);
  return content?.amman?.estimatedDelivery || null;
}

export async function getDeliveryRegion(regionId, options = {}) {
  const content = await getDeliveryKnowledge(options);
  return content?.regions?.find((r) => r.id === regionId) || null;
}

export async function getDeliveryCustomerMessage(kind, locale = "ar", options = {}) {
  const content = await getDeliveryKnowledge({ ...options, locale });
  const map = content?.customerCommunication?.messages?.[kind];
  return pickLocale(map, locale);
}

export async function getAmmanDeliveryMessage(locale = "ar", options = {}) {
  const content = await getDeliveryKnowledge({ ...options, locale });
  return pickLocale(content?.amman?.messages, locale);
}
