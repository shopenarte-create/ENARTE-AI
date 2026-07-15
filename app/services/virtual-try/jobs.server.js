import { randomUUID } from "crypto";
import { JOB_STATUS } from "./types.js";

/**
 * In-memory virtual-try jobs (analyzing → confirm → prepare → install).
 */

/** @typedef {object} VirtualTryJob */

/** @type {Map<string, VirtualTryJob>} */
const jobs = new Map();

const TTL_MS = 20 * 60 * 1000;
const MAX_JOBS = 60;

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
 * @param {Partial<VirtualTryJob> & { roomImage: Buffer, options: object }} seed
 */
export function createVirtualTryJob(seed) {
  prune();
  const id = randomUUID();
  const job = {
    id,
    status: JOB_STATUS.QUEUED,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    roomImage: seed.roomImage,
    mimeType: seed.mimeType || "image/jpeg",
    options: seed.options || {},
    analysis: null,
    layout: null,
    fixtures: null,
    preparedImage: null,
    image: null,
    resultMimeType: "image/jpeg",
    error: null,
    code: null,
    meta: {},
  };
  jobs.set(id, job);
  return job;
}

export function getVirtualTryJob(id) {
  prune();
  return jobs.get(String(id || "")) || null;
}

export function updateVirtualTryJob(id, patch) {
  const job = getVirtualTryJob(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}

/**
 * Public JSON (no buffers).
 */
export function toPublicVirtualTryJob(job, { includeImageDataUrl = false } = {}) {
  if (!job) return null;
  const base = {
    ok: job.status !== JOB_STATUS.ERROR,
    jobId: job.id,
    status: job.status,
    analysis: job.analysis
      ? {
          roomType: job.analysis.roomType,
          roomTypeLabelAr: job.analysis.roomTypeLabelAr,
          style: job.analysis.style,
          areaHintSqm: job.analysis.areaHintSqm,
          ceilingHeightM: job.analysis.ceilingHeightM,
          needsCeilingCleanup: job.analysis.needsCeilingCleanup,
          hasExistingFixtures: job.analysis.hasExistingFixtures,
          summaryAr: job.analysis.summaryAr,
        }
      : null,
    layout: job.layout
      ? {
          requestedCount: job.layout.requestedCount,
          suggestedCount: job.layout.suggestedCount,
          countMismatch: job.layout.countMismatch,
          suggestionReasonAr: job.layout.suggestionReasonAr,
          roomType: job.layout.roomType,
          mountCount: job.layout.mounts?.length || 0,
        }
      : null,
    products: (job.fixtures || []).map((f) => f.product).filter(Boolean),
    error: job.error || null,
    code: job.code || null,
    meta: job.meta || {},
  };

  if (includeImageDataUrl && job.image && job.status === JOB_STATUS.DONE) {
    base.imageDataUrl = `data:${job.resultMimeType || "image/jpeg"};base64,${job.image.toString("base64")}`;
    base.mimeType = job.resultMimeType || "image/jpeg";
  }

  return base;
}
