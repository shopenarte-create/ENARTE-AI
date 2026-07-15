import { API_BASE_URL } from "../config";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function readJson<T = any>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("invalid_json", response.status, "invalid_json");
  }
}

export async function apiFetch<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new ApiError("network_error", 0, "network_error");
  }

  const data = await readJson<T & { ok?: boolean; error?: string; success?: boolean }>(
    response,
  );

  if (!response.ok) {
    const code =
      (data as any)?.error || (data as any)?.code || `http_${response.status}`;
    const message =
      (data as any)?.message || (data as any)?.error || String(code);
    throw new ApiError(String(message), response.status, String(code));
  }

  return data as T;
}
