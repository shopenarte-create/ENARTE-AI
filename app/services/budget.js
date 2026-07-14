/**
 * Reusable ENARTE budget model (JOD).
 * Used by the analyze API now; later by Shopify product filtering.
 */

export const BUDGET_CURRENCY = "JOD";

export const BUDGET_NO_LIMIT = "no_limit";

/** @typedef {"under_50" | "50_100" | "100_200" | "200_500" | "no_limit"} BudgetId */

/**
 * Canonical budget options for UI + API + future product filters.
 * @type {ReadonlyArray<{ id: BudgetId, labelAr: string, min: number | null, max: number | null }>}
 */
export const BUDGET_OPTIONS = Object.freeze([
  {
    id: "under_50",
    labelAr: "أقل من 50 دينار",
    min: 0,
    max: 50,
  },
  {
    id: "50_100",
    labelAr: "50–100 دينار",
    min: 50,
    max: 100,
  },
  {
    id: "100_200",
    labelAr: "100–200 دينار",
    min: 100,
    max: 200,
  },
  {
    id: "200_500",
    labelAr: "200–500 دينار",
    min: 200,
    max: 500,
  },
  {
    id: BUDGET_NO_LIMIT,
    labelAr: "بدون ميزانية محددة",
    min: null,
    max: null,
  },
]);

const BUDGET_BY_ID = Object.freeze(
  Object.fromEntries(BUDGET_OPTIONS.map((option) => [option.id, option])),
);

export const DEFAULT_BUDGET_ID = BUDGET_NO_LIMIT;

export function isValidBudgetId(value) {
  return typeof value === "string" && Boolean(BUDGET_BY_ID[value]);
}

/**
 * Resolve FormData / UI budget value.
 * Missing / empty → no_limit (optional selector).
 * @returns {{ ok: true, budgetId: BudgetId, explicit: boolean } | { ok: false, error: string }}
 */
export function resolveBudgetInput(rawValue) {
  if (rawValue == null || rawValue === "") {
    return {
      ok: true,
      budgetId: DEFAULT_BUDGET_ID,
      explicit: false,
    };
  }

  const value = String(rawValue).trim();
  if (!value) {
    return {
      ok: true,
      budgetId: DEFAULT_BUDGET_ID,
      explicit: false,
    };
  }

  if (!isValidBudgetId(value)) {
    return {
      ok: false,
      error: "قيمة الميزانية غير صالحة.",
    };
  }

  return {
    ok: true,
    budgetId: /** @type {BudgetId} */ (value),
    explicit: true,
  };
}

/**
 * Structured range for API responses and future Shopify price filters.
 * @param {BudgetId} budgetId
 */
export function getBudgetRange(budgetId) {
  const option = BUDGET_BY_ID[budgetId] || BUDGET_BY_ID[DEFAULT_BUDGET_ID];

  return {
    id: option.id,
    labelAr: option.labelAr,
    currency: BUDGET_CURRENCY,
    min: option.min,
    max: option.max,
    hasLimit: option.id !== BUDGET_NO_LIMIT,
  };
}

export function getBudgetLabelAr(budgetId) {
  return getBudgetRange(budgetId).labelAr;
}

/**
 * Optional Arabic prompt context. Empty when there is no price restriction.
 * @param {BudgetId} budgetId
 */
export function getBudgetPromptContext(budgetId) {
  const range = getBudgetRange(budgetId);
  if (!range.hasLimit) {
    return "";
  }

  return `
ميزانية العميل (اختياري — للتوجيه فقط، لا تغيّر هيكل الإجابة):
${range.labelAr} (${range.currency}).
راعِ هذه الميزانية عند اقتراح شكل وحجم الثريا إن أمكن، دون إضافة بنود جديدة خارج القائمة المطلوبة.
`.trim();
}

/**
 * True when the customer explicitly picked a budget in the UI
 * (not the automatic no_limit default).
 */
export function wasBudgetExplicitlySelected(rawValue) {
  if (rawValue == null || rawValue === "") {
    return false;
  }
  const value = String(rawValue).trim();
  return isValidBudgetId(value);
}

/**
 * Whether a numeric price falls inside a budget range (JOD).
 * @param {number} price
 * @param {{ hasLimit: boolean, min: number | null, max: number | null }} budgetRange
 */
export function isPriceInBudget(price, budgetRange) {
  if (!budgetRange || !budgetRange.hasLimit) {
    return true;
  }

  const amount = Number(price);
  if (!Number.isFinite(amount)) {
    return false;
  }

  const min = budgetRange.min == null ? 0 : Number(budgetRange.min);
  const max = budgetRange.max == null ? Number.POSITIVE_INFINITY : Number(budgetRange.max);

  // under_50: 0–50 inclusive; ranges are inclusive on both ends
  return amount >= min && amount <= max;
}

/**
 * Distance from a price to a budget band (0 = inside the band).
 * Used when no in-budget products exist so we can fall back to closest prices.
 */
export function getBudgetPriceDistance(price, budgetRange) {
  if (!budgetRange || !budgetRange.hasLimit) {
    return 0;
  }

  const amount = Number(price);
  if (!Number.isFinite(amount)) {
    return Number.POSITIVE_INFINITY;
  }

  const min = budgetRange.min == null ? 0 : Number(budgetRange.min);
  const max =
    budgetRange.max == null ? Number.POSITIVE_INFINITY : Number(budgetRange.max);

  if (amount < min) {
    return min - amount;
  }
  if (Number.isFinite(max) && amount > max) {
    return amount - max;
  }
  return 0;
}

/**
 * Prefer products inside the budget; otherwise sort by closest price to the band.
 * @template {{ priceAmount?: number|null }} T
 * @param {T[]} products
 * @param {{ hasLimit: boolean, min: number | null, max: number | null }} budgetRange
 * @returns {{ products: T[], usedBudgetFallback: boolean }}
 */
export function selectProductsForBudget(products, budgetRange) {
  const list = Array.isArray(products) ? products : [];
  if (!budgetRange?.hasLimit) {
    return { products: list, usedBudgetFallback: false };
  }

  const inBudget = list.filter((product) =>
    isPriceInBudget(product.priceAmount, budgetRange),
  );
  if (inBudget.length > 0) {
    return { products: inBudget, usedBudgetFallback: false };
  }

  const closest = [...list].sort((a, b) => {
    const da = getBudgetPriceDistance(a.priceAmount, budgetRange);
    const db = getBudgetPriceDistance(b.priceAmount, budgetRange);
    if (da !== db) {
      return da - db;
    }
    const pa = Number(a.priceAmount);
    const pb = Number(b.priceAmount);
    const safeA = Number.isFinite(pa) ? pa : Number.POSITIVE_INFINITY;
    const safeB = Number.isFinite(pb) ? pb : Number.POSITIVE_INFINITY;
    return safeA - safeB;
  });

  return { products: closest, usedBudgetFallback: true };
}
