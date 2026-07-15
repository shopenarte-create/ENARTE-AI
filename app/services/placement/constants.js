/**
 * Virtual placement constants (Phase 6 production renderer).
 */

export const GENERATION_PROMPT_VERSION = "placement.prompt.v7";
export const PLACEMENT_PLAN_VERSION = "placement.plan.v1";
export const MAX_PLACEMENT_MARKERS_V1 = 5;

export const RENDERER_IDS = Object.freeze({
  OPENAI_GPT_IMAGE_1: "openai-gpt-image-1",
  /** Internal Sharp engine id — never the production default. */
  SHARP_COMPOSITOR: "sharp-compositor.v1",
  SHARP_EMERGENCY_FALLBACK: "sharp-compositor.emergency",
});

/** Default production renderer — never Sharp. */
export const DEFAULT_RENDERER_ID = RENDERER_IDS.OPENAI_GPT_IMAGE_1;
