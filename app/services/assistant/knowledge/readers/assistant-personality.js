/**
 * Read helpers for assistant_personality via Knowledge Manager.
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
export async function getAssistantPersonality(options = {}) {
  const manager = options.manager || getKnowledgeManager();
  const record = await manager.get(KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY, {
    locale: options.locale,
  });
  return record?.data?.content || null;
}

export async function getPersonalityMessage(key, locale = "ar", options = {}) {
  const content = await getAssistantPersonality({ ...options, locale });
  if (!content?.messages?.[key]) return "";
  return pickLocale(content.messages[key], locale);
}

export async function getPersonalitySourcingMessage(locale = "ar", options = {}) {
  const content = await getAssistantPersonality({ ...options, locale });
  return pickLocale(content?.sourcing?.messages, locale);
}

export async function getPersonalityImageAskMessage(locale = "ar", options = {}) {
  const content = await getAssistantPersonality({ ...options, locale });
  return pickLocale(content?.imageSearch?.messages?.askForPhoto, locale);
}

export async function getPersonalityRoomAskMessage(locale = "ar", options = {}) {
  const content = await getAssistantPersonality({ ...options, locale });
  return pickLocale(content?.roomRecommendation?.messages?.askForRoomPhoto, locale);
}
