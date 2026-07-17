/**
 * Taught answers — human-approved Q&A used as preferred truth over the LLM.
 * Train mode: approve ✓, correct ✎, or teach when there was no answer.
 */

import prisma from "../../../db.server.js";

/** @type {Map<string, object>} */
const memoryStore = new Map();

function memoryKey(shop, questionNorm) {
  return `${String(shop || "").toLowerCase()}::${questionNorm}`;
}

export function normalizeQuestion(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[؟?!.،,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    answer: row.answer,
    status: row.status,
    conversationId: row.conversationId || null,
    sourceMessageId: row.sourceMessageId || null,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt || null,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt || null,
  });
}

async function listFromDb(shop) {
  try {
    return await prisma.assistantTaughtAnswer.findMany({
      where: { shop, status: "approved" },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
  } catch {
    return null;
  }
}

function listFromMemory(shop) {
  const shopKey = String(shop || "").toLowerCase();
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
 * @returns {{ match: object|null, score: number }}
 */
export async function findTaughtAnswer({ shop, question, locale } = {}) {
  const questionNorm = normalizeQuestion(question);
  if (!shop || !questionNorm) {
    return Object.freeze({ match: null, score: 0 });
  }

  let rows = await listFromDb(shop);
  if (!rows) {
    rows = listFromMemory(shop);
  } else {
    // Merge memory overlays (newer local edits before migrate).
    const mem = listFromMemory(shop);
    const byNorm = new Map(rows.map((r) => [r.questionNorm, r]));
    for (const m of mem) {
      byNorm.set(m.questionNorm, m);
    }
    rows = [...byNorm.values()];
  }

  let best = null;
  let bestScore = 0;
  const localePrefix = String(locale || "ar").toLowerCase().slice(0, 2);

  for (const row of rows) {
    const rowLocale = String(row.locale || "ar").toLowerCase().slice(0, 2);
    // Prefer same locale; allow cross-locale only if score is exact.
    let score = scoreMatch(questionNorm, row.questionNorm);
    if (rowLocale !== localePrefix) {
      score *= 0.85;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  // Require a solid match so we don't force wrong taught answers.
  if (bestScore < 0.72) {
    return Object.freeze({ match: null, score: bestScore });
  }

  return Object.freeze({ match: toPublic(best), score: bestScore });
}

/**
 * Approve / create / correct a taught answer (upsert by normalized question).
 */
export async function upsertTaughtAnswer(input = {}) {
  const shop = String(input.shop || "").trim();
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
    return Object.freeze({ ok: true, answer: toPublic(row), persisted: true });
  } catch {
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
      note: "Stored in memory (DB unavailable). Run prisma migrate to persist.",
    });
  }
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
  // Dev convenience: allow train=1 locally regardless of the configured key.
  if (process.env.NODE_ENV !== "production") {
    return got === "1" || got === "true" || got === "train";
  }
  return false;
}
