/**
 * Catalog search query parsing + ranking (no LLM).
 * Ranks by real similarity: type, shape, rings/arms, color, material, style, size.
 * Never dumps unrelated catalog products.
 */

import {
  extractProductAttributes,
  extractQueryAttributes,
  scoreAttributeOverlap,
  describeAttributeReasons,
} from "../../catalog/product-attributes.js";
import {
  isProductWithinBudget,
  resolveBudgetConstraint,
} from "./budget-constraint.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "in",
  "on",
  "to",
  "of",
  "من",
  "في",
  "على",
  "عن",
  "أو",
  "و",
  "ابحث",
  "أبحث",
  "بحث",
  "أريد",
  "ابي",
  "أبي",
  "looking",
  "find",
  "search",
  "want",
  "please",
  "show",
  "me",
  "product",
  "products",
  "منتج",
  "منتجات",
]);

export const SEARCH_CONFIG = Object.freeze({
  /** Prefer fewer, closer matches over a long weak list. */
  topN: 4,
  exactMinScore: 48,
  rankedMinScore: 30,
  similarMinScore: 22,
  /** Drop anything far below the best hit. */
  maxScoreGapFromBest: 18,
  locale: "ar",
});

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Build a structured search query from message + optional artifacts.
 */
export function parseProductSearchQuery(input = {}) {
  const artifacts = input.artifacts || {};
  const message = String(input.message || input.query || "").trim();

  const name = artifacts.name || artifacts.title || null;
  const category = artifacts.category || artifacts.collection || null;
  const tags = [
    ...(Array.isArray(artifacts.tags) ? artifacts.tags : []),
    ...(typeof artifacts.tag === "string" ? [artifacts.tag] : []),
  ]
    .map((t) => String(t).trim())
    .filter(Boolean);

  const keywords = [
    ...(Array.isArray(artifacts.keywords) ? artifacts.keywords : []),
    ...tokenize(message),
  ]
    .map((k) => normalize(k))
    .filter(Boolean);

  const uniqueKeywords = [...new Set(keywords)].filter((k) => {
    // Drop bare budget numbers so they do not pollute keyword matching.
    if (/^\d+(\.\d+)?$/.test(k)) return false;
    return true;
  });

  const budget = resolveBudgetConstraint(message, artifacts);

  const base = Object.freeze({
    text: message,
    name: name ? normalize(name) : null,
    category: category ? normalize(category) : null,
    keywords: Object.freeze(uniqueKeywords),
    tags: Object.freeze(tags.map((t) => normalize(t))),
    maxPrice: budget?.max ?? null,
    budgetMode: budget?.mode ?? null,
  });

  return Object.freeze({
    ...base,
    attributes: extractQueryAttributes(base),
    budget: budget
      ? Object.freeze({ max: budget.max, mode: budget.mode })
      : null,
  });
}

function scoreProduct(product, query) {
  const title = normalize(product.title);
  const productType = normalize(product.productType);
  const categoryName = normalize(
    product.categoryName || product.categoryFullName || "",
  );
  const collection = normalize(product.collection);
  const tags = (product.tags || []).map((t) => normalize(t));
  const haystack = [title, productType, categoryName, collection, ...tags].join(
    " ",
  );

  const productAttrs =
    product.attributes || extractProductAttributes(product);
  const attr = scoreAttributeOverlap(query.attributes, productAttrs);

  // Hard gate: if the customer named a fixture type, never return a
  // different incompatible type (e.g. wall sconce for "chandelier").
  if (query.attributes?.type && !attr.typeOk) {
    return Object.freeze({
      product,
      score: 0,
      reasons: Object.freeze(["type:rejected"]),
      attributes: productAttrs,
    });
  }

  let score = attr.score;
  const reasons = [...attr.reasons];

  if (query.name) {
    if (title === query.name) {
      score += 50;
      reasons.push("exact_title");
    } else if (title.includes(query.name)) {
      score += 22;
      reasons.push("title_contains_name");
    }
  }

  if (query.category) {
    if (
      collection.includes(query.category) ||
      categoryName.includes(query.category) ||
      productType.includes(query.category)
    ) {
      score += 12;
      reasons.push("category_match");
    }
  }

  for (const tag of query.tags) {
    if (tags.some((t) => t === tag || t.includes(tag) || tag.includes(t))) {
      score += 8;
      reasons.push(`tag:${tag}`);
    }
  }

  // Residual keywords — avoid double-counting attribute tokens already scored.
  const attributedTokens = new Set(
    [
      query.attributes?.type,
      query.attributes?.shape,
      query.attributes?.size,
      ...(query.attributes?.colors || []),
      ...(query.attributes?.materials || []),
      ...(query.attributes?.styles || []),
    ]
      .filter(Boolean)
      .map(normalize),
  );

  for (const keyword of query.keywords) {
    if (attributedTokens.has(keyword)) continue;
    // Skip pure type synonyms already handled via attributes.
    if (keyword.length < 2) continue;

    if (title === keyword) {
      score += 14;
      reasons.push(`keyword_exact_title:${keyword}`);
    } else if (title.includes(keyword)) {
      score += 8;
      reasons.push(`keyword_title:${keyword}`);
    } else if (tags.some((t) => t.includes(keyword))) {
      score += 5;
      reasons.push(`keyword_tag:${keyword}`);
    } else if (haystack.includes(keyword)) {
      score += 3;
      reasons.push(`keyword_field:${keyword}`);
    }
  }

  const wantsGarage = query.keywords.some((k) =>
    ["garage", "كراج", "كراجي"].includes(k),
  );
  if (wantsGarage) {
    const outdoorish =
      productAttrs.type === "outdoor" ||
      tags.some(
        (t) =>
          t.includes("outdoor") ||
          t.includes("weather") ||
          t.includes("ip65") ||
          t.includes("خارج"),
      );
    if (outdoorish) {
      score += 14;
      reasons.push("garage_outdoor_boost");
    }
  }

  // Require at least one meaningful attribute or title signal —
  // prevents "any lighting product" from matching empty/weak queries.
  const hasSignal =
    attr.reasons.some((r) => !r.includes("mismatch") && r !== "type:rejected") ||
    reasons.some(
      (r) =>
        r.startsWith("exact_title") ||
        r.startsWith("title_contains") ||
        r.startsWith("keyword_") ||
        r.startsWith("tag:") ||
        r === "category_match" ||
        r === "garage_outdoor_boost",
    );

  if (!hasSignal || score <= 0) {
    return Object.freeze({
      product,
      score: 0,
      reasons: Object.freeze(reasons),
      attributes: productAttrs,
    });
  }

  return Object.freeze({
    product,
    score,
    reasons: Object.freeze(reasons),
    attributes: productAttrs,
  });
}

/**
 * Rank ENARTE catalog products for a search query.
 * @returns {{ mode: string, results: object[] }}
 */
export function rankCatalogProducts(products, query, config = {}) {
  const cfg = { ...SEARCH_CONFIG, ...config };
  const q =
    query?.attributes != null
      ? query
      : parseProductSearchQuery({
          message: query?.text || "",
          artifacts: {
            name: query?.name,
            category: query?.category,
            keywords: query?.keywords,
            tags: query?.tags,
          },
        });

  const budget = q.budget || null;

  const scored = (products || [])
    .filter((product) => isProductWithinBudget(product, budget))
    .map((product) => scoreProduct(product, q))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return Object.freeze({
      mode: "none",
      results: Object.freeze([]),
    });
  }

  const best = scored[0].score;
  let mode = "ranked";
  let filtered = scored.filter((row) => row.score >= cfg.rankedMinScore);

  if (best >= cfg.exactMinScore) {
    mode = "exact";
    filtered = scored.filter((row) => row.score >= cfg.exactMinScore);
  } else if (best >= cfg.rankedMinScore) {
    mode = "ranked";
  } else if (best >= cfg.similarMinScore) {
    mode = "similar";
    filtered = scored.filter((row) => row.score >= cfg.similarMinScore);
  } else {
    return Object.freeze({
      mode: "none",
      results: Object.freeze([]),
    });
  }

  const gap = Number(cfg.maxScoreGapFromBest) || 18;
  filtered = filtered.filter((row) => best - row.score <= gap);

  const top = filtered.slice(0, cfg.topN).map((row, index) =>
    Object.freeze({
      ...row,
      matchType:
        mode === "exact" ? "exact" : mode === "similar" ? "similar" : "ranked",
      rank: index + 1,
      matchReason: humanMatchReason(row.reasons, mode, cfg.locale),
    }),
  );

  return Object.freeze({
    mode,
    results: Object.freeze(top),
  });
}

function humanMatchReason(reasons = [], mode = "ranked", locale = "ar") {
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  const attrBits = describeAttributeReasons(reasons, locale);
  const set = new Set(reasons || []);
  const bits = [...attrBits];

  if (set.has("exact_title") || [...set].some((r) => r.startsWith("keyword_exact"))) {
    bits.unshift(useEn ? "exact title match" : "مطابقة مباشرة للاسم");
  }
  if (set.has("category_match") && !bits.some((b) => /نوع|type/i.test(b))) {
    bits.push(useEn ? "same lighting category" : "نفس فئة الإضاءة");
  }
  if (set.has("garage_outdoor_boost")) {
    bits.push(useEn ? "outdoor / garage-ready" : "مناسب للخارج / الكراج");
  }

  if (!bits.length) {
    return mode === "similar"
      ? useEn
        ? "Closest ENARTE alternative by type and look"
        : "أقرب بديل في ENARTE من حيث النوع والشكل"
      : useEn
        ? "Strong catalog match for your needs"
        : "مطابقة قوية لما طلبت";
  }

  const prefix =
    mode === "similar"
      ? useEn
        ? "Closest alternative — "
        : "أقرب بديل — "
      : "";

  return prefix + bits.slice(0, 3).join(useEn ? " · " : " · ");
}
