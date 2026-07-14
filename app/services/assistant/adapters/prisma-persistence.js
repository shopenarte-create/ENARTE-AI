/**
 * Prisma persistence adapter for assistant conversations / messages / events.
 * Falls back gracefully when the database is unavailable (tests / local).
 */

import { ADAPTER_STATUS } from "../constants.js";
import { logAssistantError } from "../utils/logging.js";

let prismaClient = null;
let persistenceCircuitOpen = false;

function isLocalDbKnownDown() {
  const url = String(process.env.DATABASE_URL || "");
  return (
    String(process.env.ENARTE_MEMORY_SESSION || "").toLowerCase() === "true" ||
    url.includes("localhost:51214") ||
    url.includes("127.0.0.1:51214")
  );
}

function shouldSkipPersistence() {
  if (persistenceCircuitOpen) return true;
  if (isLocalDbKnownDown()) return true;
  if (String(process.env.ASSISTANT_PERSISTENCE || "").toLowerCase() === "false") {
    return true;
  }
  return false;
}

function markPersistenceUnavailable(error) {
  const name = error?.name || "";
  const message = String(error?.message || "");
  if (
    name === "PrismaClientInitializationError" ||
    /can't reach database server|ECONNREFUSED|connect timeout/i.test(message)
  ) {
    persistenceCircuitOpen = true;
  }
}

async function getPrisma() {
  if (shouldSkipPersistence()) return null;
  if (prismaClient) return prismaClient;
  try {
    const mod = await import("../../../db.server.js");
    prismaClient = mod.default;
    return prismaClient;
  } catch (error) {
    logAssistantError("persistence.prisma_import_failed", error);
    return null;
  }
}

function toPublicMessage(row) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return Object.freeze({
    id: row.id,
    role: row.role,
    type: meta.type || "text",
    content: row.content || null,
    cards: meta.cards || null,
    actions: meta.actions || null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt,
    meta: Object.freeze({
      workflowId: row.workflowId || null,
      ...meta,
    }),
  });
}

function hasModel(prisma, name) {
  const model = prisma?.[name];
  return Boolean(model && typeof model.create === "function");
}

export function createPrismaPersistenceAdapter() {
  return Object.freeze({
    id: "persistence.prisma",
    status: ADAPTER_STATUS.ACTIVE,
    description: "Prisma persistence for assistant conversations (V1).",

    async saveConversation(session) {
      const prisma = await getPrisma();
      if (!hasModel(prisma, "assistantConversation")) {
        return Object.freeze({ ok: false, degraded: true, error: "db_unavailable" });
      }
      try {
        const row = await prisma.assistantConversation.upsert({
          where: { id: session.id },
          create: {
            id: session.id,
            shop: session.shop,
            channel: session.channel || "api",
            locale: session.locale || "ar",
            status: session.status || "active",
            metadata: session.metadata || {},
          },
          update: {
            locale: session.locale || "ar",
            status: session.status || "active",
            metadata: session.metadata || {},
          },
        });
        return Object.freeze({ ok: true, id: row.id, persisted: true });
      } catch (error) {
        markPersistenceUnavailable(error);
        logAssistantError("persistence.saveConversation", error, {
          conversationId: session?.id,
        });
        return Object.freeze({ ok: false, degraded: true, error: "persist_failed" });
      }
    },

    async updateConversationMetadata(conversationId, metadata) {
      const prisma = await getPrisma();
      if (!hasModel(prisma, "assistantConversation") || !conversationId) {
        return Object.freeze({ ok: false, degraded: true });
      }
      try {
        await prisma.assistantConversation.update({
          where: { id: conversationId },
          data: { metadata: metadata || {} },
        });
        return Object.freeze({ ok: true });
      } catch (error) {
        markPersistenceUnavailable(error);
        logAssistantError("persistence.updateMetadata", error, { conversationId });
        return Object.freeze({ ok: false, degraded: true });
      }
    },

    async appendMessage(conversationId, message) {
      const prisma = await getPrisma();
      if (!hasModel(prisma, "assistantMessage") || !conversationId) {
        return Object.freeze({ ok: false, degraded: true });
      }
      try {
        const row = await prisma.assistantMessage.create({
          data: {
            id: message.id,
            conversationId,
            role: message.role,
            content: message.content || "",
            workflowId: message.meta?.workflowId || message.workflowId || null,
            metadata: {
              type: message.type || "text",
              cards: message.cards || null,
              actions: message.actions || null,
              ...(message.meta || {}),
            },
          },
        });
        return Object.freeze({ ok: true, id: row.id, persisted: true });
      } catch (error) {
        markPersistenceUnavailable(error);
        logAssistantError("persistence.appendMessage", error, { conversationId });
        return Object.freeze({ ok: false, degraded: true });
      }
    },

    async recordEvent({ shop, conversationId, type, payload }) {
      const prisma = await getPrisma();
      if (!hasModel(prisma, "assistantEvent") || !shop || !type) {
        return Object.freeze({ ok: false, degraded: true });
      }
      try {
        const row = await prisma.assistantEvent.create({
          data: {
            shop,
            conversationId: conversationId || null,
            type,
            payload: payload || {},
          },
        });
        return Object.freeze({ ok: true, id: row.id, persisted: true });
      } catch (error) {
        markPersistenceUnavailable(error);
        logAssistantError("persistence.recordEvent", error, {
          conversationId,
          type,
        });
        return Object.freeze({ ok: false, degraded: true });
      }
    },

    async loadConversation(conversationId) {
      const prisma = await getPrisma();
      if (!hasModel(prisma, "assistantConversation") || !conversationId) {
        return Object.freeze({ ok: false, error: "db_unavailable" });
      }
      try {
        const row = await prisma.assistantConversation.findUnique({
          where: { id: conversationId },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
          },
        });
        if (!row) {
          return Object.freeze({ ok: false, error: "session_not_found" });
        }
        return Object.freeze({
          ok: true,
          session: Object.freeze({
            id: row.id,
            shop: row.shop,
            channel: row.channel,
            locale: row.locale,
            status: row.status,
            metadata: row.metadata || {},
            createdAt:
              row.createdAt instanceof Date
                ? row.createdAt.toISOString()
                : row.createdAt,
          }),
          messages: Object.freeze(row.messages.map(toPublicMessage)),
          persisted: true,
        });
      } catch (error) {
        markPersistenceUnavailable(error);
        logAssistantError("persistence.loadConversation", error, {
          conversationId,
        });
        return Object.freeze({ ok: false, error: "load_failed" });
      }
    },
  });
}

let singleton = null;

export function getPrismaPersistenceAdapter() {
  if (!singleton) singleton = createPrismaPersistenceAdapter();
  return singleton;
}
