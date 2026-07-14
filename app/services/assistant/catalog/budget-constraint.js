/**
 * Parse customer budget constraints from free text (AR/EN, Eastern digits).
 * Used to hard-filter ENARTE catalog cards so prices never blow past the ask.
 */

const ARABIC_DIGITS = Object.freeze({
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
});

/** Soft slack for "around / بحدود" (relative). */
const APPROX_SLACK = 0.12;
/** Tiny slack for exact "ب 150" / under (currency rounding). */
const HARD_SLACK = 0.02;

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeBudgetText(text) {
  return String(text || "")
    .replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] || d)
    .toLowerCase()
    .replace(/[٫،]/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a budget ceiling from customer wording.
 * @returns {{ max: number, mode: "approx"|"hard" } | null}
 */
export function extractBudgetConstraint(text = "") {
  const raw = normalizeBudgetText(text);
  if (!raw) return null;

  /** @type {{ max: number, mode: "approx"|"hard", priority: number }[]} */
  const hits = [];

  const push = (n, mode, priority) => {
    const max = Number(n);
    if (!Number.isFinite(max) || max < 20 || max > 20000) return;
    hits.push({ max, mode, priority });
  };

  // Soft / around
  for (const m of raw.matchAll(
    /(?:بحدود|حوالي|تقريبا|تقريبًا|around|about|approx(?:imately)?|near)\s*(?:of\s*)?(\d+(?:\.\d+)?)/gi,
  )) {
    push(m[1], "approx", 3);
  }

  // Hard ceiling words
  for (const m of raw.matchAll(
    /(?:أقل\s*من|اقل\s*من|تحت|بحد\s*أقصى|بحد\s*اقصى|upper\s*limit|max(?:imum)?|under|upto|up\s*to|no\s*more\s*than|not\s*more\s*than|below)\s*(?:of\s*)?(\d+(?:\.\d+)?)/gi,
  )) {
    push(m[1], "hard", 4);
  }

  // Budget / price / دينار after number or before
  for (const m of raw.matchAll(
    /(?:ميزانية|budget|بسعر|سعر|price)\s*(?:يصل\s*)?(?:إلى|الى|to|:)?\s*(\d+(?:\.\d+)?)/gi,
  )) {
    push(m[1], "hard", 3);
  }
  for (const m of raw.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:دينار|د\.?\s*ا|jod|j\.?d\.?)/gi,
  )) {
    push(m[1], "hard", 2);
  }

  // Colloquial "ثريا ب 150" / "chandelier for 150"
  for (const m of raw.matchAll(
    /(?:ب|بـ|for|at)\s*(\d+(?:\.\d+)?)(?!\s*(?:سم|cm|م|m\b|وatte|w\b|ليد|ذر|ذرا))/gi,
  )) {
    push(m[1], "hard", 2);
  }

  if (!hits.length) return null;

  hits.sort((a, b) => b.priority - a.priority || a.max - b.max);
  const best = hits[0];
  return Object.freeze({ max: best.max, mode: best.mode });
}

/**
 * Resolve numeric product price (JOD).
 * @param {object} product
 * @returns {number|null}
 */
export function productPriceAmount(product) {
  if (Number.isFinite(product?.priceAmount)) return Number(product.priceAmount);
  const n = Number.parseFloat(
    String(product?.price ?? "")
      .replace(/,/g, "")
      .replace(/[^\d.]/g, ""),
  );
  return Number.isFinite(n) ? n : null;
}

/**
 * Ceiling including mode slack.
 * @param {number} max
 * @param {"approx"|"hard"} [mode]
 */
export function budgetCeiling(max, mode = "hard") {
  const base = Number(max);
  if (!Number.isFinite(base) || base <= 0) return null;
  const slack = mode === "approx" ? APPROX_SLACK : HARD_SLACK;
  return base * (1 + slack);
}

/**
 * @param {object} product
 * @param {{ max: number, mode?: "approx"|"hard" }|null} constraint
 */
export function isProductWithinBudget(product, constraint) {
  if (!constraint?.max) return true;
  const price = productPriceAmount(product);
  if (price == null) return true;
  const ceiling = budgetCeiling(constraint.max, constraint.mode || "hard");
  return ceiling == null ? true : price <= ceiling;
}

/**
 * Build constraint from message + describeSlots / artifacts.
 * @param {string} message
 * @param {object} [artifacts]
 */
export function resolveBudgetConstraint(message = "", artifacts = {}) {
  const fromMessage = extractBudgetConstraint(message);
  const slots = artifacts.describeSlots || {};
  const slotMax = Number.parseFloat(
    String(artifacts.maxPrice || slots.maxPrice || "").trim(),
  );
  const slotMode =
    artifacts.budgetMode === "approx" || slots.budgetMode === "approx"
      ? "approx"
      : "hard";

  if (fromMessage) return fromMessage;
  if (Number.isFinite(slotMax) && slotMax >= 20) {
    return Object.freeze({ max: slotMax, mode: slotMode });
  }
  return null;
}

export { APPROX_SLACK, HARD_SLACK };
