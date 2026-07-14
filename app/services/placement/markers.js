/**
 * Phase 5 — Lighting placement markers.
 * Coordinates are relative percentages (0–100), not pixels.
 *
 * Future (not implemented): each marker gets its own generated chandelier
 * for "Try It In Your Room" virtual placement.
 */

export const PLACEMENT_VERSION = "placement.markers.v1";

/**
 * @typedef {{ id: string, x: number, y: number, label?: string|null, placement?: object|null }} LightingMarker
 */

export function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(100, Math.max(0, n));
}

export function createMarkerId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `marker_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a marker from relative image coordinates.
 * @param {number} xPercent
 * @param {number} yPercent
 * @param {Partial<LightingMarker>} [extra]
 * @returns {LightingMarker}
 */
export function createLightingMarker(xPercent, yPercent, extra = {}) {
  return {
    id: extra.id || createMarkerId(),
    x: Number(clampPercent(xPercent).toFixed(2)),
    y: Number(clampPercent(yPercent).toFixed(2)),
    // Optional human label for future zone naming (center / dining / entrance)
    label: extra.label ?? null,
    // Future virtual placement payload (product + generated image)
    placement: extra.placement ?? null,
  };
}

/**
 * Normalize / validate an array of markers from UI or API.
 * @param {unknown} raw
 * @returns {LightingMarker[]}
 */
export function normalizeMarkers(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const id = String(item.id || createMarkerId());
      const x = clampPercent(item.x);
      const y = clampPercent(item.y);
      return {
        id,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        label: item.label != null ? String(item.label) : `Marker ${index + 1}`,
        placement: item.placement ?? null,
      };
    })
    .filter(Boolean);
}

/**
 * Soft zone hint from marker position (architecture for smarter per-marker scoring).
 * Does not hardcode products — only suggests room-zone language for the engine.
 */
export function inferMarkerZoneHint(marker) {
  const x = clampPercent(marker?.x);
  const y = clampPercent(marker?.y);

  if (y < 35 && x >= 30 && x <= 70) {
    return {
      zone: "ceiling_center",
      labelAr: "وسط السقف / مركز الغرفة",
      fixturePreference: "chandelier",
    };
  }
  if (y >= 35 && y <= 65 && x >= 25 && x <= 75) {
    return {
      zone: "dining_or_table",
      labelAr: "منطقة طاولة / وسط الغرفة",
      fixturePreference: "chandelier",
    };
  }
  if (x < 25 || x > 75 || y > 70) {
    return {
      zone: "entrance_or_edge",
      labelAr: "مدخل / جانب الغرفة",
      fixturePreference: "pendant",
    };
  }
  return {
    zone: "general_ceiling",
    labelAr: "نقطة إضاءة عامة",
    fixturePreference: "any",
  };
}

/**
 * Future hook: attach a generated chandelier render to a marker.
 * Not implemented in Phase 5.
 */
export function buildVirtualPlacementPlan(marker, product) {
  return {
    status: "not_implemented",
    markerId: marker?.id || null,
    productId: product?.id || null,
    note:
      "Future: generate a chandelier image for this marker and store on marker.placement.",
  };
}

/**
 * Parse markers from FormData / JSON string.
 */
export function parseMarkersInput(raw) {
  if (raw == null || raw === "") {
    return [];
  }
  if (Array.isArray(raw)) {
    return normalizeMarkers(raw);
  }
  try {
    return normalizeMarkers(JSON.parse(String(raw)));
  } catch {
    return [];
  }
}
