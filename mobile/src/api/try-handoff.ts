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

export function webTryUrl(handoffId: string) {
  return apiUrl(`/try?handoff=${encodeURIComponent(handoffId)}`);
}

export async function pingApi() {
  return apiFetch<{ success: boolean; pong?: boolean }>(
    "/api/try-handoff?id=ping",
  );
}
