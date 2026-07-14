/**
 * Vision helper for assistant photo → catalog search signals.
 * OpenAI SDK calls live in openai-responses.server.js (ai/ stays SDK-free).
 * Degrades safely (null) when vision fails — never invents products.
 */

import {
  isOpenAiConfigured,
  runAssistantVisionPrompt,
} from "../../openai-responses.server.js";

const ROOM_PROMPT = `You are ENARTE's lighting specialist. Analyze this room photo.
Reply with ONLY compact JSON (no markdown):
{
  "roomType": "living|bedroom|dining|kitchen|hallway|office|outdoor|other",
  "style": "modern|classic|crystal|luxury|minimal|led|other",
  "colors": ["gold"|"black"|"white"|"chrome"|"wood"|string],
  "fixturePreference": "chandelier|pendant|ceiling|wall|fan|outdoor|other",
  "searchQuery": "3-8 English keywords for ENARTE Shopify catalog search",
  "pitchHintEn": "one short sentence why that lighting suits the room",
  "pitchHintAr": "جملة قصيرة بالعربية"
}`;

const PRODUCT_PROMPT = `You are ENARTE's lighting specialist. Analyze this lighting product photo.
Reply with ONLY compact JSON (no markdown):
{
  "fixturePreference": "chandelier|pendant|ceiling|wall|fan|outdoor|table|floor|bulb|other",
  "style": "modern|classic|crystal|luxury|minimal|led|other",
  "colors": ["gold"|"black"|"white"|"chrome"|"wood"|string],
  "searchQuery": "3-8 English keywords to find same or closest ENARTE Shopify products",
  "pitchHintEn": "one short sentence about closest ENARTE matches",
  "pitchHintAr": "جملة قصيرة بالعربية"
}`;

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
 * @param {object} image
 * @param {string} [image.dataUrl]
 * @param {"room"|"product"} photoKind
 * @returns {Promise<object|null>}
 */
export async function analyzeAssistantPhoto(image, photoKind = "room") {
  if (!isOpenAiConfigured()) return null;
  const dataUrl = String(image?.dataUrl || "").trim();
  if (!dataUrl.startsWith("data:")) return null;

  try {
    const text = await runAssistantVisionPrompt(
      dataUrl,
      photoKind === "product" ? PRODUCT_PROMPT : ROOM_PROMPT,
    );
    const parsed = extractJson(text);
    if (!parsed || typeof parsed !== "object") return null;

    const searchQuery = String(parsed.searchQuery || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!searchQuery) return null;

    return Object.freeze({
      roomType: parsed.roomType || null,
      style: parsed.style || null,
      colors: Object.freeze(
        Array.isArray(parsed.colors)
          ? parsed.colors.map((c) => String(c)).filter(Boolean).slice(0, 4)
          : [],
      ),
      fixturePreference: parsed.fixturePreference || null,
      searchQuery,
      pitchHintEn: parsed.pitchHintEn || null,
      pitchHintAr: parsed.pitchHintAr || null,
    });
  } catch {
    return null;
  }
}

export function visionToDescribeSlots(analysis = {}) {
  const slots = {};
  const fixture = String(analysis.fixturePreference || "").toLowerCase();
  const fixtureMap = {
    chandelier: "chandelier",
    pendant: "pendant",
    ceiling: "ceiling",
    wall: "wall",
    fan: "fan",
    outdoor: "outdoor",
    table: "table",
    floor: "floor",
    bulb: "bulb",
  };
  if (fixtureMap[fixture]) slots.productType = fixtureMap[fixture];

  const style = String(analysis.style || "").toLowerCase();
  const styleMap = {
    crystal: "crystal",
    led: "led",
    modern: "modern",
    classic: "classic",
    luxury: "luxury",
    minimal: "minimal",
  };
  if (styleMap[style]) slots.style = styleMap[style];

  const room = String(analysis.roomType || "").toLowerCase();
  const roomMap = {
    living: "living",
    bedroom: "bedroom",
    dining: "dining",
    kitchen: "kitchen",
    hallway: "hallway",
    office: "office",
    outdoor: "outdoor",
  };
  if (roomMap[room]) slots.room = roomMap[room];

  const color = Array.isArray(analysis.colors) ? analysis.colors[0] : null;
  const colorMap = {
    gold: "gold",
    black: "black",
    white: "white",
    chrome: "chrome",
    wood: "wood",
  };
  if (color && colorMap[String(color).toLowerCase()]) {
    slots.color = colorMap[String(color).toLowerCase()];
  }

  return Object.freeze(slots);
}
