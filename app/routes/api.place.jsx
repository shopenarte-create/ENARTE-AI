import { composeRoomPlacement } from "../services/placement/compose.server.js";
import { MAX_PLACEMENT_MARKERS_V1 } from "../services/placement/constants.js";
import { startPlaceJob } from "../services/placement/place-jobs.server.js";

/**
 * Virtual placement API — OpenAI gpt-image-1 (photorealistic install).
 * Prefer ?async=1 so App Proxy does not kill long gpt-image renders.
 */

function parsePlacements(placementsRaw) {
  return JSON.parse(String(placementsRaw || "[]"));
}

function validatePlacements(placements) {
  if (!Array.isArray(placements) || placements.length === 0) {
    return "اختر منتجاً واحداً على الأقل لكل نقطة إضاءة.";
  }
  if (placements.length > MAX_PLACEMENT_MARKERS_V1) {
    return `الإصدار الحالي يدعم من 1 إلى ${MAX_PLACEMENT_MARKERS_V1} نقاط إضاءة.`;
  }
  for (const item of placements) {
    const hasProductMedia =
      Boolean(item?.product?.image) || Boolean(item?.product?.id);
    if (
      item?.x == null ||
      item?.y == null ||
      !hasProductMedia ||
      !item?.lightingType
    ) {
      return "كل نقطة تحتاج إحداثيات ونوع إضاءة وصورة/معرّف منتج من Shopify.";
    }
  }
  return null;
}

function buildPayloadMeta(composed, parseMs, started) {
  const meta = composed.meta || {};
  return {
    success: true,
    engineId: composed.engineId,
    rendererId: meta.rendererId || composed.rendererId,
    productIds: meta.productIds || [],
    markerCoordinates: meta.markerCoordinates || [],
    renderTimestamp: meta.renderTimestamp,
    generationPromptVersion: meta.generationPromptVersion,
    planId: composed.planId,
    mimeType: composed.mimeType,
    meta,
    placements: composed.placements,
    timings: {
      parseMs,
      totalMs: Date.now() - started,
      render: meta.timings || null,
    },
  };
}

export async function action({ request }) {
  const started = Date.now();
  try {
    const formData = await request.formData();
    const roomImage = formData.get("roomImage");
    const placementsRaw = formData.get("placements");
    const url = new URL(request.url);
    const wantsAsync =
      url.searchParams.get("async") === "1" ||
      url.searchParams.get("mode") === "async" ||
      String(formData.get("async") || "") === "1";
    const wantsBinary =
      url.searchParams.get("format") === "binary" ||
      (request.headers.get("Accept") || "").includes("image/");

    if (!roomImage || typeof roomImage === "string" || !roomImage.arrayBuffer) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "صورة الغرفة مطلوبة.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let placements = [];
    try {
      placements = parsePlacements(placementsRaw);
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "تنسيق نقاط التركيب غير صالح.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const validationError = validatePlacements(placements);
    if (validationError) {
      return new Response(
        JSON.stringify({ success: false, error: validationError }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const parseMs = Date.now() - started;
    const roomBuffer = Buffer.from(await roomImage.arrayBuffer());

    if (wantsAsync) {
      const jobId = startPlaceJob(async () => {
        const composed = await composeRoomPlacement({
          roomImageBuffer: roomBuffer,
          placements,
        });
        console.log("[place-job] done", {
          engineId: composed.engineId,
          imageBytes: composed.image?.length,
          fallback: Boolean(composed.meta?.usedEmergencyFallback),
        });
        return {
          image: composed.image,
          mimeType: composed.mimeType,
          engineId: composed.engineId,
          meta: buildPayloadMeta(composed, parseMs, started),
        };
      });

      console.log("[place] async queued", { jobId, parseMs });
      return new Response(
        JSON.stringify({
          success: true,
          async: true,
          jobId,
          statusUrl: `/api/place/status?id=${encodeURIComponent(jobId)}&format=binary`,
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        },
      );
    }

    const composed = await composeRoomPlacement({
      roomImageBuffer: roomBuffer,
      placements,
    });

    const payloadMeta = buildPayloadMeta(composed, parseMs, started);
    console.log("[place]", {
      binary: wantsBinary,
      totalMs: payloadMeta.timings.totalMs,
      engineId: composed.engineId,
      imageBytes: composed.image.length,
      fallback: Boolean(payloadMeta.meta?.usedEmergencyFallback),
    });

    if (wantsBinary) {
      return new Response(composed.image, {
        headers: {
          "Content-Type": composed.mimeType || "image/jpeg",
          "Cache-Control": "no-store",
          "X-Enarte-Success": "1",
          "X-Enarte-Engine": String(composed.engineId || ""),
          "X-Enarte-Meta": Buffer.from(
            JSON.stringify(payloadMeta),
            "utf8",
          ).toString("base64url"),
        },
      });
    }

    const base64 = composed.image.toString("base64");
    const dataUrl = `data:${composed.mimeType};base64,${base64}`;

    return new Response(
      JSON.stringify({
        ...payloadMeta,
        imageDataUrl: dataUrl,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const status = error?.status || 500;
    const httpStatus =
      status === 429 ? 429 : status >= 400 && status < 600 ? 502 : 500;
    console.error("Virtual placement failed:", {
      message: error?.message || String(error),
      code: error?.code,
      status: error?.status,
      name: error?.name,
      stack: error?.stack,
    });
    return new Response(
      JSON.stringify({
        success: false,
        code: error?.code || "PLACE_FAILED",
        error: error.message || "تعذر توليد صورة التركيب.",
      }),
      { status: httpStatus, headers: { "Content-Type": "application/json" } },
    );
  }
}
