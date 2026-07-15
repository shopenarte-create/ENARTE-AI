import { resolveProductImageBuffer } from "../placement/resolve-product-image.server.js";
import { createOpenAiVirtualTryRenderer } from "./adapters/openai-renderer.adapter.js";
import { assertRenderer } from "./ports/renderer.port.js";
import { analyzeRoom } from "./room-analysis.server.js";
import { buildLayoutPlan } from "./layout-planner.server.js";
import { resolveFixtureProducts } from "./product-resolver.server.js";
import {
  createVirtualTryJob,
  getVirtualTryJob,
  updateVirtualTryJob,
} from "./jobs.server.js";
import { JOB_STATUS, normalizeFixtureCount } from "./types.js";

function getRenderer() {
  return assertRenderer(createOpenAiVirtualTryRenderer());
}

/**
 * @param {{
 *   roomImage: Buffer,
 *   mimeType?: string,
 *   count: number,
 *   budgetId?: string,
 *   style?: string,
 *   lockedProduct?: object|null,
 *   forceCount?: boolean,
 *   acceptSuggestedCount?: boolean,
 *   shop?: string|null,
 * }} options
 */
export function startVirtualTryPipeline(options) {
  const count = normalizeFixtureCount(options.count);
  const job = createVirtualTryJob({
    roomImage: options.roomImage,
    mimeType: options.mimeType,
    options: {
      ...options,
      count,
    },
  });

  queueMicrotask(() => runPipeline(job.id).catch((error) => {
    console.error("[virtual-try] pipeline crash", error);
    updateVirtualTryJob(job.id, {
      status: JOB_STATUS.ERROR,
      error: error?.message || "تعذر إكمال تجربة الغرفة",
      code: error?.code || "VIRTUAL_TRY_FAILED",
    });
  }));

  return job.id;
}

/**
 * Resume after needs_confirmation.
 */
export function continueVirtualTryPipeline(jobId, decision = {}) {
  const job = getVirtualTryJob(jobId);
  if (!job) {
    const err = new Error("المهمة غير موجودة أو انتهت صلاحيتها");
    err.code = "JOB_NOT_FOUND";
    throw err;
  }
  if (job.status !== JOB_STATUS.NEEDS_CONFIRMATION) {
    const err = new Error("لا يمكن استئناف هذه المهمة في حالتها الحالية");
    err.code = "JOB_NOT_RESUMABLE";
    throw err;
  }

  job.options = {
    ...job.options,
    forceCount: Boolean(decision.forceCount),
    acceptSuggestedCount: Boolean(decision.acceptSuggestedCount),
  };

  updateVirtualTryJob(jobId, {
    status: JOB_STATUS.QUEUED,
    error: null,
    code: null,
  });

  queueMicrotask(() => runPipeline(jobId, { resume: true }).catch((error) => {
    updateVirtualTryJob(jobId, {
      status: JOB_STATUS.ERROR,
      error: error?.message || "تعذر إكمال تجربة الغرفة",
      code: error?.code || "VIRTUAL_TRY_FAILED",
    });
  }));

  return jobId;
}

async function runPipeline(jobId, { resume = false } = {}) {
  const job = getVirtualTryJob(jobId);
  if (!job) return;

  const opts = job.options || {};
  const renderer = getRenderer();

  // --- Analyze ---
  if (!resume || !job.analysis) {
    updateVirtualTryJob(jobId, { status: JOB_STATUS.ANALYZING });
    const analysis = await analyzeRoom(job.roomImage, { style: opts.style });
    updateVirtualTryJob(jobId, { analysis });
  }

  const analysis = getVirtualTryJob(jobId).analysis;

  // --- Layout ---
  const layout = buildLayoutPlan(analysis, opts.count, {
    forceCount: opts.forceCount,
    acceptSuggestedCount: opts.acceptSuggestedCount,
  });
  updateVirtualTryJob(jobId, { layout });

  if (layout.countMismatch) {
    updateVirtualTryJob(jobId, {
      status: JOB_STATUS.NEEDS_CONFIRMATION,
      meta: {
        phase: "confirm_count",
        suggestedCount: layout.suggestedCount,
        requestedCount: layout.requestedCount,
      },
    });
    return;
  }

  // --- Products ---
  const fixtures = await resolveFixtureProducts({
    layout,
    lockedProduct: opts.lockedProduct,
    analysis,
    budgetId: opts.budgetId,
    shop: opts.shop,
  });
  updateVirtualTryJob(jobId, { fixtures });

  // --- Prepare ceiling ---
  updateVirtualTryJob(jobId, { status: JOB_STATUS.PREPARING });
  const prepared = await renderer.prepareCeiling({
    roomImage: job.roomImage,
    analysis,
  });
  updateVirtualTryJob(jobId, { preparedImage: prepared.image });

  // --- Resolve product images ---
  const productBuffers = await Promise.all(
    fixtures.map(async (f) => {
      const resolved = await resolveProductImageBuffer({
        imageUrl: f.product?.image,
        productId: f.product?.id,
      });
      if (!resolved?.buffer) {
        throw new Error(`تعذر تحميل صورة المنتج: ${f.product?.title || f.id}`);
      }
      return resolved.buffer;
    }),
  );

  // --- Install ---
  updateVirtualTryJob(jobId, { status: JOB_STATUS.INSTALLING });
  const installed = await renderer.installFixtures({
    roomImage: prepared.image,
    fixtures,
    productImages: productBuffers,
    analysis,
    layout,
  });

  updateVirtualTryJob(jobId, {
    status: JOB_STATUS.DONE,
    image: installed.image,
    resultMimeType: installed.mimeType || "image/jpeg",
    meta: {
      phase: "done",
      prepare: prepared.meta || {},
      install: installed.meta || {},
      engineId: installed.engineId,
      fixtureCount: fixtures.length,
    },
  });
}
