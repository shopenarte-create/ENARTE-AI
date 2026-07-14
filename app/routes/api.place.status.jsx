/**
 * GET /api/place/status?id=…&format=binary
 * Poll async virtual-placement jobs started by POST /api/place?async=1
 */

import { getPlaceJob } from "../services/placement/place-jobs.server.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || url.searchParams.get("jobId");
  const wantsBinary = url.searchParams.get("format") === "binary";

  if (!id) {
    return json({ ok: false, error: "missing_job_id" }, 400);
  }

  const job = getPlaceJob(id);
  if (!job) {
    return json({ ok: false, status: "missing", error: "job_not_found" }, 404);
  }

  if (job.status === "queued" || job.status === "running") {
    return json(
      {
        ok: true,
        status: job.status,
        jobId: job.id,
      },
      202,
    );
  }

  if (job.status === "error") {
    return json(
      {
        ok: false,
        status: "error",
        jobId: job.id,
        code: job.code || "PLACE_FAILED",
        error: job.error || "تعذر توليد صورة التركيب",
      },
      502,
    );
  }

  if (wantsBinary && job.image) {
    const meta = {
      success: true,
      jobId: job.id,
      engineId: job.meta?.engineId || null,
      meta: job.meta || {},
    };
    return new Response(job.image, {
      status: 200,
      headers: {
        "Content-Type": job.mimeType || "image/jpeg",
        "Cache-Control": "no-store",
        "X-Enarte-Success": "1",
        "X-Enarte-Engine": String(job.meta?.engineId || ""),
        "X-Enarte-Meta": Buffer.from(JSON.stringify(meta), "utf8").toString(
          "base64url",
        ),
      },
    });
  }

  return json({
    ok: true,
    status: "done",
    jobId: job.id,
    mimeType: job.mimeType || "image/jpeg",
    engineId: job.meta?.engineId || null,
    imageDataUrl: `data:${job.mimeType || "image/jpeg"};base64,${job.image.toString("base64")}`,
    meta: job.meta || {},
  });
}
