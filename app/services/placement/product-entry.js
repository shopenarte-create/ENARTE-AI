/**
 * Parse a locked Shopify product from /try query params.
 * Used by the product-page entry (skip recommendations).
 */
export function normalizeProductId(rawId) {
  const value = String(rawId || "").trim();
  if (!value) {
    return null;
  }
  if (value.startsWith("gid://")) {
    return value;
  }
  if (/^\d+$/.test(value)) {
    return `gid://shopify/Product/${value}`;
  }
  return value;
}

/** Shopify CDN often emits protocol-relative //cdn... URLs. */
export function normalizeProductImageUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return null;
  }
  if (value.startsWith("//")) {
    return `https:${value}`;
  }
  return value;
}

export function parseLockedProductFromSearchParams(searchParams) {
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || "");

  const id = normalizeProductId(params.get("productId") || params.get("id"));
  const title = String(params.get("title") || "").trim();
  const image = normalizeProductImageUrl(params.get("image"));

  if (!id && !image) {
    return null;
  }

  const priceRaw = params.get("price");
  const price =
    priceRaw != null && String(priceRaw).trim() !== ""
      ? Number(String(priceRaw).replace(/,/g, ""))
      : null;

  return {
    id: id || `product:${title || "locked"}`,
    title: title || "Selected product",
    image: image || null,
    price: Number.isFinite(price) ? price : null,
    currency: String(params.get("currency") || "JOD").trim() || "JOD",
    url: String(params.get("url") || "").trim() || null,
    collection: String(params.get("collection") || "").trim() || null,
  };
}

export function isProductEntry(searchParams) {
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || "");
  const entry = String(params.get("entry") || "").toLowerCase();
  if (entry === "home" || entry === "main" || entry === "recommend") {
    return false;
  }
  return (
    entry === "product" || Boolean(parseLockedProductFromSearchParams(params))
  );
}

export async function dataUrlToFile(dataUrl, filename = "room.jpg") {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, {
    type: blob.type || "image/jpeg",
  });
}

export const ENARTE_TRY_PAYLOAD_KEY = "enarte_try_payload";
