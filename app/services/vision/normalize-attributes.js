/**
 * Normalize Vision JSON into ENARTE lighting attributes (no OpenAI import).
 */

import {
  EMPTY_LIGHTING_ATTRIBUTES,
  LIGHTING_COLORS,
  LIGHTING_MATERIALS,
  LIGHTING_SHAPES,
  LIGHTING_SIZES,
  LIGHTING_STYLES,
  LIGHTING_TYPES,
} from "./schema.js";

function pickAllowed(value, allowed) {
  const key = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (!key || key === "null" || key === "unknown" || key === "other") {
    return null;
  }
  if (allowed.includes(key)) return key;
  if (key === "wall" || key === "wall_light" || key === "wall_lamp") {
    return allowed.includes("sconce") ? "sconce" : null;
  }
  if (key === "hanging") {
    return allowed.includes("pendant") ? "pendant" : null;
  }
  return null;
}

function pickAllowedList(values, allowed, max = 4) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const value of values) {
    const key = pickAllowed(value, allowed);
    if (key && !out.includes(key)) out.push(key);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeRings(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n >= 50) return null;
  return Math.round(n);
}

export function normalizeVisionAttributes(parsed = {}) {
  const type = pickAllowed(parsed.type || parsed.fixturePreference, LIGHTING_TYPES);
  const shape = pickAllowed(parsed.shape, LIGHTING_SHAPES);
  const size = pickAllowed(parsed.size, LIGHTING_SIZES);
  const styleOne = pickAllowed(parsed.style, LIGHTING_STYLES);
  const styles = pickAllowedList(
    [
      ...(styleOne ? [styleOne] : []),
      ...(Array.isArray(parsed.styles) ? parsed.styles : []),
    ],
    LIGHTING_STYLES,
  );
  const colors = pickAllowedList(parsed.colors, LIGHTING_COLORS);
  const materials = pickAllowedList(parsed.materials, LIGHTING_MATERIALS);
  const rings = normalizeRings(parsed.rings);
  const confidenceRaw = Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : null;

  return Object.freeze({
    type,
    shape,
    rings,
    colors: Object.freeze(colors),
    materials: Object.freeze(materials),
    styles: Object.freeze(styles),
    size,
    confidence,
    roomType: parsed.roomType ? String(parsed.roomType).toLowerCase() : null,
    notes: parsed.notes ? String(parsed.notes).slice(0, 240) : null,
    raw: Object.freeze({ ...parsed }),
  });
}

export function hasUsableVisionAttributes(attrs) {
  if (!attrs) return false;
  const hasShapeOrRings = Boolean(attrs.shape) || attrs.rings != null;
  const hasLook =
    (attrs.colors || []).length > 0 ||
    (attrs.materials || []).length > 0 ||
    (attrs.styles || []).length > 0;
  const signals =
    Number(Boolean(attrs.type)) +
    Number(Boolean(attrs.shape)) +
    Number(attrs.rings != null) +
    Number((attrs.colors || []).length > 0) +
    Number((attrs.materials || []).length > 0) +
    Number((attrs.styles || []).length > 0) +
    Number(Boolean(attrs.size));
  // Need a real structure signal, or at least 3 traits — not type+led alone.
  return (
    (Boolean(attrs.type) && hasShapeOrRings) ||
    (Boolean(attrs.type) && hasLook && signals >= 3) ||
    signals >= 4
  );
}

export { EMPTY_LIGHTING_ATTRIBUTES };
