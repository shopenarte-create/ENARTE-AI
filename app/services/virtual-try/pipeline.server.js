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

/** Dual gpt-image passes are ~2× slower. Default: single combined pass. */
function useDualPass() {
  return String(process.env.ENARTE_VIRTUAL_TRY_DUAL_PASS || "") === "1";
}

/**
 * Soft-skip confirmation when mismatch is small (saves a full round-trip wait).
 * Large mismatches (|diff| >= 2) still ask the user.
 */
function shouldPauseForCountConfirm(layout, opts) {
  if (!layout?.countMismatch) return false;
  if (opts.forceCount || opts.acceptSuggestedCount) return false;
  const diff = Math.abs(
    Number(layout.requestedCount) - Number(layout.suggestedCount),
  );
  return diff >= 2;
}

function heuristicAnalysis(style) {
  return {
    roomType: "living",
    roomTypeLabelAr: "غرفة معيشة",
    style: style || "modern",
    areaHintSqm: 22,
    ceilingHeightM: 2.8,
    needsCeilingCleanup: true,
    hasExistingFixtures: true,
    summaryAr: "توزيع تلقائي سريع حسب أفضل الممارسات.",
    anchors: {
      seating: { x: 50, y: 60 },
      table: { x: 50, y: 55 },
      bed: { x: 50, y: 58 },
      corridor: { x: 50, y: 40 },
    },
    rawText: "",
  };
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

  queueMicrotask(() =>
    runPipeline(job.id).catch((error) => {
      console.error("[virtual-try] pipeline crash", error);
      updateVirtualTryJob(job.id, {
        status: JOB_STATUS.ERROR,
        error: error?.message || "تعذر إكمال تجربة الغرفة",
        code: error?.code || "VIRTUAL_TRY_FAILED",
      });
    }),
  );

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

  queueMicrotask(() =>
    runPipeline(jobId, { resume: true }).catch((error) => {
      updateVirtualTryJob(jobId, {
        status: JOB_STATUS.ERROR,
        error: error?.message || "تعذر إكمال تجربة الغرفة",
        code: error?.code || "VIRTUAL_TRY_FAILED",
      });
    }),
  );

  return jobId;
}

async function runPipeline(jobId, { resume = false } = {}) {
  const job = getVirtualTryJob(jobId);
  if (!job) return;

  const opts = job.options || {};
  const renderer = getRenderer();
  const dualPass = useDualPass();

  // --- Analyze (skip slow vision when product is locked) ---
  if (!resume || !job.analysis) {
    updateVirtualTryJob(jobId, { status: JOB_STATUS.ANALYZING });
    let analysis;
    if (opts.lockedProduct) {
      analysis = heuristicAnalysis(opts.style);
    } else {
      analysis = await analyzeRoom(job.roomImage, { style: opts.style });
    }
    updateVirtualTryJob(jobId, { analysis });
  }

  const analysis = getVirtualTryJob(jobId).analysis;

  // --- Layout ---
  let layout = buildLayoutPlan(analysis, opts.count, {
    forceCount: opts.forceCount,
    acceptSuggestedCount: opts.acceptSuggestedCount,
  });

  if (shouldPauseForCountConfirm(layout, opts)) {
    updateVirtualTryJob(jobId, {
      layout,
      status: JOB_STATUS.NEEDS_CONFIRMATION,
      meta: {
        phase: "confirm_count",
        suggestedCount: layout.suggestedCount,
        requestedCount: layout.requestedCount,
      },
    });
    return;
  }

  // Auto-continue small mismatches with user's chosen count
  if (layout.countMismatch && !opts.acceptSuggestedCount) {
    layout = buildLayoutPlan(analysis, opts.count, { forceCount: true });
  }
  updateVirtualTryJob(jobId, { layout });

  // --- Products ---
  const fixtures = await resolveFixtureProducts({
    layout,
    lockedProduct: opts.lockedProduct,
    analysis,
    budgetId: opts.budgetId,
    shop: opts.shop,
  });
  updateVirtualTryJob(jobId, { fixtures });

  // Resolve product images while we update status (before single render)
  updateVirtualTryJob(jobId, {
    status: dualPass ? JOB_STATUS.PREPARING : JOB_STATUS.INSTALLING,
  });

  const productBuffersPromise = Promise.all(
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

  let roomForInstall = job.roomImage;
  let prepareMeta = null;

  if (dualPass) {
    const prepared = await renderer.prepareCeiling({
      roomImage: job.roomImage,
      analysis,
    });
    roomForInstall = prepared.image;
    prepareMeta = prepared.meta || {};
    updateVirtualTryJob(jobId, {
      preparedImage: prepared.image,
      status: JOB_STATUS.INSTALLING,
    });
  }

  const productBuffers = await productBuffersPromise;

  const installed = await renderer.installFixtures({
    roomImage: roomForInstall,
    fixtures,
    productImages: productBuffers,
    analysis,
    layout,
    combinedPass: !dualPass,
  });

  updateVirtualTryJob(jobId, {
    status: JOB_STATUS.DONE,
    image: installed.image,
    resultMimeType: installed.mimeType || "image/jpeg",
    meta: {
      phase: "done",
      prepare: prepareMeta,
      install: installed.meta || {},
      engineId: installed.engineId,
      fixtureCount: fixtures.length,
      dualPass,
      combinedPass: !dualPass,
    },
  });
}
