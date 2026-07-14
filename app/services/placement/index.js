/**
 * Placement module exports (Phase 5 markers + Phase 6 virtual placement).
 */

export {
  PLACEMENT_VERSION,
  clampPercent,
  createMarkerId,
  createLightingMarker,
  normalizeMarkers,
  inferMarkerZoneHint,
  buildVirtualPlacementPlan,
  parseMarkersInput,
} from "./markers.js";

export {
  LIGHTING_TYPES,
  getLightingType,
  resolveLightingType,
} from "./lighting-types.js";

export {
  GENERATION_PROMPT_VERSION,
  PLACEMENT_PLAN_VERSION,
  MAX_PLACEMENT_MARKERS_V1,
  RENDERER_IDS,
  DEFAULT_RENDERER_ID,
} from "./constants.js";
