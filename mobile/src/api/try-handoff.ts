import { apiFetch, apiUrl } from "./client";

export type HandoffResult = {
  success: boolean;
  handoffId?: string;
  code?: string;
  error?: string;
};

export async function uploadRoomHandoff(params: {
  uri: string;
  mimeType?: string;
  fileName?: string;
  productId?: string | null;
  productImage?: string | null;
  title?: string | null;
  url?: string | null;
  entry?: "home" | "product";
}) {
  const form = new FormData();
  form.append("roomImage", {
    uri: params.uri,
    type: params.mimeType || "image/jpeg",
    name: params.fileName || "room.jpg",
  } as any);
  form.append("entry", params.entry || "home");
  if (params.productId) form.append("productId", params.productId);
  if (params.productImage) form.append("image", params.productImage);
  if (params.title) form.append("title", params.title);
  if (params.url) form.append("url", params.url);

  return apiFetch<HandoffResult>("/api/try-handoff", {
    method: "POST",
    body: form,
  });
}

/** Build /try URL. Product entry must lock the SKU (no 3-product suggestions). */
export function webTryUrl(
  handoffId: string,
  product?: {
    productId?: string | null;
    title?: string | null;
    image?: string | null;
    url?: string | null;
    entry?: "home" | "product";
  } | null,
) {
  const params = new URLSearchParams();
  params.set("handoff", handoffId);
  const entry = product?.entry || (product?.productId || product?.image ? "product" : "home");
  params.set("entry", entry);
  if (entry === "product") {
    if (product?.productId) params.set("productId", String(product.productId));
    if (product?.title) params.set("title", String(product.title));
    if (product?.image) params.set("image", String(product.image));
    if (product?.url) params.set("url", String(product.url));
  }
  return apiUrl(`/try?${params.toString()}`);
}

export async function pingApi() {
  return apiFetch<{ success: boolean; pong?: boolean }>(
    "/api/try-handoff?id=ping",
  );
}
