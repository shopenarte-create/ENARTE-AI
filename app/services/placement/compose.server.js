import sharp from "sharp";
import { resolveLightingType } from "./lighting-types.js";
import {
  GENERATION_PROMPT_VERSION,
  MAX_PLACEMENT_MARKERS_V1,
  RENDERER_IDS,
} from "./constants.js";
import {
  buildAndSavePlacementPlan,
  persistPlacementPlanAsync,
} from "./placement-plan.server.js";
import {
  getPlacementRenderer,
  getEmergencySharpRenderer,
} from "./renderer/index.server.js";
import { resolveProductImageBuffer } from "./resolve-product-image.server.js";

/**
 * Perspective scale for Sharp emergency fallback only.
 */
export function perspectiveScale(yPercent) {
  const y = Math.min(100, Math.max(0, Number(yPercent) || 0));
  return 0.72 + (y / 100) * 0.43;
}

function buildRenderMetadata({
  rendererId,
  plan,
  renderTimestamp,
  usedEmergencyFallback,
}) {
  const markerCoordinates = (plan.fixtures || []).map((fixture) => ({
    markerId: fixture.markerId,
    original: fixture.markerCoordinates.original,
    mount: fixture.markerCoordinates.mount,
    body: fixture.markerCoordinates.body,
    adjusted: fixture.markerCoordinates.adjusted,
    mountStyle: fixture.mountStyle,
    hangDropPercent: fixture.hangDropPercent,
  }));

  const productIds = (plan.fixtures || [])
    .map((fixture) => fixture.product?.id)
    .filter(Boolean);

  return {
    rendererId,
    productIds,
    markerCoordinates,
    renderTimestamp,
    generationPromptVersion: GENERATION_PROMPT_VERSION,
    planId: plan.planId,
    planVersion: plan.version,
    ceilingPlane: plan.ceilingPlane,
    usedEmergencyFallback: Boolean(usedEmergencyFallback),
  };
}

function buildSharpEmergencyLayers(plan, productBuffers, roomWidth) {
  return (plan.fixtures || []).map((fixture, index) => {
    const lighting = resolveLightingType(
      fixture.lightingType,
      fixture.product || {},
    );
    const mount = fixture.markerCoordinates.mount;
    const hangDrop =
      fixture.hangDropPercent ?? lighting.hangDropPercent ?? 0;
    const scale = perspectiveScale(mount.y);
    const widthPx = Math.round(roomWidth * lighting.baseWidthRatio * scale);
    // Longer hang → taller bitmap so the body reads below the canopy
    const aspect =
      lighting.mountStyle === "long_pendant"
        ? 1.75
        : lighting.mountStyle === "flush"
          ? 1.05
          : 1.35 + hangDrop * 0.02;
    const heightPx = Math.round(widthPx * aspect);

    return {
      productImage: productBuffers[index],
      xPercent: mount.x,
      /** Canopy stays at mount; hang length comes from taller aspect + prompt */
      yPercent: mount.y,
      hangDropPercent: hangDrop,
      widthPx,
      heightPx,
      anchorX: 0.5,
      anchorY: lighting.anchorY,
      hangFromCeiling: lighting.hangFromCeiling,
      opacity: 1,
      lightingTypeId: lighting.id,
      mountStyle: lighting.mountStyle,
      markerId: fixture.markerId,
      productId: fixture.product?.id || null,
    };
  });
}

/**
 * Production virtual placement — optimized critical path:
 * parallel plan + product fetch, non-blocking plan persist,
 * gpt-image-1 primary render.
 */
export async function composeRoomPlacement({
  roomImageBuffer,
  placements = [],
} = {}) {
  if (!roomImageBuffer?.length) {
    throw new Error("Room image is required");
  }
  if (!Array.isArray(placements) || placements.length === 0) {
    throw new Error("At least one product placement is required");
  }
  if (placements.length > MAX_PLACEMENT_MARKERS_V1) {
    throw new Error(
      `Version 1 supports 1–${MAX_PLACEMENT_MARKERS_V1} lighting markers.`,
    );
  }

  // Parallel: room metadata + placement plan + product image resolve
  // (URL first, then Shopify Admin lookup by product id on failure).
  const [roomMeta, planResult, productEntries] = await Promise.all([
    sharp(roomImageBuffer, { failOn: "none" }).metadata(),
    buildAndSavePlacementPlan({
      roomMeta: {},
      placements,
      roomImageBuffer,
      persist: false,
    }),
    Promise.all(
      placements.map(async (item, index) => {
        const key = String(item?.product?.image || item?.product?.id || index);
        const resolved = await resolveProductImageBuffer({
          imageUrl: item?.product?.image,
          productId: item?.product?.id,
        });
        return [key, resolved.buffer, resolved.url, index];
      }),
    ),
  ]);

  const { plan } = planResult;
  plan.room = {
    width: roomMeta.width || null,
    height: roomMeta.height || null,
  };

  // Persist plan without blocking the OpenAI render
  persistPlacementPlanAsync(plan);

  const productBuffers = plan.fixtures.map((fixture, index) => {
    const entry = productEntries[index];
    const buffer = entry?.[1];
    if (!buffer) {
      throw new Error(`Missing product image for fixture ${fixture.markerId}`);
    }
    // Keep plan fixtures pointing at the URL that actually downloaded.
    if (entry[2] && fixture.product) {
      fixture.product.image = entry[2];
    }
    return buffer;
  });

  const renderTimestamp = new Date().toISOString();
  let usedEmergencyFallback = false;
  let renderResult;

  try {
    const renderer = getPlacementRenderer(RENDERER_IDS.OPENAI_GPT_IMAGE_1);
    // Photoreal gpt-image-1 only for customer results. Sharp paste is never
    // shown unless ENARTE_ALLOW_SHARP_FALLBACK=1 (dev/debug).
    renderResult = await renderer.render({
      roomImage: roomImageBuffer,
      plan,
      productImages: productBuffers,
    });
  } catch (primaryError) {
    console.error(
      "[placement] OpenAI gpt-image-1 failed:",
      primaryError.message,
      primaryError.code || "",
    );

    // Default OFF — Sharp cutout paste looks fake and customers reject it.
    const allowFallback = process.env.ENARTE_ALLOW_SHARP_FALLBACK === "1";
    if (!allowFallback) {
      throw primaryError;
    }

    usedEmergencyFallback = true;
    const roomWidth = roomMeta.width || 1024;
    const layers = buildSharpEmergencyLayers(plan, productBuffers, roomWidth);
    layers.sort((a, b) => a.yPercent - b.yPercent);

    const emergency = getEmergencySharpRenderer();
    renderResult = await emergency.render({
      roomImage: roomImageBuffer,
      layers,
    });
    renderResult.meta = {
      ...renderResult.meta,
      primaryError: primaryError.message,
      primaryCode: primaryError.code || null,
    };
  }

  const metadata = buildRenderMetadata({
    rendererId: renderResult.engineId,
    plan,
    renderTimestamp,
    usedEmergencyFallback,
  });

  return {
    image: renderResult.image,
    mimeType: renderResult.mimeType,
    engineId: renderResult.engineId,
    rendererId: renderResult.engineId,
    meta: {
      ...renderResult.meta,
      ...metadata,
    },
    planId: plan.planId,
    plan,
    placements: plan.fixtures.map((fixture, index) => ({
      markerId: fixture.markerId,
      x: fixture.markerCoordinates.mount.x,
      y: fixture.markerCoordinates.mount.y,
      originalX: fixture.markerCoordinates.original.x,
      originalY: fixture.markerCoordinates.original.y,
      adjusted: fixture.markerCoordinates.adjusted,
      lightingType: fixture.lightingType,
      productId: fixture.product?.id || null,
      productTitle: fixture.product?.title || null,
      layerIndex: index,
    })),
  };
}
