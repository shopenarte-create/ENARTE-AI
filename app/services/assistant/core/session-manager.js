/**
 * Session manager — conversation lifecycle boundary.
 * Phase 1: creates structured session descriptors; persistence is adapter-backed stub.
 */

import { CHANNEL, CONVERSATION_STATUS, EVENT_TYPE } from "../constants.js";
import { getAssistantConfig } from "../config/index.js";
import { publish } from "./event-bus.js";

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Open a new assistant session descriptor.
 * Does not call LLMs or run workflows.
 */
export async function createSession(input = {}) {
  const config = getAssistantConfig();
  const shop = input.shop || null;

  if (!shop) {
    return Object.freeze({
      ok: false,
      error: "shop_required",
      note: "Assistant sessions are shop-scoped.",
    });
  }

  const session = Object.freeze({
    id: input.id || createId("aconv"),
    shop,
    channel: input.channel || config.runtime.defaultChannel || CHANNEL.API,
    locale: input.locale || config.runtime.defaultLocale,
    status: CONVERSATION_STATUS.ACTIVE,
    metadata: Object.freeze({ ...(input.metadata || {}) }),
    createdAt: new Date().toISOString(),
  });

  await publish(EVENT_TYPE.SESSION_CREATED, {
    conversationId: session.id,
    shop: session.shop,
    channel: session.channel,
  });

  return Object.freeze({
    ok: true,
    session,
    persisted: false,
    note: "Session descriptor created; chat API persists via Prisma when available.",
  });
}

export function buildSessionContext(session, extras = {}) {
  const config = getAssistantConfig();
  return Object.freeze({
    shop: session.shop,
    conversationId: session.id,
    locale: session.locale,
    channel: session.channel,
    config,
    metadata: Object.freeze({
      ...(session.metadata || {}),
      ...(extras.metadata || {}),
    }),
    ...extras,
  });
}
