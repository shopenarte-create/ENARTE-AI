import OpenAI from "openai";
import sharp from "sharp";
import {
  getCachedCeilingPlane,
  setCachedCeilingPlane,
  hashBuffer,
} from "./cache.server.js";

let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

function extractJsonObject(text) {
  if (!text || typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // continue
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Fast ceiling band — no network. Used by default for render speed.
 * Preferred canopy line sits in the upper third of the band (natural ceiling mount).
 */
export function heuristicCeilingPlane() {
  return {
    method: "heuristic",
    ceilingYMinPercent: 0,
    ceilingYMaxPercent: 36,
    preferredMountYPercent: 14,
    confidence: 0.45,
    notes: "Fast heuristic ceiling band (upper ~36%); preferred canopy ~14% from top.",
  };
}

/**
 * Optional vision ceiling detection (slower).
 * Enabled only when ENARTE_CEILING_VISION=1.
 * Results are cached by room image hash.
 */
async function detectCeilingPlaneVision(roomImageBuffer) {
  const preview = await sharp(roomImageBuffer, { failOn: "none" })
    .resize({ width: 768, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();

  const dataUrl = `data:image/jpeg;base64,${preview.toString("base64")}`;

  const response = await getOpenAI().responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `
Analyze this interior room photo and estimate the CEILING surface only.

Return JSON only:
{
  "ceilingYMinPercent": number,
  "ceilingYMaxPercent": number,
  "preferredMountYPercent": number,
  "ceilingCenterXPercent": number,
  "confidence": number,
  "notes": string
}

Rules:
- Percentages are 0-100 from the TOP of the image (0 = top edge, 100 = bottom edge).
- ceilingYMinPercent is the highest visible ceiling area (usually near 0).
- ceilingYMaxPercent is where the ceiling meets walls (cornice / wall junction).
- preferredMountYPercent is the most natural canopy height on the ceiling plane (usually in the upper third of the ceiling band, NOT on the wall junction).
- ceilingCenterXPercent is the horizontal center of the main ceiling plane (often near 50).
- Do NOT include walls, floor, or furniture in the ceiling band.
- confidence is 0-1.
`.trim(),
          },
          {
            type: "input_image",
            image_url: dataUrl,
          },
        ],
      },
    ],
  });

  const parsed = extractJsonObject(response.output_text || "");
  if (!parsed) {
    return heuristicCeilingPlane();
  }

  const yMin = clamp(Number(parsed.ceilingYMinPercent), 0, 90);
  const yMax = clamp(Number(parsed.ceilingYMaxPercent), yMin + 5, 70);
  const preferred = clamp(
    Number(parsed.preferredMountYPercent) || yMin + (yMax - yMin) * 0.35,
    yMin,
    yMax - 2,
  );
  const centerX = clamp(Number(parsed.ceilingCenterXPercent) || 50, 5, 95);
  const confidence = clamp(Number(parsed.confidence) || 0.5, 0, 1);

  return {
    method: "vision",
    ceilingYMinPercent: Number(yMin.toFixed(2)),
    ceilingYMaxPercent: Number(yMax.toFixed(2)),
    preferredMountYPercent: Number(preferred.toFixed(2)),
    ceilingCenterXPercent: Number(centerX.toFixed(2)),
    confidence,
    notes: String(parsed.notes || "").slice(0, 400),
  };
}

/**
 * Detect ceiling plane for placement.
 * Default: cached heuristic (fast). Vision only if ENARTE_CEILING_VISION=1.
 */
export async function detectCeilingPlane(roomImageBuffer) {
  const roomHash = hashBuffer(roomImageBuffer);
  const cached = getCachedCeilingPlane(roomHash);
  if (cached) {
    return { ...cached, cached: true };
  }

  const useVision =
    process.env.ENARTE_CEILING_VISION === "1" && Boolean(process.env.OPENAI_API_KEY);

  let plane = heuristicCeilingPlane();
  if (useVision) {
    try {
      plane = await detectCeilingPlaneVision(roomImageBuffer);
    } catch (error) {
      console.error("Ceiling plane detection failed:", error.message);
      plane = heuristicCeilingPlane();
    }
  }

  setCachedCeilingPlane(roomHash, plane);
  return plane;
}

/**
 * Resolve canopy mount from the user's tap.
 * The tap IS the mount — we only clamp Y onto the ceiling band when the
 * tap clearly lands on a wall/furniture (never soft-snap X/Y away from intent).
 */
export function adjustMarkerToCeiling(marker, ceilingPlane) {
  let x = clamp(Number(marker.x), 0, 100);
  let y = clamp(Number(marker.y), 0, 100);
  const bandMin = ceilingPlane?.ceilingYMinPercent ?? 0;
  const bandMax = ceilingPlane?.ceilingYMaxPercent ?? 36;

  let adjusted = false;
  const reasons = [];

  // Keep canopy on the ceiling plane only when the tap is clearly off it.
  if (y > bandMax) {
    y = Math.max(bandMin + 0.8, bandMax - 1.2);
    adjusted = true;
    reasons.push("clamped_onto_ceiling");
  } else if (y < bandMin) {
    y = bandMin + 0.5;
    adjusted = true;
    reasons.push("clamped_above_ceiling");
  }

  // X stays exactly where the user tapped (premium: no auto-recenter).
  x = clamp(x, 0, 100);
  y = clamp(y, 0, 100);

  return {
    markerId: marker.markerId || marker.id,
    originalX: Number(Number(marker.x).toFixed(2)),
    originalY: Number(Number(marker.y).toFixed(2)),
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    adjusted,
    snapReasons: reasons,
  };
}
