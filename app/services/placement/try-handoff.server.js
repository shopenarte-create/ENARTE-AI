import { randomUUID } from "crypto";
import prisma from "../../db.server.js";

/**
 * Short-lived room-image handoff for storefront → /try.
 * Memory cache for speed + Prisma for production durability / multi-instance.
 */
const MEMORY = new Map();
const TTL_MS = 15 * 60 * 1000;
const MAX_BYTES = 8 * 1024 * 1024;

function pruneMemory() {
  const now = Date.now();
  for (const [id, entry] of MEMORY.entries()) {
    if (entry.expiresAt <= now) MEMORY.delete(id);
  }
}

async function pruneDb() {
  try {
    await prisma.tryHandoff.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  } catch (error) {
    console.warn("[try-handoff] pruneDb failed:", error?.message || error);
  }
}

function toEntry(row) {
  if (!row) return null;
  let product = null;
  if (row.productJson) {
    try {
      product = JSON.parse(row.productJson);
    } catch {
      product = null;
    }
  }
  return {
    buffer: Buffer.isBuffer(row.image) ? row.image : Buffer.from(row.image),
    mimeType: row.mimeType || "image/jpeg",
    product,
    expiresAt:
      row.expiresAt instanceof Date
        ? row.expiresAt.getTime()
        : Number(row.expiresAt) || Date.now() + TTL_MS,
  };
}

export async function saveTryHandoff({
  buffer,
  mimeType = "image/jpeg",
  product = null,
}) {
  pruneMemory();
  if (!buffer?.length) {
    const err = new Error("صورة الغرفة مطلوبة.");
    err.code = "ROOM_REQUIRED";
    throw err;
  }
  if (buffer.length > MAX_BYTES) {
    const err = new Error("صورة الغرفة كبيرة جداً — جرّب صورة أوضح بحجم أصغر.");
    err.code = "ROOM_TOO_LARGE";
    throw err;
  }

  const id = randomUUID();
  const expiresAt = Date.now() + TTL_MS;
  const entry = {
    buffer,
    mimeType: mimeType || "image/jpeg",
    product,
    expiresAt,
  };
  MEMORY.set(id, entry);

  try {
    await prisma.tryHandoff.create({
      data: {
        id,
        mimeType: entry.mimeType,
        image: buffer,
        productJson: product ? JSON.stringify(product) : null,
        expiresAt: new Date(expiresAt),
      },
    });
  } catch (error) {
    // Memory still works on a single instance; log for ops.
    console.error("[try-handoff] db persist failed:", {
      id,
      message: error?.message || String(error),
      code: error?.code,
    });
  }

  // Fire-and-forget cleanup
  pruneDb().catch(() => {});

  console.info("[try-handoff] saved", {
    id,
    bytes: buffer.length,
    mimeType: entry.mimeType,
    hasProduct: Boolean(product?.id || product?.image),
  });

  return id;
}

export async function peekTryHandoff(id) {
  if (!id) return null;
  pruneMemory();
  const mem = MEMORY.get(id);
  if (mem && mem.expiresAt > Date.now()) {
    return mem;
  }
  if (mem) MEMORY.delete(id);

  try {
    const row = await prisma.tryHandoff.findUnique({ where: { id } });
    if (!row || row.expiresAt <= new Date()) {
      if (row) {
        await prisma.tryHandoff.delete({ where: { id } }).catch(() => {});
      }
      return null;
    }
    const entry = toEntry(row);
    MEMORY.set(id, entry);
    return entry;
  } catch (error) {
    console.error("[try-handoff] peek failed:", id, error?.message || error);
    return null;
  }
}

export async function takeTryHandoff(id) {
  const entry = await peekTryHandoff(id);
  if (!entry) return null;
  MEMORY.delete(id);
  try {
    await prisma.tryHandoff.delete({ where: { id } });
  } catch (error) {
    console.warn("[try-handoff] take db delete:", error?.message || error);
  }
  return entry;
}
