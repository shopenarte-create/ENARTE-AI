/**
 * In-memory async placement jobs.
 * Lets gpt-image-1 finish past Shopify App Proxy's ~30s limit:
 * POST starts the job quickly; client polls until the image is ready.
 */

import { randomUUID } from "crypto";

/** @typedef {{ id: string, status: 'queued'|'running'|'done'|'error', createdAt: number, updatedAt: number, error?: string, code?: string, image?: Buffer, mimeType?: string, meta?: object }} PlaceJob */

/** @type {Map<string, PlaceJob>} */
const jobs = new Map();

const TTL_MS = 15 * 60 * 1000;
const MAX_JOBS = 80;

function prune() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > TTL_MS) jobs.delete(id);
  }
  if (jobs.size <= MAX_JOBS) return;
  const oldest = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  for (const job of oldest.slice(0, jobs.size - MAX_JOBS)) {
    jobs.delete(job.id);
  }
}

/**
 * @param {() => Promise<{ image: Buffer, mimeType?: string, meta?: object, engineId?: string }>} runner
 */
export function startPlaceJob(runner) {
  prune();
  const id = randomUUID();
  /** @type {PlaceJob} */
  const job = {
    id,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(id, job);

  queueMicrotask(async () => {
    const current = jobs.get(id);
    if (!current) return;
    current.status = "running";
    current.updatedAt = Date.now();
    try {
      const result = await runner();
      current.status = "done";
      current.image = result.image;
      current.mimeType = result.mimeType || "image/jpeg";
      current.meta = {
        ...(result.meta || {}),
        engineId: result.engineId || result.meta?.rendererId || null,
      };
      current.updatedAt = Date.now();
    } catch (error) {
      current.status = "error";
      current.error = error?.message || "تعذر توليد صورة التركيب";
      current.code = error?.code || "PLACE_FAILED";
      current.updatedAt = Date.now();
      console.error("[place-job] failed", {
        id,
        message: current.error,
        code: current.code,
      });
    }
  });

  return id;
}

export function getPlaceJob(id) {
  prune();
  return jobs.get(String(id || "")) || null;
}
