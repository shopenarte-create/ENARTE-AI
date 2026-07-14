/**
 * Shared locale helpers for Knowledge-backed copy.
 */

export function pickLocale(map, locale = "ar") {
  if (!map || typeof map !== "object") return "";
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  return (useEn ? map.en : map.ar) || map.ar || map.en || "";
}

export function isEnglishLocale(locale = "ar") {
  return String(locale || "ar").toLowerCase().startsWith("en");
}
