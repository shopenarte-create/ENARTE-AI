/**
 * Shared Vision attribute schema for lighting photos.
 * Reused by image-search today and Try-in-room later.
 */

export const LIGHTING_VISION_MODES = Object.freeze({
  PRODUCT: "product",
  ROOM: "room",
});

/** Canonical type keys (align with product-attributes TYPE_VOCAB). */
export const LIGHTING_TYPES = Object.freeze([
  "chandelier",
  "pendant",
  "sconce",
  "spot",
  "track",
  "floor",
  "table",
  "outdoor",
  "ceiling",
  "fan",
]);

export const LIGHTING_SHAPES = Object.freeze([
  "round",
  "linear",
  "cascade",
  "orb",
  "square",
  "branch",
  "spiral",
]);

export const LIGHTING_COLORS = Object.freeze([
  "gold",
  "black",
  "white",
  "chrome",
  "brass",
  "bronze",
  "silver",
  "copper",
  "wood",
  "marble",
  "clear",
]);

export const LIGHTING_MATERIALS = Object.freeze([
  "crystal",
  "glass",
  "metal",
  "brass",
  "wood",
  "marble",
  "fabric",
]);

export const LIGHTING_STYLES = Object.freeze([
  "modern",
  "classic",
  "crystal",
  "luxury",
  "industrial",
  "art_deco",
  "led",
]);

export const LIGHTING_SIZES = Object.freeze(["small", "medium", "large"]);

export const EMPTY_LIGHTING_ATTRIBUTES = Object.freeze({
  type: null,
  shape: null,
  rings: null,
  colors: Object.freeze([]),
  materials: Object.freeze([]),
  styles: Object.freeze([]),
  size: null,
  confidence: null,
  raw: null,
});
