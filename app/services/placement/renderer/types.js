/**
 * Renderer contract for the virtual placement engine.
 * Swap implementations without changing UI or API routes.
 *
 * @typedef {object} PlacementLayer
 * @property {Buffer} productImage
 * @property {number} xPercent
 * @property {number} yPercent
 * @property {number} widthPx
 * @property {number} heightPx
 * @property {number} anchorX
 * @property {number} anchorY
 * @property {number} [opacity]
 * @property {string} [lightingTypeId]
 * @property {string} [markerId]
 *
 * @typedef {object} RenderInput
 * @property {Buffer} roomImage
 * @property {PlacementLayer[]} [layers]
 * @property {object} [plan]
 * @property {Buffer[]} [productImages]
 *
 * @typedef {object} RenderResult
 * @property {Buffer} image
 * @property {string} mimeType
 * @property {string} engineId
 * @property {object} meta
 */

export {
  RENDERER_IDS,
  DEFAULT_RENDERER_ID,
  GENERATION_PROMPT_VERSION,
} from "../constants.js";

/**
 * @typedef {object} PlacementRenderer
 * @property {string} id
 * @property {(input: RenderInput) => Promise<RenderResult>} render
 */
