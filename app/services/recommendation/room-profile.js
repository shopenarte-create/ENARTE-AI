import {
  CEILING_HEIGHT_VOCAB,
  COMPACT_FIXTURE_ROOM_TYPES,
  LARGE_FIXTURE_ROOM_TYPES,
  ROOM_SIZE_VOCAB,
  ROOM_TYPE_VOCAB,
  STYLE_VOCAB,
} from "./config.js";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function findFirstMatch(text, vocabMap) {
  for (const [id, keywords] of Object.entries(vocabMap)) {
    for (const keyword of keywords) {
      if (text.includes(normalizeText(keyword))) {
        return id;
      }
    }
  }
  return null;
}

function findAllMatches(text, vocabMap) {
  const hits = [];
  for (const [id, keywords] of Object.entries(vocabMap)) {
    if (keywords.some((keyword) => text.includes(normalizeText(keyword)))) {
      hits.push(id);
    }
  }
  return hits;
}

/**
 * Derive a structured room profile from existing free-text analysis.
 * Does not call OpenAI and does not change the analyze API.
 *
 * @param {string} analysisText
 * @param {{ id?: string, hasLimit?: boolean, min?: number|null, max?: number|null }} [budgetRange]
 */
export function buildRoomProfileFromAnalysis(analysisText = "", budgetRange = null) {
  const text = normalizeText(analysisText);

  const roomType = findFirstMatch(text, ROOM_TYPE_VOCAB) || "living_room";
  let roomSize = findFirstMatch(text, ROOM_SIZE_VOCAB);

  if (!roomSize) {
    if (LARGE_FIXTURE_ROOM_TYPES.includes(roomType)) {
      roomSize = "large";
    } else if (COMPACT_FIXTURE_ROOM_TYPES.includes(roomType)) {
      roomSize = "small";
    } else {
      roomSize = "medium";
    }
  }

  const ceilingHeight = findFirstMatch(text, CEILING_HEIGHT_VOCAB) || "standard";
  const styles = findAllMatches(text, STYLE_VOCAB);

  const fixturePreference = LARGE_FIXTURE_ROOM_TYPES.includes(roomType)
    ? "chandelier"
    : COMPACT_FIXTURE_ROOM_TYPES.includes(roomType)
      ? "pendant"
      : roomSize === "large"
        ? "chandelier"
        : roomSize === "small"
          ? "pendant"
          : "any";

  return {
    version: "room.profile.v1",
    roomType,
    roomSize,
    ceilingHeight,
    styles,
    fixturePreference,
    budget: {
      id: budgetRange?.id || "no_limit",
      hasLimit: Boolean(budgetRange?.hasLimit),
      min: budgetRange?.min ?? null,
      max: budgetRange?.max ?? null,
    },
    rawAnalysis: String(analysisText || "").trim(),
    tokens: text
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .filter((token, index, arr) => arr.indexOf(token) === index)
      .slice(0, 50),
  };
}
