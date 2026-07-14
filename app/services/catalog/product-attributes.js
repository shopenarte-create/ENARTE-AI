/**
 * Structured lighting attributes inferred from title / type / tags / category.
 * Used by text ranking and visual closest-match filtering.
 * No metafields required — parse catalog text that merchants already publish.
 */

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blobOf(product = {}) {
  const tags = Array.isArray(product.tags) ? product.tags.join(" ") : "";
  return normalize(
    [
      product.title,
      product.handle,
      product.productType,
      product.categoryName,
      product.categoryFullName,
      product.collection,
      tags,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** First vocabulary key whose tokens all appear OR any token appears (anyMatch). */
function matchVocab(text, vocab, { requireAll = false } = {}) {
  for (const [key, tokens] of Object.entries(vocab)) {
    const list = tokens.map(normalize).filter(Boolean);
    if (!list.length) continue;
    if (requireAll) {
      if (list.every((t) => text.includes(t))) return key;
    } else if (list.some((t) => text.includes(t))) {
      return key;
    }
  }
  return null;
}

function matchAllVocab(text, vocab) {
  const hits = [];
  for (const [key, tokens] of Object.entries(vocab)) {
    if (tokens.some((t) => text.includes(normalize(t)))) {
      hits.push(key);
    }
  }
  return hits;
}

const TYPE_VOCAB = {
  chandelier: [
    "chandelier",
    "chandeliers",
    "ثريا",
    "ثريات",
    "ثرية",
  ],
  pendant: [
    "pendant",
    "pendants",
    "معلق",
    "معلقات",
    "hanging light",
    "led pendant",
  ],
  sconce: [
    "sconce",
    "wall light",
    "wall lamp",
    "ابليك",
    "إضاءة جدارية",
    "اضاءة جدارية",
    "جداري",
  ],
  spot: ["spotlight", "spot light", "سبوت", "كاشف", "أضواء كاشفة"],
  track: [
    "magnetic track",
    "track light",
    "profile",
    "سكك",
    "مغناطيس",
    "بروفايل",
  ],
  floor: ["floor lamp", "ستاند لامب", "stand lamp", "ستاند"],
  table: ["table lamp", "تيبل لامب", "table light"],
  outdoor: [
    "outdoor",
    "garden",
    "حديقة",
    "خارجي",
    "كراج",
    "garage",
    "weather",
    "ip65",
  ],
  ceiling: ["flush", "ceiling light", "سقفي", "ملاصق"],
  fan: ["ceiling fan", "fan light", "مروحة", "مراوح"],
};

const SHAPE_VOCAB = {
  round: ["round", "circular", "circle", "دائر", "ring", "حلق"],
  linear: [
    "linear",
    "line",
    "مستطيل",
    "rectangular",
    "bar",
    "straight",
    "خطي",
  ],
  cascade: ["cascade", "waterfall", "tier", "متدرج", "طبقات", "layered"],
  orb: ["orb", "sphere", "globo", "كرة", "ball"],
  square: ["square", "مربع", "cube"],
  branch: ["branch", "arm", "ذراع", "branching", "tree"],
  spiral: ["spiral", "helix", "لولب"],
};

const COLOR_VOCAB = {
  gold: ["gold", "golden", "ذهبي", "ذهب", "champagne gold"],
  black: ["black", "أسود", "اسود", "matte black"],
  white: ["white", "أبيض", "ابيض"],
  chrome: ["chrome", "كروم", "polished chrome"],
  brass: ["brass", "براس", "نحاسي", "نحاس أصفر"],
  bronze: ["bronze", "برونز"],
  silver: ["silver", "فضي", "nickel", "نيكل"],
  copper: ["copper", "نحاسي أحمر"],
  wood: ["wood", "wooden", "خشب", "oak", "walnut"],
  marble: ["marble", "رخام", "ماربيل"],
  clear: ["clear", "transparent", "شفاف"],
};

const MATERIAL_VOCAB = {
  crystal: ["crystal", "كريستال", "glass crystal"],
  glass: ["glass", "زجاج", "acrylic"],
  metal: ["metal", "معدن", "iron", "steel", "حديد", "ستانلس"],
  brass: ["brass", "براس", "نحاسي"],
  wood: ["wood", "wooden", "خشب"],
  marble: ["marble", "رخام", "ماربيل"],
  fabric: ["fabric", "shade", "قماش", "نسيج"],
};

const STYLE_VOCAB = {
  modern: ["modern", "مودرن", "contemporary", "عصري", "minimal", "مينيمال"],
  classic: ["classic", "كلاسيك", "traditional", "تقليدي"],
  crystal: ["crystal", "كريستال"],
  luxury: ["luxury", "فاخر", "premium", "deluxe"],
  industrial: ["industrial", "صناعي", "loft"],
  art_deco: ["art deco", "artdeco", "آرت ديكو"],
  led: ["led", "ليد"],
};

const SIZE_VOCAB = {
  small: ["small", "صغير", "compact", "mini"],
  medium: ["medium", "متوسط", "mid size"],
  large: ["large", "كبير", "oversized", "xl", "xxl"],
};

/**
 * Ring / arm count from free text.
 * @returns {number|null}
 */
export function extractRingOrArmCount(text) {
  const t = normalize(text);
  if (!t) return null;

  const patterns = [
    /(\d+)\s*(?:ring|rings|حلقة|حلقات|حلقه)/u,
    /(\d+)\s*(?:arm|arms|ذراع|أذرع|ذرعان)/u,
    /(\d+)\s*(?:tier|tiers|طبقة|طبقات)/u,
    /(\d+)\s*(?:light|lights|لمبة|لمبات|نقطة|نقاط)/u,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 50) return n;
    }
  }

  if (/\b(triple|ثلاث|٣)\b/u.test(t)) return 3;
  if (/\b(double|dual|ثنائي|زوج|٢)\b/u.test(t)) return 2;
  if (/\b(single|واحد|١)\b/u.test(t) && /(ring|arm|حلقة|ذراع)/u.test(t)) {
    return 1;
  }
  return null;
}

/**
 * Approximate size band from cm / diameter mentions.
 * @returns {"small"|"medium"|"large"|null}
 */
function extractSizeFromDimensions(text) {
  const t = normalize(text);
  const cm = t.match(/(\d{2,3})\s*cm/);
  if (cm) {
    const n = Number(cm[1]);
    if (n <= 40) return "small";
    if (n <= 70) return "medium";
    return "large";
  }
  return matchVocab(t, SIZE_VOCAB);
}

/**
 * @param {object|string} source product record or free-text query
 * @returns {{
 *   type: string|null,
 *   shape: string|null,
 *   rings: number|null,
 *   colors: string[],
 *   materials: string[],
 *   styles: string[],
 *   size: string|null,
 *   blob: string
 * }}
 */
export function extractProductAttributes(source = {}) {
  const text =
    typeof source === "string"
      ? normalize(source)
      : blobOf(source);

  let type = matchVocab(text, TYPE_VOCAB);
  // Collection hints when title is vague.
  if (!type && typeof source === "object") {
    const coll = normalize(source.collection);
    if (coll.includes("chandelier")) type = "chandelier";
    else if (coll.includes("pendant")) type = "pendant";
  }

  return Object.freeze({
    type,
    shape: matchVocab(text, SHAPE_VOCAB),
    rings: extractRingOrArmCount(text),
    colors: Object.freeze(matchAllVocab(text, COLOR_VOCAB)),
    materials: Object.freeze(matchAllVocab(text, MATERIAL_VOCAB)),
    styles: Object.freeze(matchAllVocab(text, STYLE_VOCAB)),
    size: extractSizeFromDimensions(text),
    blob: text,
  });
}

/**
 * Query-side attributes (message + artifacts keywords).
 */
export function extractQueryAttributes(query = {}) {
  const bits = [
    query.text,
    query.name,
    query.category,
    ...(query.keywords || []),
    ...(query.tags || []),
  ]
    .filter(Boolean)
    .join(" ");
  return extractProductAttributes(bits);
}

function listOverlap(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  return a.filter((x) => setB.has(x)).length;
}

/**
 * Compare query attrs vs product attrs.
 * Returns { score, reasons, typeOk }.
 * typeOk=false → product should be excluded when query specifies a type.
 */
export function scoreAttributeOverlap(queryAttrs, productAttrs) {
  let score = 0;
  const reasons = [];
  const q = queryAttrs || {};
  const p = productAttrs || {};

  let typeOk = true;
  if (q.type) {
    if (p.type === q.type) {
      score += 40;
      reasons.push(`type:${q.type}`);
    } else if (
      (q.type === "chandelier" && p.type === "pendant") ||
      (q.type === "pendant" && p.type === "chandelier")
    ) {
      // Closest fixture family only — soft, still marked compatible.
      score += 12;
      reasons.push("type:near_fixture");
      typeOk = true;
    } else {
      typeOk = false;
      reasons.push("type:mismatch");
    }
  } else if (p.type) {
    // Prefer known lighting fixtures when query is style/color-only.
    score += 4;
  }

  if (q.shape && p.shape) {
    if (q.shape === p.shape) {
      score += 18;
      reasons.push(`shape:${q.shape}`);
    } else {
      score -= 6;
      reasons.push("shape:mismatch");
    }
  }

  if (q.rings != null && p.rings != null) {
    const diff = Math.abs(q.rings - p.rings);
    if (diff === 0) {
      score += 22;
      reasons.push(`rings:${p.rings}`);
    } else if (diff === 1) {
      score += 10;
      reasons.push(`rings_near:${p.rings}`);
    } else {
      score -= 8;
      reasons.push("rings:mismatch");
    }
  }

  const colorHits = listOverlap(q.colors, p.colors);
  if (colorHits) {
    score += 16 * colorHits;
    reasons.push(`color:${p.colors.filter((c) => q.colors.includes(c)).join(",")}`);
  } else if (q.colors.length && p.colors.length) {
    score -= 10;
    reasons.push("color:mismatch");
  }

  const materialHits = listOverlap(q.materials, p.materials);
  if (materialHits) {
    score += 14 * materialHits;
    reasons.push(
      `material:${p.materials.filter((m) => q.materials.includes(m)).join(",")}`,
    );
  } else if (q.materials.length && p.materials.length) {
    score -= 6;
    reasons.push("material:mismatch");
  }

  const styleHits = listOverlap(q.styles, p.styles);
  if (styleHits) {
    score += 12 * styleHits;
    reasons.push(
      `style:${p.styles.filter((s) => q.styles.includes(s)).join(",")}`,
    );
  }

  if (q.size && p.size) {
    if (q.size === p.size) {
      score += 10;
      reasons.push(`size:${p.size}`);
    } else {
      score -= 4;
      reasons.push("size:mismatch");
    }
  }

  return Object.freeze({
    score: Math.max(0, score),
    reasons: Object.freeze(reasons),
    typeOk,
  });
}

/**
 * How similar two products are (for visual cluster consistency).
 */
export function productAttributeAgreement(a, b) {
  const left = typeof a?.type === "string" || a?.blob ? a : extractProductAttributes(a);
  const right =
    typeof b?.type === "string" || b?.blob ? b : extractProductAttributes(b);
  return scoreAttributeOverlap(
    {
      type: left.type,
      shape: left.shape,
      rings: left.rings,
      colors: left.colors,
      materials: left.materials,
      styles: left.styles,
      size: left.size,
    },
    right,
  );
}

/**
 * Arabic / English short reasons for UI.
 */
export function describeAttributeReasons(reasons = [], locale = "ar") {
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  const bits = [];
  for (const r of reasons) {
    if (r.startsWith("type:") && !r.includes("mismatch") && !r.includes("near")) {
      bits.push(useEn ? `same type (${r.slice(5)})` : `نفس النوع (${r.slice(5)})`);
    } else if (r === "type:near_fixture") {
      bits.push(useEn ? "closest fixture family" : "أقرب فئة تركيب");
    } else if (r.startsWith("shape:")) {
      bits.push(useEn ? `similar shape` : `شكل مشابه`);
    } else if (r.startsWith("rings:")) {
      bits.push(useEn ? `${r.slice(6)} rings/arms` : `${r.slice(6)} حلقات/أذرع`);
    } else if (r.startsWith("rings_near:")) {
      bits.push(useEn ? "near ring/arm count" : "عدد حلقات قريب");
    } else if (r.startsWith("color:")) {
      bits.push(useEn ? `color: ${r.slice(6)}` : `لون: ${r.slice(6)}`);
    } else if (r.startsWith("material:")) {
      bits.push(useEn ? `material: ${r.slice(9)}` : `خامة: ${r.slice(9)}`);
    } else if (r.startsWith("style:")) {
      bits.push(useEn ? `style: ${r.slice(6)}` : `أسلوب: ${r.slice(6)}`);
    } else if (r.startsWith("size:")) {
      bits.push(useEn ? `size: ${r.slice(5)}` : `حجم: ${r.slice(5)}`);
    }
  }
  return bits;
}
