/**
 * Shared HTTP helpers for assistant API routes.
 */

export function corsHeaders(request, methods = "GET, POST, OPTIONS") {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, X-Enarte-Train-Key",
    "Cache-Control": "no-store",
  };
}
