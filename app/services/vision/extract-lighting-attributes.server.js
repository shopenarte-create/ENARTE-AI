/**
 * Vision → structured lighting attributes (ENARTE only).
 * Shared module for Search-by-image and future Try-in-room reuse.
 * OpenAI SDK calls stay in openai-responses.server.js.
 */

import sharp from "sharp";
import {
  isOpenAiConfigured,
  runAssistantVisionPrompt,
} from "../assistant/openai-responses.server.js";
import { LIGHTING_VISION_MODES } from "./schema.js";
import {
  hasUsableVisionAttributes,
  normalizeVisionAttributes,
} from "./normalize-attributes.js";

const PRODUCT_ATTRIBUTE_PROMPT = `You are ENARTE's lighting product analyst.
Analyze the uploaded lighting fixture photo.
Reply with ONLY compact JSON (no markdown, no extra text):
{
  "type": "chandelier|pendant|sconce|spot|track|floor|table|outdoor|ceiling|fan|null",
  "style": "modern|classic|crystal|luxury|industrial|art_deco|led|null",
  "shape": "round|linear|cascade|orb|square|branch|spiral|null",
  "rings": null or integer arm/ring/tier count if visible,
  "materials": ["crystal"|"glass"|"metal"|"brass"|"wood"|"marble"|"fabric"],
  "colors": ["gold"|"black"|"white"|"chrome"|"brass"|"bronze"|"silver"|"copper"|"wood"|"marble"|"clear"],
  "size": "small|medium|large|null",
  "confidence": 0.0-1.0,
  "notes": "optional short English note"
}
Rules:
- Describe ONLY what is visible in the photo.
- Use null / [] when unsure — do not invent.
- Prefer ENARTE lighting vocabulary above.
- Do not search the web. Do not invent brand SKUs or prices.`;

const ROOM_ATTRIBUTE_PROMPT = `You are ENARTE's interior lighting analyst.
Analyze this room photo for lighting recommendations.
Reply with ONLY compact JSON (no markdown):
{
  "type": "chandelier|pendant|sconce|spot|track|floor|table|outdoor|ceiling|fan|null",
  "style": "modern|classic|crystal|luxury|industrial|art_deco|led|null",
  "shape": "round|linear|cascade|orb|square|branch|spiral|null",
  "rings": null,
  "materials": ["crystal"|"glass"|"metal"|"brass"|"wood"|"marble"|"fabric"],
  "colors": ["gold"|"black"|"white"|"chrome"|"brass"|"bronze"|"silver"|"copper"|"wood"|"marble"|"clear"],
  "size": "small|medium|large|null",
  "roomType": "living|bedroom|dining|kitchen|hallway|office|outdoor|other|null",
  "confidence": 0.0-1.0,
  "notes": "optional short English note"
}
Rules:
- Recommend fixture traits that fit the room; stay uncertain with null.
- Do not invent products, SKUs, or prices. ENARTE catalog search happens separately.`;

function extractJson(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Shrink image for Vision (cost/latency) while keeping enough detail.
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ dataUrl: string, mime: string }|null>}
 */
export async function bufferToVisionDataUrl(imageBuffer, maxSide = 1024) {
  if (!imageBuffer?.length) return null;
  try {
    const out = await sharp(imageBuffer, { failOn: "none" })
      .rotate()
      .resize({
        width: maxSide,
        height: maxSide,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    return {
      mime: "image/jpeg",
      dataUrl: `data:image/jpeg;base64,${out.toString("base64")}`,
    };
  } catch {
    try {
      return {
        mime: "image/jpeg",
        dataUrl: `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString("base64")}`,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Extract structured lighting attributes from an image via Vision.
 * @param {object} options
 * @param {Buffer} [options.imageBuffer]
 * @param {string} [options.dataUrl]
 * @param {"product"|"room"} [options.mode]
 * @returns {Promise<{ ok: boolean, attributes: object|null, error?: string }>}
 */
export async function extractLightingAttributesFromImage({
  imageBuffer = null,
  dataUrl = null,
  mode = LIGHTING_VISION_MODES.PRODUCT,
} = {}) {
  if (!isOpenAiConfigured()) {
    return {
      ok: false,
      attributes: null,
      error: "vision_unavailable",
    };
  }

  let url = String(dataUrl || "").trim();
  if (!url.startsWith("data:") && imageBuffer?.length) {
    const prepared = await bufferToVisionDataUrl(imageBuffer);
    url = prepared?.dataUrl || "";
  }
  if (!url.startsWith("data:")) {
    return { ok: false, attributes: null, error: "missing_image" };
  }

  const prompt =
    mode === LIGHTING_VISION_MODES.ROOM
      ? ROOM_ATTRIBUTE_PROMPT
      : PRODUCT_ATTRIBUTE_PROMPT;

  try {
    const text = await runAssistantVisionPrompt(url, prompt);
    const parsed = extractJson(text);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, attributes: null, error: "vision_parse_failed" };
    }
    const attributes = normalizeVisionAttributes(parsed);
    if (!hasUsableVisionAttributes(attributes)) {
      return {
        ok: false,
        attributes,
        error: "vision_weak_signal",
      };
    }
    return { ok: true, attributes, error: null };
  } catch (error) {
    return {
      ok: false,
      attributes: null,
      error: error?.message || "vision_failed",
    };
  }
}

export {
  hasUsableVisionAttributes,
  normalizeVisionAttributes,
  LIGHTING_VISION_MODES,
};
