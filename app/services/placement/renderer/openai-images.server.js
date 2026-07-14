import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { RENDERER_IDS } from "../constants.js";
import { buildGenerationPrompt } from "../placement-plan.server.js";
import {
  hashBuffer,
  getCachedRoomPrep,
  setCachedRoomPrep,
  getCachedProductImage,
  setCachedProductImage,
} from "../cache.server.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Photoreal install via gpt-image-1 — async place jobs avoid App Proxy cutoff. */
const ROOM_MAX_EDGE = Number(process.env.ENARTE_ROOM_MAX_EDGE || 1024);
const PRODUCT_MAX_EDGE = Number(process.env.ENARTE_PRODUCT_MAX_EDGE || 768);
const IMAGE_QUALITY = process.env.ENARTE_IMAGE_QUALITY || "medium";
const INPUT_FIDELITY = process.env.ENARTE_INPUT_FIDELITY || "high";
const JPEG_QUALITY = Number(process.env.ENARTE_PREP_JPEG_QUALITY || 82);
const OPENAI_EDIT_TIMEOUT_MS = Number(
  process.env.ENARTE_OPENAI_PLACE_MS || 90_000,
);

function pickOutputSize(width, height) {
  if (!width || !height) {
    return "1024x1024";
  }
  const ratio = width / height;
  if (ratio > 1.35) {
    return "1536x1024";
  }
  if (ratio < 0.75) {
    return "1024x1536";
  }
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

async function prepareRoomJpeg(roomImage) {
  const roomHash = hashBuffer(roomImage);
  const cacheKey = `${ROOM_MAX_EDGE}:${JPEG_QUALITY}:${roomHash}`;
  const cached = getCachedRoomPrep(cacheKey);
  if (cached?.jpeg && cached?.meta) {
    return cached;
  }

  const pipeline = sharp(roomImage, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const jpeg = await encodeJpeg(roomImage, ROOM_MAX_EDGE);
  const prepared = {
    jpeg,
    meta: {
      width: meta.width || null,
      height: meta.height || null,
    },
    roomHash,
  };
  setCachedRoomPrep(cacheKey, prepared);
  return prepared;
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
    // Soft studio-white removal so the model rebuilds the fixture in-scene
    // instead of pasting a catalog card.
    if (luminance > 248 && Math.abs(r - g) < 10 && Math.abs(g - b) < 10) {
      keyed[i + 3] = 0;
    } else if (luminance > 240 && a > 0) {
      keyed[i + 3] = Math.min(a, 40);
    } else if (luminance > 230 && a > 0) {
      keyed[i + 3] = Math.min(a, Math.round(a * 0.65));
    }
  }

  return sharp(keyed, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function prepareProductImages(productImages) {
  const byHash = new Map();

  await Promise.all(
    productImages.map(async (buf) => {
      const key = hashBuffer(buf);
      if (byHash.has(key)) return;
      const cacheKey = `pngcut:${PRODUCT_MAX_EDGE}:${key}`;
      let png = getCachedProductImage(cacheKey);
      if (!png) {
        png = await encodeProductPngCutout(buf, PRODUCT_MAX_EDGE);
        setCachedProductImage(cacheKey, png);
      }
      byHash.set(key, png);
    }),
  );

  return productImages.map((buf) => byHash.get(hashBuffer(buf)));
}

/**
 * Primary production renderer: OpenAI gpt-image-1 (Images edit).
 */
export function createOpenAiGptImageRenderer() {
  return {
    id: RENDERER_IDS.OPENAI_GPT_IMAGE_1,

    async render(input) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required for gpt-image-1 rendering");
      }
      if (!input?.roomImage?.length) {
        throw new Error("Room image is required");
      }
      if (!input?.plan) {
        throw new Error("Placement plan is required");
      }

      const started = Date.now();
      const productImages = input.productImages || [];
      const prompt = buildGenerationPrompt(input.plan);

      const prepStarted = Date.now();
      const [roomPrep, productPngs] = await Promise.all([
        prepareRoomJpeg(input.roomImage),
        prepareProductImages(productImages),
      ]);
      const prepMs = Date.now() - prepStarted;

      const [roomUpload, ...productUploads] = await Promise.all([
        toFile(roomPrep.jpeg, "room.jpg", { type: "image/jpeg" }),
        ...productPngs.map((png, i) =>
          toFile(png, `product_${i + 1}.png`, { type: "image/png" }),
        ),
      ]);

      const size = pickOutputSize(roomPrep.meta.width, roomPrep.meta.height);

      const apiStarted = Date.now();
      let response;
      try {
        response = await openai.images.edit(
          {
            model: "gpt-image-1",
            image: [roomUpload, ...productUploads],
            prompt,
            n: 1,
            size,
            quality: IMAGE_QUALITY,
            input_fidelity: INPUT_FIDELITY,
            output_format: "jpeg",
          },
          {
            signal: AbortSignal.timeout(OPENAI_EDIT_TIMEOUT_MS),
          },
        );
      } catch (apiError) {
        const timedOut =
          apiError?.name === "AbortError" ||
          apiError?.code === "ABORT_ERR" ||
          /aborted|timeout/i.test(String(apiError?.message || ""));
        const status = timedOut
          ? 504
          : apiError?.status || apiError?.response?.status || null;
        const code = timedOut
          ? "OPENAI_TIMEOUT"
          : apiError?.code || apiError?.error?.code || null;
        const requestId =
          apiError?.requestID ||
          apiError?.headers?.["x-request-id"] ||
          null;
        console.error("[openai-render] failed", {
          status,
          code,
          requestId,
          timedOut,
          message: apiError?.message || String(apiError),
          type: apiError?.type || apiError?.error?.type || null,
          prepMs,
          size,
          quality: IMAGE_QUALITY,
          productCount: productImages.length,
          timeoutMs: OPENAI_EDIT_TIMEOUT_MS,
        });
        const err = new Error(
          timedOut
            ? `OpenAI image generation timed out after ${OPENAI_EDIT_TIMEOUT_MS}ms`
            : status
              ? `OpenAI image generation failed (HTTP ${status}${code ? ` / ${code}` : ""})`
              : apiError?.message || "OpenAI image generation failed",
        );
        err.status = status;
        err.code = code || "OPENAI_IMAGE_FAILED";
        err.cause = apiError;
        throw err;
      }
      const apiMs = Date.now() - apiStarted;

      const b64 = response?.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error("gpt-image-1 returned no image data");
      }

      console.log("[openai-render]", {
        prepMs,
        apiMs,
        totalMs: Date.now() - started,
        size,
        quality: IMAGE_QUALITY,
        roomBytes: roomPrep.jpeg.length,
        productCount: productImages.length,
      });

      return {
        image: Buffer.from(b64, "base64"),
        mimeType: "image/jpeg",
        engineId: RENDERER_IDS.OPENAI_GPT_IMAGE_1,
        meta: {
          model: "gpt-image-1",
          size,
          quality: IMAGE_QUALITY,
          inputFidelity: INPUT_FIDELITY,
          roomWidth: roomPrep.meta.width,
          roomHeight: roomPrep.meta.height,
          productReferenceCount: productImages.length,
          promptVersion: input.plan.generationPromptVersion || null,
          timings: { prepMs, apiMs, totalMs: Date.now() - started },
        },
      };
    },
  };
}
