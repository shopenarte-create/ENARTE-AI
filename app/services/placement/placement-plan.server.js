import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  GENERATION_PROMPT_VERSION,
  PLACEMENT_PLAN_VERSION,
  MAX_PLACEMENT_MARKERS_V1,
  DEFAULT_RENDERER_ID,
} from "./constants.js";
import { resolveLightingType } from "./lighting-types.js";
import {
  detectCeilingPlane,
  adjustMarkerToCeiling,
} from "./ceiling-plane.server.js";

const PLANS_DIR = path.join(process.cwd(), "data", "placement-plans");

async function ensurePlansDir() {
  await fs.mkdir(PLANS_DIR, { recursive: true });
}

/**
 * Build a reusable placement plan (saved separately from the rendered image).
 */
export async function buildAndSavePlacementPlan({
  roomMeta = {},
  placements = [],
  roomImageBuffer,
  persist = true,
} = {}) {
  if (!Array.isArray(placements) || placements.length === 0) {
    throw new Error("At least one placement is required");
  }
  if (placements.length > MAX_PLACEMENT_MARKERS_V1) {
    throw new Error(
      `Version 1 supports at most ${MAX_PLACEMENT_MARKERS_V1} lighting markers.`,
    );
  }

  const ceilingPlane = await detectCeilingPlane(roomImageBuffer);

  const fixtures = placements.map((item, index) => {
    const lighting = resolveLightingType(item.lightingType, item.product || {});
    const adjusted = adjustMarkerToCeiling(
      {
        markerId: item.markerId,
        x: item.x,
        y: item.y,
      },
      ceilingPlane,
    );

    const hangDropPercent = Number(lighting.hangDropPercent) || 0;
    const bodyY = Math.min(
      98,
      Number((adjusted.y + hangDropPercent).toFixed(2)),
    );

    return {
      index: index + 1,
      markerId: item.markerId,
      lightingType: lighting.id,
      hangFromCeiling: lighting.hangFromCeiling,
      mountStyle: lighting.mountStyle,
      hangDropPercent,
      markerCoordinates: {
        original: { x: adjusted.originalX, y: adjusted.originalY },
        /** Ceiling canopy / rose — exactly the snapped tap point */
        mount: { x: adjusted.x, y: adjusted.y },
        /** Approximate center of the hanging body (below canopy) */
        body: { x: adjusted.x, y: bodyY },
        adjusted: adjusted.adjusted,
        snapReasons: adjusted.snapReasons || [],
      },
      product: {
        id: item.product?.id || null,
        title: item.product?.title || null,
        image: item.product?.image || null,
        collection: item.product?.collection || null,
      },
      replaceable: true,
    };
  });

  const planId = randomUUID();
  const createdAt = new Date().toISOString();

  const plan = {
    version: PLACEMENT_PLAN_VERSION,
    planId,
    createdAt,
    generationPromptVersion: GENERATION_PROMPT_VERSION,
    preferredRendererId: DEFAULT_RENDERER_ID,
    room: {
      width: roomMeta.width || null,
      height: roomMeta.height || null,
    },
    ceilingPlane,
    fixtures,
    future: {
      supportsSingleFixtureRerender: true,
      supportsHdRender: true,
      supportsVideoGeneration: true,
    },
  };

  let filePath = null;
  if (persist) {
    // Persist off the critical path when caller fires-and-forgets;
    // still available when awaited.
    await ensurePlansDir();
    filePath = path.join(PLANS_DIR, `${planId}.json`);
    await fs.writeFile(filePath, JSON.stringify(plan, null, 2), "utf8");
  }

  return { plan, filePath };
}

/**
 * Persist plan without blocking the render critical path.
 */
export function persistPlacementPlanAsync(plan) {
  const filePath = path.join(PLANS_DIR, `${plan.planId}.json`);
  ensurePlansDir()
    .then(() => fs.writeFile(filePath, JSON.stringify(plan, null, 2), "utf8"))
    .catch((error) => {
      console.error("[placement] Failed to persist plan:", error.message);
    });
  return filePath;
}

export async function loadPlacementPlan(planId) {
  const filePath = path.join(PLANS_DIR, `${planId}.json`);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function hangLengthGuidance(mountStyle, hangDropPercent) {
  switch (mountStyle) {
    case "flush":
      return `FLUSH MOUNT: almost no hang. Canopy and body are nearly co-located (body center only ~${hangDropPercent}% below canopy). No long chain or rod.`;
    case "long_pendant":
      return `LONG PENDANT: clearly longer hang. Draw a visible rod/chain/cord so the body center sits ~${hangDropPercent}% below the canopy.`;
    case "spot":
      return `SPOT: short stem only (~${hangDropPercent}% below canopy). Keep compact against the ceiling.`;
    case "wall":
      return `WALL MOUNT: no ceiling hang.`;
    case "short_pendant":
    default:
      return `SHORT PENDANT: modest hang. Stem/rod/chain so the body center sits ~${hangDropPercent}% below the canopy — enough to look installed, not flush and not floor-length.`;
  }
}

/**
 * Photorealism-focused generation prompt (v7).
 * Tap = ceiling canopy; body hangs below by mountStyle hangDropPercent.
 * Product images are REFERENCES for design — not cutouts to paste.
 * v7: surgical old-fixture removal + conservative proportional scale.
 */
export function buildGenerationPrompt(plan) {
  const fixtureLines = (plan.fixtures || [])
    .map((fixture) => {
      const mount = fixture.markerCoordinates.mount;
      const body = fixture.markerCoordinates.body || {
        x: mount.x,
        y: mount.y + (fixture.hangDropPercent || 0),
      };
      const hang = fixture.hangFromCeiling !== false;
      const mountStyle = fixture.mountStyle || "short_pendant";
      const hangDrop = fixture.hangDropPercent ?? 5.5;

      return [
        `Fixture ${fixture.index} — "${fixture.product.title || "lighting product"}":`,
        `- REFERENCE ONLY: use image product_${fixture.index} for exact shape, materials, finish, and color. Do NOT paste that photo as a flat sticker.`,
        `- RECREATE the fixture as a real 3D object physically installed in this room.`,
        `- Preserve the exact product design (arms, crystals, glass, metalwork, LED modules). Do not invent a different chandelier.`,
        `- Lighting type: ${fixture.lightingType}. Mount style: ${mountStyle}.`,
        hang
          ? `- CRITICAL: The customer's tap is the CEILING MOUNTING POINT (canopy/rose), NOT the center of the chandelier body.`
          : `- Mount realistically on the wall near ~x=${mount.x}%, y=${mount.y}%.`,
        hang
          ? `- LOCKED MOUNT: Place the ceiling canopy / rose EXACTLY at x=${mount.x.toFixed(2)}%, y=${mount.y.toFixed(2)}% (from top-left). Do NOT shift, recenter, or "improve" this point — the customer chose it. Canopy glued to ceiling here.`
          : null,
        hang
          ? `- Hang the fixture body DOWNWARD from that canopy so its visual center is near x=${body.x.toFixed(2)}%, y=${body.y.toFixed(2)}% (about ${hangDrop}% below the canopy). The body must sit BELOW the tap, never centered on it.`
          : null,
        hang ? `- ${hangLengthGuidance(mountStyle, hangDrop)}` : null,
        hang
          ? `- Draw a continuous, perspective-correct rod, chain, or cord from the canopy down to the body. Never leave a gap that makes the fixture float.`
          : `- Attach flush/bracketed to the wall with realistic hardware.`,
        `- SCALE (critical — prefer smaller): size the fixture so it looks realistic for this room's furniture and ceiling height.`,
        `- Typical span is about 10–16% of image width for a dining/living chandelier. Prefer the smaller end.`,
        `- NEVER make it oversized, dominant, or cartoonishly large. If unsure, choose a slightly smaller scale.`,
        `- Match the room's light direction, color temperature, and ambient bounce on metal/glass surfaces.`,
        `- Soft elliptical contact shadow / AO where the canopy meets the ceiling (tight, dark near contact, soft falloff).`,
        `- Subtle cast shadow of the hanging body on walls/floor consistent with the room's key light — never a hard cutout drop-shadow.`,
        `- Edge blending: no hard cutout edges, no halo, no studio white fringe. Fixture edges must dissolve naturally into the photo.`,
        `- Fixture may be gently illuminated if the product is a light, but keep exposure consistent with the photo.`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const ceiling = plan.ceilingPlane || {};

  return `
You are a professional interior photo retoucher performing a photorealistic lighting installation edit.

INPUT IMAGES:
1) Room photograph (edit this — preserve it exactly except for surgical fixture replacement).
2+) Shopify product reference photos (appearance guides ONLY). These may include transparent backgrounds — NEVER collage, paste, sticker, or drop a rectangular product thumbnail into the room.

ABSOLUTE ROOM RULES:
- Preserve the customer's room EXACTLY: furniture, walls, paint, flooring, windows, decor, camera angle, perspective, and depth.
- Do NOT redesign, restyle, or empty the room.
- Only change what is required to replace/install the selected lighting products.

EXISTING FIXTURE REPLACEMENT (critical):
- If the room already has a chandelier, pendant, canopy, chain, flush light, or similar ceiling fixture under/near the install point, REMOVE it surgically.
- Do NOT leave the old fixture visible behind or around the new one.
- Dissolve ONLY the old fixture geometry (canopy, stem/chain/rod, body, bulbs, crystals) and its local hard shadows.
- Reconstruct the ceiling plaster/paint/texture UNDER that fixture so it continues naturally with neighboring ceiling detail — same color, grain, seams, and lighting.
- Keep cornices, moldings, walls, furniture, and all surrounding details unchanged.
- Then install the new fixture at the customer's mount point so the edit looks like a real swap, not a blank ceiling patch and not a sticker on top of the old light.

ANTI-FLOAT / EDGE BLENDING / NO PASTE (critical):
- The result must look like a real photograph of an installed fixture — NEVER a product card pasted into the photo.
- FORBIDDEN: rectangular thumbnail overlays, catalog borders, white studio boxes, hard cutout edges, floating stickers, collage seams, glowing halos.
- Rebuild the chandelier IN the scene (canopy flush to ceiling, stem/chain, body, crystals) with correct perspective.
- Soft elliptical contact shadow / AO where the canopy meets the ceiling.
- Match the room's light direction, color temperature, and ambient bounce on metal/glass.
CEILING / MOUNT GEOMETRY:
- Approximate ceiling band: y=${ceiling.ceilingYMinPercent ?? 0}% to y=${ceiling.ceilingYMaxPercent ?? 36}% from the top.
- The customer tap is the EXACT canopy mount. Only the body hangs below — never move the canopy sideways or down to "make room" for the chandelier.
- Precision matters: canopy pixel center must land on the stated mount percentages.

PROPORTIONAL SCALE (critical):
- Automatically scale the new chandelier to the room — realistic and proportional to room size and ceiling height.
- Prefer a modest size. Avoid anything that looks too large for the space.
- Use furniture and ceiling height as the scale reference.

INSTALLATIONS:
${fixtureLines}

OUTPUT:
- One seamless photorealistic photo of the SAME room with the new fixtures installed (old fixtures surgically replaced where needed).
- Difficult to distinguish from a real photograph.
- No logos, watermarks, text, borders, or UI chrome.
`.trim();
}
