import { VIRTUAL_TRY_MAX_COUNT } from "./types.js";

/**
 * Professional mount layouts by room type + fixture count.
 */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function mount(id, x, y, scaleRatio = 1) {
  return {
    id,
    x: Number(clamp(x, 8, 92).toFixed(2)),
    y: Number(clamp(y, 6, 42).toFixed(2)),
    scaleRatio,
    fixtureKind: "chandelier",
  };
}

function suggestCountForRoom(analysis) {
  const area = Number(analysis?.areaHintSqm) || 18;
  const type = analysis?.roomType || "living";

  if (type === "hallway") {
    if (area < 8) return 1;
    if (area < 16) return 2;
    return 3;
  }
  if (type === "bedroom") {
    if (area < 12) return 1;
    if (area < 22) return 1;
    return 2;
  }
  if (type === "dining") {
    if (area < 14) return 1;
    if (area < 28) return 2;
    return 3;
  }
  // living
  if (area < 14) return 1;
  if (area < 25) return 2;
  if (area < 40) return 3;
  return 4;
}

function suggestionReason(requested, suggested, analysis) {
  if (requested === suggested) return null;
  const type = analysis?.roomTypeLabelAr || "هذه الغرفة";
  if (requested > suggested) {
    return `للـ${type}، الأنسب عادةً ${suggested} ${suggested === 1 ? "ثريا" : "ثريات"} بدل ${requested} حتى لا تزدحم المساحة.`;
  }
  return `للـ${type}، يمكننا تركيب ${suggested} ${suggested === 1 ? "ثريا" : "ثريات"} لتغطية أفضل، وأنت اخترت ${requested}.`;
}

function anchorPoint(analysis, key, fallback) {
  const a = analysis?.anchors?.[key];
  if (a && typeof a.x === "number" && typeof a.y === "number") {
    return { x: a.x, y: Math.min(38, Math.max(8, a.y * 0.45)) };
  }
  return fallback;
}

/**
 * Ceiling y: mounts live in upper third; map zone to ceiling above furniture.
 */
function buildsForType(roomType, count, analysis) {
  const ceilingY = 14;
  if (roomType === "dining") {
    const center = anchorPoint(analysis, "table", { x: 50, y: ceilingY });
    if (count === 1) return [mount("m1", center.x, ceilingY, 1)];
    if (count === 2) {
      return [
        mount("m1", center.x - 12, ceilingY, 0.95),
        mount("m2", center.x + 12, ceilingY, 0.95),
      ];
    }
    if (count === 3) {
      return [
        mount("m1", center.x - 16, ceilingY, 0.9),
        mount("m2", center.x, ceilingY, 1),
        mount("m3", center.x + 16, ceilingY, 0.9),
      ];
    }
    // 4–5 linear over table axis
    const xs = [-22, -11, 0, 11, 22].slice(0, count);
    return xs.map((dx, i) =>
      mount(`m${i + 1}`, center.x + dx, ceilingY, i === Math.floor(count / 2) ? 1 : 0.88),
    );
  }

  if (roomType === "bedroom") {
    const center = anchorPoint(analysis, "bed", { x: 50, y: ceilingY });
    if (count === 1) return [mount("m1", center.x, ceilingY, 1)];
    if (count === 2) {
      return [
        mount("m1", center.x - 10, ceilingY + 1, 0.92),
        mount("m2", center.x + 10, ceilingY + 1, 0.92),
      ];
    }
    return [
      mount("m1", center.x, ceilingY, 1),
      ...Array.from({ length: count - 1 }, (_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const step = 10 + Math.floor(i / 2) * 8;
        return mount(`m${i + 2}`, center.x + side * step, ceilingY + 2, 0.85);
      }),
    ];
  }

  if (roomType === "hallway") {
    const center = anchorPoint(analysis, "corridor", { x: 50, y: ceilingY });
    if (count === 1) return [mount("m1", center.x, ceilingY, 0.85)];
    const span = 28;
    return Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = center.x - span / 2 + span * t;
      return mount(`m${i + 1}`, x, ceilingY, 0.8);
    });
  }

  // living — distribute around seating zone
  const seating = anchorPoint(analysis, "seating", { x: 50, y: ceilingY });
  if (count === 1) return [mount("m1", seating.x, ceilingY, 1)];
  if (count === 2) {
    return [
      mount("m1", seating.x - 14, ceilingY, 0.95),
      mount("m2", seating.x + 14, ceilingY, 0.95),
    ];
  }
  if (count === 3) {
    return [
      mount("m1", seating.x, ceilingY, 1),
      mount("m2", seating.x - 18, ceilingY + 2, 0.88),
      mount("m3", seating.x + 18, ceilingY + 2, 0.88),
    ];
  }
  if (count === 4) {
    return [
      mount("m1", seating.x - 16, ceilingY, 0.9),
      mount("m2", seating.x + 16, ceilingY, 0.9),
      mount("m3", seating.x - 8, ceilingY + 4, 0.85),
      mount("m4", seating.x + 8, ceilingY + 4, 0.85),
    ];
  }
  return [
    mount("m1", seating.x, ceilingY, 1),
    mount("m2", seating.x - 18, ceilingY, 0.88),
    mount("m3", seating.x + 18, ceilingY, 0.88),
    mount("m4", seating.x - 10, ceilingY + 5, 0.82),
    mount("m5", seating.x + 10, ceilingY + 5, 0.82),
  ];
}

/**
 * @param {import('./types.js').RoomAnalysis} analysis
 * @param {number} requestedCount
 * @param {{ forceCount?: boolean, acceptSuggestedCount?: boolean }} [opts]
 * @returns {import('./types.js').LayoutPlan}
 */
export function buildLayoutPlan(analysis, requestedCount, opts = {}) {
  const requested = clamp(
    Number(requestedCount) || 1,
    1,
    VIRTUAL_TRY_MAX_COUNT,
  );
  const suggested = clamp(
    suggestCountForRoom(analysis),
    1,
    VIRTUAL_TRY_MAX_COUNT,
  );

  let effective = requested;
  if (opts.acceptSuggestedCount) {
    effective = suggested;
  }

  const mismatch = requested !== suggested && !opts.forceCount && !opts.acceptSuggestedCount;
  const roomType = analysis?.roomType || "living";
  const mounts = buildsForType(roomType, effective, analysis);

  return {
    requestedCount: requested,
    suggestedCount: suggested,
    countMismatch: mismatch,
    suggestionReasonAr: mismatch
      ? suggestionReason(requested, suggested, analysis)
      : null,
    mounts,
    roomType,
    fixtureKind: "chandelier",
    products: undefined,
  };
}
