/**
 * Virtual-try domain contracts (brand-agnostic).
 * Fixture kinds reserved for future multi-product support.
 */

/** @typedef {'chandelier'|'spot'|'wall_sconce'|'pendant'|'unknown'} FixtureKind */

/** @typedef {'living'|'dining'|'bedroom'|'hallway'|'unknown'} RoomType */

/**
 * @typedef {object} TrySessionOptions
 * @property {number} count - Requested fixture count (1–5)
 * @property {string} [budgetId]
 * @property {string} [style]
 * @property {object|null} [lockedProduct]
 * @property {boolean} [forceCount] - Keep user count despite suggestion
 * @property {boolean} [acceptSuggestedCount] - Switch to suggested count
 * @property {FixtureKind} [fixtureKind] - reserved (default chandelier)
 */

/**
 * @typedef {object} RoomAnalysis
 * @property {RoomType} roomType
 * @property {string} roomTypeLabelAr
 * @property {string} [style]
 * @property {number|null} areaHintSqm
 * @property {number|null} ceilingHeightM
 * @property {boolean} needsCeilingCleanup
 * @property {boolean} hasExistingFixtures
 * @property {string} summaryAr
 * @property {string} [rawText]
 * @property {{ seating?: object, table?: object, bed?: object, corridor?: object }} [anchors]
 */

/**
 * @typedef {object} MountPoint
 * @property {string} id
 * @property {number} x - 0–100 percent from left
 * @property {number} y - 0–100 percent from top
 * @property {number} scaleRatio - relative size vs primary (1 = full)
 * @property {FixtureKind} [fixtureKind]
 */

/**
 * @typedef {object} LayoutPlan
 * @property {number} requestedCount
 * @property {number} suggestedCount
 * @property {boolean} countMismatch
 * @property {string|null} suggestionReasonAr
 * @property {MountPoint[]} mounts
 * @property {RoomType} roomType
 * @property {FixtureKind} [fixtureKind]
 * @property {object[]} [products] - reserved multi-product
 */

/**
 * @typedef {object} FixtureSpec
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} scaleRatio
 * @property {FixtureKind} fixtureKind
 * @property {object} product
 * @property {string} lightingType
 */

/**
 * @typedef {object} RenderJobMeta
 * @property {RoomAnalysis} [analysis]
 * @property {LayoutPlan} [layout]
 * @property {FixtureSpec[]} [fixtures]
 * @property {string} [phase]
 */

export const VIRTUAL_TRY_MAX_COUNT = 5;

export const FIXTURE_KINDS = Object.freeze([
  "chandelier",
  "pendant",
  "spot",
  "wall_sconce",
  "unknown",
]);

export const ROOM_TYPES = Object.freeze([
  "living",
  "dining",
  "bedroom",
  "hallway",
  "unknown",
]);

export const JOB_STATUS = Object.freeze({
  QUEUED: "queued",
  ANALYZING: "analyzing",
  NEEDS_CONFIRMATION: "needs_confirmation",
  PREPARING: "preparing",
  INSTALLING: "installing",
  DONE: "done",
  ERROR: "error",
});

export const STYLE_OPTIONS = Object.freeze([
  { id: "", labelAr: "تلقائي" },
  { id: "modern", labelAr: "مودرن" },
  { id: "classic", labelAr: "كلاسيك" },
  { id: "luxury", labelAr: "فاخر" },
  { id: "minimal", labelAr: "مينيمال" },
]);

/**
 * Normalize UI "5+" and clamps to 1..MAX.
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeFixtureCount(raw) {
  const text = String(raw ?? "1").trim();
  if (text === "5+" || text === "5plus") return VIRTUAL_TRY_MAX_COUNT;
  const n = Number.parseInt(text, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(VIRTUAL_TRY_MAX_COUNT, n);
}
