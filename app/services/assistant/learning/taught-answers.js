/**
 * Taught answers — human-approved Q&A used as preferred truth over the LLM.
 * Always persists to Postgres when available so web, mobile, and app share one brain.
 */

import prisma from "../../../db.server.js";
import { logAssistant, logAssistantError } from "../utils/logging.js";

/** @type {Map<string, object>} */
const memoryStore = new Map();

export function normalizeShop(shop = "") {
  return String(shop || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export function normalizeQuestion(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKC")
    // Arabic alef / teh marbuta / alef maqsura variants
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    // Strip Arabic diacritics / tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[؟?!.،,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function memoryKey(shop, questionNorm) {
  return `${normalizeShop(shop)}::${questionNorm}`;
}

function tokens(norm) {
  return norm.split(" ").filter((t) => t.length > 1);
}

function scoreMatch(queryNorm, candidateNorm) {
  if (!queryNorm || !candidateNorm) return 0;
  if (queryNorm === candidateNorm) return 1;
  if (queryNorm.includes(candidateNorm) || candidateNorm.includes(queryNorm)) {
    return 0.92;
  }
  const q = new Set(tokens(queryNorm));
  const c = new Set(tokens(candidateNorm));
  if (!q.size || !c.size) return 0;
  let overlap = 0;
  for (const t of q) {
    if (c.has(t)) overlap += 1;
  }
  const union = new Set([...q, ...c]).size;
  return union ? overlap / union : 0;
}

function toPublic(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    shop: row.shop,
    locale: row.locale,
    question: row.question,
    questionNorm: row.questionNorm || normalizeQuestion(row.question),
    answer: row.answer,
    status: row.status,
    conversationId: row.conversationId || null,
    sourceMessageId: row.sourceMessageId || null,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt || null,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt || null,
  });
}

function dbReady() {
  return Boolean(
    prisma?.assistantTaughtAnswer &&
      typeof prisma.assistantTaughtAnswer.findMany === "function",
  );
}

async function listFromDb(shop) {
  if (!dbReady()) return null;
  try {
    return await prisma.assistantTaughtAnswer.findMany({
      where: { shop: normalizeShop(shop), status: "approved" },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
  } catch (error) {
    logAssistantError("taught.list_failed", error, { shop });
    return null;
  }
}

function listFromMemory(shop) {
  const shopKey = normalizeShop(shop);
  const rows = [];
  for (const [key, row] of memoryStore.entries()) {
    if (key.startsWith(`${shopKey}::`) && row.status === "approved") {
      rows.push(row);
    }
  }
  return rows;
}

/**
 * Find the best approved answer for a customer question.
 * Shared by web, mobile site, and the native app.
 */
export async function findTaughtAnswer({ shop, question, locale } = {}) {
  const shopNorm = normalizeShop(shop);
  const questionNorm = normalizeQuestion(question);
  if (!shopNorm || !questionNorm) {
    return Object.freeze({ match: null, score: 0, source: "none" });
  }

  let source = "memory";
  let rows = await listFromDb(shopNorm);
  if (rows) {
    source = "database";
    const mem = listFromMemory(shopNorm);
    const byNorm = new Map(rows.map((r) => [r.questionNorm, r]));
    for (const m of mem) {
      byNorm.set(m.questionNorm, m);
    }
    rows = [...byNorm.values()];
  } else {
    rows = listFromMemory(shopNorm);
  }

  let best = null;
  let bestScore = 0;
  const localePrefix = String(locale || "ar").toLowerCase().slice(0, 2);

  for (const row of rows) {
    const rowLocale = String(row.locale || "ar").toLowerCase().slice(0, 2);
    let score = scoreMatch(questionNorm, row.questionNorm || normalizeQuestion(row.question));
    if (rowLocale !== localePrefix) {
      score *= 0.9;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  // Solid match required so we don't force wrong taught answers.
  if (bestScore < 0.65) {
    return Object.freeze({ match: null, score: bestScore, source, total: rows.length });
  }

  return Object.freeze({
    match: toPublic(best),
    score: bestScore,
    source,
    total: rows.length,
  });
}

/**
 * Approve / create / correct a taught answer (upsert by normalized question).
 */
export async function upsertTaughtAnswer(input = {}) {
  const shop = normalizeShop(input.shop);
  const question = String(input.question || "").trim();
  const answer = String(input.answer || "").trim();
  const locale = String(input.locale || "ar").trim() || "ar";
  const questionNorm = normalizeQuestion(question);

  if (!shop) return Object.freeze({ ok: false, error: "shop_required" });
  if (!questionNorm) return Object.freeze({ ok: false, error: "question_required" });
  if (!answer) return Object.freeze({ ok: false, error: "answer_required" });

  const payload = {
    shop,
    locale,
    question,
    questionNorm,
    answer,
    status: "approved",
    conversationId: input.conversationId || null,
    sourceMessageId: input.sourceMessageId || null,
  };

  if (dbReady()) {
    try {
      const row = await prisma.assistantTaughtAnswer.upsert({
        where: {
          shop_questionNorm: { shop, questionNorm },
        },
        create: payload,
        update: {
          question,
          answer,
          locale,
          status: "approved",
          conversationId: payload.conversationId,
          sourceMessageId: payload.sourceMessageId,
        },
      });
      memoryStore.set(memoryKey(shop, questionNorm), row);
      logAssistant("taught.upsert_persisted", {
        shop,
        questionNorm,
        id: row.id,
      });
      return Object.freeze({ ok: true, answer: toPublic(row), persisted: true });
    } catch (error) {
      logAssistantError("taught.upsert_db_failed", error, {
        shop,
        questionNorm,
      });
    }
  } else {
    logAssistantError(
      "taught.db_model_missing",
      new Error("assistantTaughtAnswer model unavailable — run prisma migrate deploy"),
      { shop },
    );
  }

  const id = `taught_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const row = {
    id,
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.set(memoryKey(shop, questionNorm), row);
  return Object.freeze({
    ok: true,
    answer: toPublic(row),
    persisted: false,
    note: "Stored in memory only — not shared across devices until DB migrate succeeds.",
  });
}

export async function countTaughtAnswers(shop) {
  const shopNorm = normalizeShop(shop);
  const fromDb = await listFromDb(shopNorm);
  if (fromDb) {
    return Object.freeze({
      ok: true,
      count: fromDb.length,
      source: "database",
      persisted: true,
    });
  }
  return Object.freeze({
    ok: true,
    count: listFromMemory(shopNorm).length,
    source: "memory",
    persisted: false,
  });
}

/**
 * Built-in activation code so the owner can enable train mode with a single
 * link, even before ASSISTANT_TRAIN_KEY is configured on the host. Override it
 * by setting ASSISTANT_TRAIN_KEY to a private value in production.
 */
export const DEFAULT_TRAIN_KEY = "enarte-owner-train";

export function verifyTrainKey(provided) {
  const expected = String(
    process.env.ASSISTANT_TRAIN_KEY || DEFAULT_TRAIN_KEY,
  ).trim();
  const got = String(provided || "").trim();
  if (!got) return false;
  if (got === expected) return true;
  if (process.env.NODE_ENV !== "production") {
    return got === "1" || got === "true" || got === "train";
  }
  return false;
}
