/**
 * Renderer port — implement with any image engine later.
 */

/**
 * @typedef {object} PrepareCeilingInput
 * @property {Buffer} roomImage
 * @property {import('../types.js').RoomAnalysis} analysis
 */

/**
 * @typedef {object} InstallFixturesInput
 * @property {Buffer} roomImage - prepared ceiling image
 * @property {import('../types.js').FixtureSpec[]} fixtures
 * @property {Buffer[]} productImages
 * @property {import('../types.js').RoomAnalysis} [analysis]
 * @property {import('../types.js').LayoutPlan} [layout]
 */

/**
 * @typedef {object} RenderOutput
 * @property {Buffer} image
 * @property {string} mimeType
 * @property {string} engineId
 * @property {object} [meta]
 */

/**
 * @typedef {object} VirtualTryRenderer
 * @property {string} id
 * @property {(input: PrepareCeilingInput) => Promise<RenderOutput>} prepareCeiling
 * @property {(input: InstallFixturesInput) => Promise<RenderOutput>} installFixtures
 */

/** @returns {never} */
export function assertRenderer(renderer) {
  if (
    !renderer ||
    typeof renderer.prepareCeiling !== "function" ||
    typeof renderer.installFixtures !== "function"
  ) {
    throw new Error("Virtual-try renderer adapter is not configured");
  }
  return renderer;
}
