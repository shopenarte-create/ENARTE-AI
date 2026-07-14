/**
 * Vision module public API — reusable by image-search and Try-in-room.
 */

export {
  EMPTY_LIGHTING_ATTRIBUTES,
  LIGHTING_COLORS,
  LIGHTING_MATERIALS,
  LIGHTING_SHAPES,
  LIGHTING_SIZES,
  LIGHTING_STYLES,
  LIGHTING_TYPES,
  LIGHTING_VISION_MODES,
} from "./schema.js";

export {
  hasUsableVisionAttributes,
  normalizeVisionAttributes,
} from "./normalize-attributes.js";

export {
  bufferToVisionDataUrl,
  extractLightingAttributesFromImage,
} from "./extract-lighting-attributes.server.js";
