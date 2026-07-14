/**
 * GET /api/mobile/catalog?type=collections|products|product
 * Mobile shopping catalog (CORS-enabled).
 */

import {
  listMobileCollections,
  listMobileProducts,
  getMobileProduct,
  buildCartCheckoutUrl,
} from "../services/mobile-catalog.server.js";
import { corsHeaders } from "../services/assistant/utils/http.js";

function json(data, status, request) {
  return Response.json(data, {
    status,
    headers: corsHeaders(request),
  });
}

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "products";
  const shop = url.searchParams.get("shop") || undefined;

  try {
    if (type === "collections") {
      const data = await listMobileCollections(shop);
      return json({ ok: true, ...data }, 200, request);
    }

    if (type === "product") {
      const handle = url.searchParams.get("handle");
      const id = url.searchParams.get("id");
      const data = await getMobileProduct({ shopHint: shop, handle, id });
      if (!data.product) {
        return json({ ok: false, error: "product_not_found" }, 404, request);
      }
      return json({ ok: true, ...data }, 200, request);
    }

    if (type === "checkout_url") {
      let items = [];
      try {
        items = JSON.parse(url.searchParams.get("items") || "[]");
      } catch {
        items = [];
      }
      const checkoutUrl = buildCartCheckoutUrl(
        items,
        url.searchParams.get("store") || process.env.PUBLIC_STORE_DOMAIN
          ? `https://${String(process.env.PUBLIC_STORE_DOMAIN).replace(/^https?:\/\//, "")}`
          : "https://enarteshop.com",
      );
      return json({ ok: Boolean(checkoutUrl), checkoutUrl }, 200, request);
    }

    const data = await listMobileProducts({
      shopHint: shop,
      collection: url.searchParams.get("collection") || undefined,
      q: url.searchParams.get("q") || undefined,
      cursor: url.searchParams.get("cursor") || undefined,
      first: url.searchParams.get("first") || 24,
    });
    return json({ ok: true, ...data }, 200, request);
  } catch (error) {
    console.error("[mobile-catalog]", error?.message || error);
    return json(
      {
        ok: false,
        error: error?.message || "catalog_failed",
      },
      500,
      request,
    );
  }
}
