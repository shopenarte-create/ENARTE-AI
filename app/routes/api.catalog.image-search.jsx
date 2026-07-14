/**
 * POST /api/catalog/image-search
 * Vision attributes → Shopify catalog rank (ENARTE only).
 * Falls back to classical Sharp fingerprint matcher if Vision is unavailable.
 */

import { searchCatalogByImage } from "../services/catalog/image-search.server.js";

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  return new Response(
    JSON.stringify({
      ok: true,
      engine: "vision-attributes+shopify-fallback-fingerprint",
    }),
    {
      status: 200,
      headers: corsHeaders(request),
    },
  );
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders(request),
    });
  }

  try {
    const formData = await request.formData();
    const shop = String(formData.get("shop") || "").trim() || null;
    const locale = String(formData.get("locale") || "ar").trim() || "ar";
    const limitRaw = Number.parseInt(String(formData.get("limit") || "8"), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 8;
    const file =
      formData.get("image") ||
      formData.get("photo") ||
      formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_image", products: [] }),
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const result = await searchCatalogByImage({
      imageBuffer,
      shop,
      limit,
      locale,
    });

    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: corsHeaders(request),
    });
  } catch (error) {
    console.error("[enarte] catalog image-search failed", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "search_failed",
        message: error?.message || "search_failed",
        products: [],
      }),
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
