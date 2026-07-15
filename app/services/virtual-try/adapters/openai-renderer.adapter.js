import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import {
  buildAndSavePlacementPlan,
  buildGenerationPrompt,
} from "../../placement/placement-plan.server.js";
import { RENDERER_IDS } from "../../placement/constants.js";

let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const ROOM_MAX_EDGE = Number(process.env.ENARTE_ROOM_MAX_EDGE || 1024);
const PRODUCT_MAX_EDGE = Number(process.env.ENARTE_PRODUCT_MAX_EDGE || 768);
const IMAGE_QUALITY = process.env.ENARTE_IMAGE_QUALITY || "medium";
const INPUT_FIDELITY = process.env.ENARTE_INPUT_FIDELITY || "high";
const JPEG_QUALITY = Number(process.env.ENARTE_PREP_JPEG_QUALITY || 82);
const OPENAI_EDIT_TIMEOUT_MS = Number(
  process.env.ENARTE_OPENAI_PLACE_MS || 90_000,
);

function pickOutputSize(width, height) {
  if (!width || !height) return "1024x1024";
  const ratio = width / height;
  if (ratio > 1.35) return "1536x1024";
  if (ratio < 0.75) return "1024x1536";
  return "1024x1024";
}

async function encodeJpeg(buffer, maxEdge) {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

async function encodeProductPngCutout(buffer, maxEdge) {
  const resized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const keyed = Buffer.from(data);
  for (let i = 0; i < keyed.length; i += info.channels) {
    const r = keyed[i];
    const g = keyed[i + 1];
    const b = keyed[i + 2];
    const a = info.channels > 3 ? keyed[i + 3] : 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luminance > 248 && Math.abs(r - g) < 10 && Math.abs(g - b) < 10) {
      keyed[i + 3] = 0;
    } else if (luminance > 240 && a > 0) {
      keyed[i + 3] = Math.min(a, 40);
    } else if (luminance > 230 && a > 0) {
      keyed[i + 3] = Math.min(a, Math.round(a * 0.65));
    }
  }

  return sharp(keyed, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function buildPreparePrompt(analysis) {
  const cleanup = analysis?.needsCeilingCleanup
    ? `
CEILING SIMPLIFICATION (required):
- Flatten complex gypsum / coffers / heavy decorative ceiling molding into a clean, flat, white/off-white painted ceiling.
- Keep the ceiling plane perspective-correct with the original photo.
- Do not invent new architecture elsewhere.
`
    : `
CEILING:
- Keep the ceiling surface style if already simple and flat.
- Still remove old light fixtures surgically.
`;

  return `
You are a professional interior photo retoucher preparing a room for new lighting installation.

TASK — PREPARE ONLY (do not install new products yet):
1) Remove ALL existing ceiling light fixtures: chandeliers, pendants, flush mounts, canopies, rods, chains, roses, and their local hard shadows.
2) Reconstruct ceiling plaster/paint under removed fixtures so the ceiling looks continuous and natural.
3) ${cleanup}
4) Preserve furniture, walls, flooring, windows, decor, camera angle, and perspective EXACTLY.
5) Do not add any new lighting products, lamps, or furniture.
6) Do not redesign the room style beyond the ceiling cleanup above.
7) Output one photorealistic photo of the same room, ready for fixture installation.
8) No text, logos, watermarks, or UI chrome.

Room context: ${analysis?.roomTypeLabelAr || analysis?.roomType || "interior"}.
${analysis?.summaryAr || ""}
`.trim();
}

function buildInstallPromptFromFixtures(plan, analysis, layout) {
  const base = buildGenerationPrompt(plan);
  const scaleNotes = (plan.fixtures || [])
    .map((f, i) => {
      const ratio = layout?.mounts?.[i]?.scaleRatio ?? 1;
      return `- Fixture ${f.index}: relative scale factor ${ratio} vs primary (1.0 = normal for room). Prefer modest proportional size.`;
    })
    .join("\n");

  return `
${base}

AUTO LAYOUT CONTEXT (no customer taps):
- Mount coordinates were chosen by a professional layout planner for a ${analysis?.roomType || "room"}.
- Treat LOCKED MOUNT percentages as exact canopy positions.
- Ceiling was already pre-cleaned; do not reintroduce old fixtures.
- Scale guidance:
${scaleNotes}
`.trim();
}

async function callImageEdit({ images, prompt, size }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for virtual-try rendering");
  }

  try {
    const response = await getOpenAI().images.edit(
      {
        model: "gpt-image-1",
        image: images,
        prompt,
        n: 1,
        size,
        quality: IMAGE_QUALITY,
        input_fidelity: INPUT_FIDELITY,
        output_format: "jpeg",
      },
      { signal: AbortSignal.timeout(OPENAI_EDIT_TIMEOUT_MS) },
    );
    const b64 = response?.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 returned no image data");
    return Buffer.from(b64, "base64");
  } catch (apiError) {
    const timedOut =
      apiError?.name === "AbortError" ||
      apiError?.code === "ABORT_ERR" ||
      /aborted|timeout/i.test(String(apiError?.message || ""));
    const err = new Error(
      timedOut
        ? `OpenAI image generation timed out after ${OPENAI_EDIT_TIMEOUT_MS}ms`
        : apiError?.message || "OpenAI image generation failed",
    );
    err.status = timedOut ? 504 : apiError?.status || 502;
    err.code = timedOut ? "OPENAI_TIMEOUT" : apiError?.code || "OPENAI_IMAGE_FAILED";
    err.cause = apiError;
    throw err;
  }
}

/**
 * OpenAI gpt-image-1 adapter implementing the virtual-try renderer port.
 */
export function createOpenAiVirtualTryRenderer() {
  return {
    id: RENDERER_IDS.OPENAI_GPT_IMAGE_1,

    async prepareCeiling(input) {
      const roomJpeg = await encodeJpeg(input.roomImage, ROOM_MAX_EDGE);
      const meta = await sharp(input.roomImage, { failOn: "none" }).metadata();
      const size = pickOutputSize(meta.width, meta.height);
      const roomUpload = await toFile(roomJpeg, "room.jpg", {
        type: "image/jpeg",
      });
      const image = await callImageEdit({
        images: [roomUpload],
        prompt: buildPreparePrompt(input.analysis),
        size,
      });
      return {
        image,
        mimeType: "image/jpeg",
        engineId: RENDERER_IDS.OPENAI_GPT_IMAGE_1,
        meta: { phase: "prepare", size, quality: IMAGE_QUALITY },
      };
    },

    async installFixtures(input) {
      const placements = (input.fixtures || []).map((f) => ({
        markerId: f.id,
        x: f.x,
        y: f.y,
        lightingType: f.lightingType || "enarte_decide",
        product: f.product,
      }));

      const { plan } = await buildAndSavePlacementPlan({
        roomMeta: {},
        placements,
        roomImageBuffer: input.roomImage,
        persist: false,
      });

      // Apply relative scale hints into plan (prompt appendix uses layout)
      const roomJpeg = await encodeJpeg(input.roomImage, ROOM_MAX_EDGE);
      const meta = await sharp(input.roomImage, { failOn: "none" }).metadata();
      plan.room = { width: meta.width || null, height: meta.height || null };

      const productPngs = await Promise.all(
        (input.productImages || []).map((buf) =>
          encodeProductPngCutout(buf, PRODUCT_MAX_EDGE),
        ),
      );

      const [roomUpload, ...productUploads] = await Promise.all([
        toFile(roomJpeg, "room.jpg", { type: "image/jpeg" }),
        ...productPngs.map((png, i) =>
          toFile(png, `product_${i + 1}.png`, { type: "image/png" }),
        ),
      ]);

      const size = pickOutputSize(meta.width, meta.height);
      const prompt = buildInstallPromptFromFixtures(
        plan,
        input.analysis,
        input.layout,
      );
      const image = await callImageEdit({
        images: [roomUpload, ...productUploads],
        prompt,
        size,
      });

      return {
        image,
        mimeType: "image/jpeg",
        engineId: RENDERER_IDS.OPENAI_GPT_IMAGE_1,
        meta: {
          phase: "install",
          size,
          quality: IMAGE_QUALITY,
          planId: plan.planId,
          fixtureCount: placements.length,
        },
      };
    },
  };
}
