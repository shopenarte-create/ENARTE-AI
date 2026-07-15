import {
  getVirtualTryJob,
  toPublicVirtualTryJob,
  JOB_STATUS,
} from "../services/virtual-try/index.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * GET /api/virtual-try/status?id=…
 * Optional &format=binary when status=done
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || url.searchParams.get("jobId");
  const wantsBinary = url.searchParams.get("format") === "binary";

  if (!id) {
    return json({ ok: false, error: "missing_job_id" }, 400);
  }

  const job = getVirtualTryJob(id);
  if (!job) {
    return json({ ok: false, status: "missing", error: "job_not_found" }, 404);
  }

  if (
    job.status === JOB_STATUS.QUEUED ||
    job.status === JOB_STATUS.ANALYZING ||
    job.status === JOB_STATUS.PREPARING ||
    job.status === JOB_STATUS.INSTALLING
  ) {
    return json(
      {
        ...toPublicVirtualTryJob(job),
        ok: true,
      },
      202,
    );
  }

  if (job.status === JOB_STATUS.NEEDS_CONFIRMATION) {
    return json({
      ...toPublicVirtualTryJob(job),
      ok: true,
      needsConfirmation: true,
    });
  }

  if (job.status === JOB_STATUS.ERROR) {
    return json(
      {
        ...toPublicVirtualTryJob(job),
        ok: false,
      },
      502,
    );
  }

  if (wantsBinary && job.image) {
    const meta = toPublicVirtualTryJob(job);
    return new Response(job.image, {
      status: 200,
      headers: {
        "Content-Type": job.resultMimeType || "image/jpeg",
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
    ...toPublicVirtualTryJob(job, { includeImageDataUrl: true }),
    ok: true,
  });
}
