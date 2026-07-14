/**
 * Resolve API paths when the app is served through Shopify's app proxy
 * (e.g. https://shop.com/apps/enarte-ai/try → APIs live under /apps/enarte-ai/api/*).
 */
export function getEnarteApiBase() {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname || "";
  const marker = "/apps/enarte-ai";
  const idx = path.indexOf(marker);
  if (idx !== -1) return path.slice(0, idx + marker.length);
  return "";
}

export function enarteApiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getEnarteApiBase()}${normalized}`;
}
