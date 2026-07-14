import {
  saveTryHandoff,
  peekTryHandoff,
  takeTryHandoff,
} from "../services/placement/try-handoff.server.js";
import {
  normalizeProductId,
  normalizeProductImageUrl,
} from "../services/placement/product-entry.js";

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function json(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(request),
    },
  });
}

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return json(
      { success: false, code: "MISSING_ID", error: "معرّف الصورة مفقود." },
      400,
      request,
    );
  }

  // Lightweight keepalive used by storefront + /try to keep tunnel warm.
  if (id === "ping") {
    return json({ success: true, pong: true }, 200, request);
  }

  const consume = url.searchParams.get("consume") === "1";
  const raw = url.searchParams.get("raw") === "1";
  const entry = consume ? await takeTryHandoff(id) : await peekTryHandoff(id);
  if (!entry) {
    console.warn("[try-handoff] miss/expired", { id, consume, raw });
    return json(
      {
        success: false,
        code: "HANDOFF_EXPIRED",
        error: "انتهت صلاحية صورة الغرفة — اختر صورة جديدة.",
      },
      404,
      request,
    );
  }

  // Binary path: avoids huge base64 JSON parse on mobile.
  if (raw) {
    return new Response(entry.buffer, {
      headers: {
        "Content-Type": entry.mimeType || "image/jpeg",
        "Cache-Control": "no-store",
        "X-Enarte-Handoff": "1",
        ...corsHeaders(request),
      },
    });
  }

  const base64 = entry.buffer.toString("base64");
  return json(
    {
      success: true,
      mimeType: entry.mimeType,
      imageDataUrl: `data:${entry.mimeType};base64,${base64}`,
      product: entry.product,
    },
    200,
    request,
  );
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const started = Date.now();
  try {
    const contentType = request.headers.get("content-type") || "";
    if (
      !contentType.includes("multipart/form-data") &&
      !contentType.includes("application/x-www-form-urlencoded")
    ) {
      console.warn("[try-handoff] rejected non-form POST", {
        contentType: contentType || "(empty)",
        method: request.method,
      });
      return json(
        {
          success: false,
          code: "INVALID_CONTENT_TYPE",
          error: "طلب غير صالح — أعد رفع صورة الغرفة.",
        },
        415,
        request,
      );
    }

    const formData = await request.formData();
    const roomImage = formData.get("roomImage");

    if (!roomImage || typeof roomImage === "string" || !roomImage.arrayBuffer) {
      console.warn("[try-handoff] missing roomImage field");
      return json(
        {
          success: false,
          code: "ROOM_REQUIRED",
          error: "صورة الغرفة مطلوبة.",
        },
        400,
        request,
      );
    }

    const buffer = Buffer.from(await roomImage.arrayBuffer());
    const product = {
      id: normalizeProductId(formData.get("productId")),
      title: String(formData.get("title") || "").trim() || null,
      image: normalizeProductImageUrl(formData.get("image")),
      price: formData.get("price") || null,
      currency: String(formData.get("currency") || "JOD"),
      url: String(formData.get("url") || "").trim() || null,
      collection: String(formData.get("collection") || "").trim() || null,
    };
    const entryMode = String(formData.get("entry") || "product").trim() || "product";

    const handoffId = await saveTryHandoff({
      buffer,
      mimeType: roomImage.type || "image/jpeg",
      product: entryMode === "home" ? null : product,
    });

    // Warm product image cache while the customer lands on /try (non-blocking).
    if (product.image && entryMode !== "home") {
      import("../services/placement/cache.server.js")
        .then(async (cache) => {
          let absolute = String(product.image).trim();
          if (absolute.startsWith("//")) absolute = `https:${absolute}`;
          if (cache.getCachedProductImage(absolute)) return;
          const res = await fetch(absolute);
          if (!res.ok) return;
          cache.setCachedProductImage(
            absolute,
            Buffer.from(await res.arrayBuffer()),
          );
        })
        .catch((error) => {
          console.warn(
            "[try-handoff] product warm failed:",
            error?.message || error,
          );
        });
    }

    console.info("[try-handoff] ok", {
      handoffId,
      entryMode,
      bytes: buffer.length,
      ms: Date.now() - started,
    });

    return json({ success: true, handoffId, code: "OK" }, 200, request);
  } catch (error) {
    console.error("[try-handoff] failed:", {
      message: error?.message || String(error),
      code: error?.code,
      ms: Date.now() - started,
      stack: error?.stack,
    });
    return json(
      {
        success: false,
        code: error?.code || "HANDOFF_SAVE_FAILED",
        error: error?.message || "تعذر حفظ صورة الغرفة. حاول مجدداً.",
      },
      500,
      request,
    );
  }
}
