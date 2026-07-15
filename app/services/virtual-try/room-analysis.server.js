import OpenAI from "openai";
import sharp from "sharp";

let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const ANALYSIS_JSON_PROMPT = `
You are a professional interior lighting analyst. Analyze the room photo.
Return ONLY valid JSON (no markdown) with this shape:
{
  "roomType": "living"|"dining"|"bedroom"|"hallway"|"unknown",
  "roomTypeLabelAr": "string",
  "style": "string",
  "areaHintSqm": number|null,
  "ceilingHeightM": number|null,
  "needsCeilingCleanup": boolean,
  "hasExistingFixtures": boolean,
  "summaryAr": "short Arabic summary under 80 words",
  "anchors": {
    "seating": {"x":0-100,"y":0-100}|null,
    "table": {"x":0-100,"y":0-100}|null,
    "bed": {"x":0-100,"y":0-100}|null,
    "corridor": {"x":0-100,"y":0-100}|null
  }
}
Rules:
- roomType from furniture (sofa=living, dining table=dining, bed=bedroom, corridor=hallway).
- anchors are approximate centers of the primary function zone in image percentages.
- needsCeilingCleanup=true if ornate gypsum, coffers, or heavy ceiling molding that would hurt fixture realism (suggest flattening to plain white).
- hasExistingFixtures=true if any chandelier/pendant/flush ceiling light is visible.
`.trim();

function fallbackAnalysis(style) {
  return {
    roomType: "living",
    roomTypeLabelAr: "غرفة معيشة",
    style: style || "modern",
    areaHintSqm: 20,
    ceilingHeightM: 2.8,
    needsCeilingCleanup: false,
    hasExistingFixtures: true,
    summaryAr: "غرفة عامة — سيتم التوزيع تلقائياً حسب أفضل الممارسات.",
    anchors: {
      seating: { x: 50, y: 62 },
      table: null,
      bed: null,
      corridor: null,
    },
    rawText: "",
  };
}

function parseJsonLoose(text) {
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

function normalizeRoomType(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("din") || v.includes("سفرة") || v.includes("طعام")) return "dining";
  if (v.includes("bed") || v.includes("نوم")) return "bedroom";
  if (v.includes("hall") || v.includes("ممر") || v.includes("corridor")) {
    return "hallway";
  }
  if (v.includes("liv") || v.includes("معيش") || v.includes("جلوس")) return "living";
  return "unknown";
}

/**
 * @param {Buffer} roomImageBuffer
 * @param {{ style?: string }} [opts]
 * @returns {Promise<import('./types.js').RoomAnalysis>}
 */
export async function analyzeRoom(roomImageBuffer, opts = {}) {
  if (!roomImageBuffer?.length) {
    throw new Error("Room image is required for analysis");
  }

  if (!process.env.OPENAI_API_KEY) {
    return fallbackAnalysis(opts.style);
  }

  const jpeg = await sharp(roomImageBuffer, { failOn: "none" })
    .rotate()
    .resize(960, 960, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 65, mozjpeg: true })
    .toBuffer();

  const styleHint = opts.style
    ? `\nPreferred design style hint from user: ${opts.style}.`
    : "";

  try {
    const response = await getOpenAI().responses.create({
      model: process.env.ENARTE_ANALYZE_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: ANALYSIS_JSON_PROMPT + styleHint },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
            },
          ],
        },
      ],
    });

    const parsed = parseJsonLoose(response.output_text);
    if (!parsed) {
      return { ...fallbackAnalysis(opts.style), rawText: response.output_text };
    }

    const roomType = normalizeRoomType(parsed.roomType);
    return {
      roomType: roomType === "unknown" ? "living" : roomType,
      roomTypeLabelAr:
        parsed.roomTypeLabelAr ||
        ({
          living: "غرفة معيشة",
          dining: "غرفة سفرة",
          bedroom: "غرفة نوم",
          hallway: "ممر",
        }[roomType] || "غرفة"),
      style: parsed.style || opts.style || "modern",
      areaHintSqm:
        typeof parsed.areaHintSqm === "number" ? parsed.areaHintSqm : null,
      ceilingHeightM:
        typeof parsed.ceilingHeightM === "number"
          ? parsed.ceilingHeightM
          : null,
      needsCeilingCleanup: Boolean(parsed.needsCeilingCleanup),
      hasExistingFixtures: Boolean(parsed.hasExistingFixtures),
      summaryAr: String(parsed.summaryAr || "").trim() || fallbackAnalysis().summaryAr,
      anchors: parsed.anchors || {},
      rawText: response.output_text,
    };
  } catch (error) {
    console.error("[virtual-try] room analysis failed", error?.message || error);
    return fallbackAnalysis(opts.style);
  }
}
