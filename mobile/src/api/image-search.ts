import { DEFAULT_LOCALE, SHOP_DOMAIN } from "../config";
import { ApiError, apiFetch } from "./client";

export type ImageSearchProduct = {
  id: string;
  title: string;
  price?: string | number | null;
  currency?: string | null;
  image?: string | null;
  url?: string | null;
  handle?: string | null;
  collection?: string | null;
  matchReason?: string | null;
  score?: number;
  rank?: number;
};

export type ImageSearchResult = {
  ok: boolean;
  products: ImageSearchProduct[];
  count?: number;
  mode?: "match" | "similar" | "unavailable" | string;
  unavailable?: boolean;
  showSourcingOffer?: boolean;
  sourcingMessage?: string | null;
  error?: string;
  message?: string;
};

export async function searchCatalogByImage(params: {
  uri: string;
  mimeType?: string;
  fileName?: string;
  shop?: string;
  locale?: string;
  limit?: number;
}): Promise<ImageSearchResult> {
  const form = new FormData();
  form.append("image", {
    uri: params.uri,
    type: params.mimeType || "image/jpeg",
    name: params.fileName || "query.jpg",
  } as any);
  form.append("shop", params.shop || SHOP_DOMAIN);
  form.append("locale", params.locale || DEFAULT_LOCALE);
  form.append("limit", String(params.limit ?? 8));

  try {
    const data = await apiFetch<ImageSearchResult>("/api/catalog/image-search", {
      method: "POST",
      body: form,
    });
    return {
      ...data,
      ok: data.ok !== false,
      products: Array.isArray(data.products) ? data.products : [],
    };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ok: false,
        products: [],
        error: err.code || err.message,
        message: err.message,
      };
    }
    throw err;
  }
}
