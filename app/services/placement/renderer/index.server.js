import { createOpenAiGptImageRenderer } from "./openai-images.server.js";
import { createSharpCompositor } from "./sharp-renderer.server.js";
import {
  RENDERER_IDS,
  DEFAULT_RENDERER_ID,
} from "../constants.js";

/**
 * Active renderer registry.
 * Production default: openai-gpt-image-1.
 * Sharp is registered only as a hidden emergency fallback.
 */
const RENDERERS = {
  [RENDERER_IDS.OPENAI_GPT_IMAGE_1]: createOpenAiGptImageRenderer,
  [RENDERER_IDS.SHARP_EMERGENCY_FALLBACK]: () => {
    const sharp = createSharpCompositor();
    return {
      id: RENDERER_IDS.SHARP_EMERGENCY_FALLBACK,
      async render(input) {
        const result = await sharp.render(input);
        return {
          ...result,
          engineId: RENDERER_IDS.SHARP_EMERGENCY_FALLBACK,
          meta: {
            ...result.meta,
            emergencyFallback: true,
            note: "Sharp used only as emergency fallback — not the production renderer.",
          },
        };
      },
    };
  },
};

let activeRendererId = DEFAULT_RENDERER_ID;

export function setActivePlacementRenderer(rendererId) {
  if (!RENDERERS[rendererId]) {
    throw new Error(`Unknown placement renderer: ${rendererId}`);
  }
  // Never allow Sharp as the sticky default production renderer
  if (rendererId === RENDERER_IDS.SHARP_EMERGENCY_FALLBACK) {
    throw new Error(
      "Sharp compositor cannot be set as the default production renderer",
    );
  }
  activeRendererId = rendererId;
}

export function getPlacementRenderer(rendererId = activeRendererId) {
  const factory = RENDERERS[rendererId] || RENDERERS[DEFAULT_RENDERER_ID];
  return factory();
}

export function getEmergencySharpRenderer() {
  return RENDERERS[RENDERER_IDS.SHARP_EMERGENCY_FALLBACK]();
}

export { RENDERER_IDS, DEFAULT_RENDERER_ID };
