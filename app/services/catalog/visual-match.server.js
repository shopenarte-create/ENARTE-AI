/**
 * Shopify catalog visual match — classical fingerprints (no AI).
 * Full active catalog · all product images · higher-res fingerprints · ranked results.
 */

import sharp from "sharp";
import { loadEnarteCatalogForVisualSearch } from "../shopify-products.server.js";
import {
  extractProductAttributes,
  describeAttributeReasons,
} from "./product-attributes.js";

const FINGERPRINT_VERSION = "v6-full-catalog";
/** Keep more spatial detail than the old 32×32 path. */
const FINGERPRINT_SIZE = 96;
const HASH_SIZE = 16;
const HIST_BINS = 12;
const GRID = 3;
const FINGERPRINT_TTL_MS = 12 * 60 * 60 * 1000;
const URL_FP_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const CONCURRENCY = 20;
/** Images fetched from Shopify CDN for fingerprinting. */
const CDN_IMAGE_SIZE = 320;
const MAX_IMAGES_PER_PRODUCT = 8;
const MAX_MATCHES = 8;

/**
 * Soft floor after ranking the full catalog.
 * Below this, matches are noise (random room photo vs studio product).
 * Above this, return the best ranked products — even if not near-exact.
 */
/** Reject weak studio-shot collisions; prefer empty → sourcing over junk. */
const MIN_SCORE_REASONABLE = 0.58;
const MIN_SCORE_NEAR = 0.72;
/** Drop the pack if the leader is not clearly ahead of #2. */
const MIN_SCORE_GAP = 0.035;

/** @type {Map<string, { expires: number, items: Array }>} */
const fingerprintCache = new Map();
/** @type {Map<string, Promise<Array>>} */
const fingerprintInflight = new Map();
/** @type {Map<string, { expires: number, fp: object }>} */
const urlFingerprintCache = new Map();

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function tinyImageUrl(url, size = CDN_IMAGE_SIZE) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("width", String(size));
    u.searchParams.set("height", String(size));
    u.searchParams.set("crop", "center");
    return u.toString();
  } catch {
    return url;
  }
}

function emptyHist() {
  return {
    r: new Array(HIST_BINS).fill(0),
    g: new Array(HIST_BINS).fill(0),
    b: new Array(HIST_BINS).fill(0),
  };
}

function normHist(hist, count) {
  const n = Math.max(1, count);
  return {
    r: hist.r.map((v) => v / n),
    g: hist.g.map((v) => v / n),
    b: hist.b.map((v) => v / n),
  };
}

function addPixel(hist, r, g, b) {
  hist.r[Math.min(HIST_BINS - 1, (r * HIST_BINS) >> 8)] += 1;
  hist.g[Math.min(HIST_BINS - 1, (g * HIST_BINS) >> 8)] += 1;
  hist.b[Math.min(HIST_BINS - 1, (b * HIST_BINS) >> 8)] += 1;
}

function histDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function histSimilarity(a, b) {
  const dist =
    (histDistance(a.r, b.r) + histDistance(a.g, b.g) + histDistance(a.b, b.b)) /
    3;
  return clamp01(1 - dist);
}

function fingerprintFromRgb(rgb, width, height) {
  const global = emptyHist();
  const cells = Array.from({ length: GRID * GRID }, () => emptyHist());
  const cellCounts = new Array(GRID * GRID).fill(0);
  let sumLuma = 0;
  let edgeScore = 0;
  let centerLuma = 0;
  let centerCount = 0;
  const gray = new Float32Array(width * height);
  const pixels = width * height;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const o = i * 3;
      const r = rgb[o];
      const g = rgb[o + 1];
      const b = rgb[o + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i] = luma;
      sumLuma += luma;
      addPixel(global, r, g, b);

      const cx = Math.min(GRID - 1, Math.floor((x * GRID) / width));
      const cy = Math.min(GRID - 1, Math.floor((y * GRID) / height));
      const cell = cy * GRID + cx;
      addPixel(cells[cell], r, g, b);
      cellCounts[cell] += 1;

      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      if (nx > 0.22 && nx < 0.78 && ny > 0.14 && ny < 0.86) {
        centerLuma += luma;
        centerCount += 1;
      }

      if (x < width - 1) {
        const o2 = (i + 1) * 3;
        edgeScore +=
          Math.abs(r - rgb[o2]) +
          Math.abs(g - rgb[o2 + 1]) +
          Math.abs(b - rgb[o2 + 2]);
      }
      if (y < height - 1) {
        const o3 = (i + width) * 3;
        edgeScore +=
          Math.abs(r - rgb[o3]) +
          Math.abs(g - rgb[o3 + 1]) +
          Math.abs(b - rgb[o3 + 2]);
      }
    }
  }

  const stepX = width / HASH_SIZE;
  const stepY = height / HASH_SIZE;
  const hashSamples = new Float32Array(HASH_SIZE * HASH_SIZE);
  let hashSum = 0;
  for (let hy = 0; hy < HASH_SIZE; hy += 1) {
    for (let hx = 0; hx < HASH_SIZE; hx += 1) {
      const sx = Math.min(width - 1, Math.floor((hx + 0.5) * stepX));
      const sy = Math.min(height - 1, Math.floor((hy + 0.5) * stepY));
      const v = gray[sy * width + sx];
      hashSamples[hy * HASH_SIZE + hx] = v;
      hashSum += v;
    }
  }
  const hashMean = hashSum / hashSamples.length;
  let hashBits = 0n;
  for (let i = 0; i < hashSamples.length; i += 1) {
    if (hashSamples[i] >= hashMean) {
      hashBits |= 1n << BigInt(i);
    }
  }

  return {
    version: FINGERPRINT_VERSION,
    hist: normHist(global, pixels),
    cells: cells.map((cell, idx) => normHist(cell, cellCounts[idx] || 1)),
    luma: sumLuma / (pixels * 255),
    centerLuma: centerLuma / (Math.max(1, centerCount) * 255),
    edge: edgeScore / (pixels * 255 * 6),
    hash: hashBits.toString(16),
  };
}

async function fingerprintFromBuffer(buffer) {
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(FINGERPRINT_SIZE, FINGERPRINT_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return fingerprintFromRgb(data, info.width, info.height);
}

function hammingSimilarity(hexA, hexB) {
  try {
    let x = BigInt(`0x${hexA}`) ^ BigInt(`0x${hexB}`);
    let dist = 0;
    const bits = HASH_SIZE * HASH_SIZE;
    while (x > 0n) {
      dist += Number(x & 1n);
      x >>= 1n;
    }
    return clamp01(1 - dist / bits);
  } catch {
    return 0;
  }
}

export function similarity(a, b) {
  if (!a || !b) return 0;
  const color = histSimilarity(a.hist, b.hist);
  let grid = 0;
  const n = Math.min(a.cells?.length || 0, b.cells?.length || 0) || 1;
  for (let i = 0; i < n; i += 1) {
    grid += histSimilarity(a.cells[i], b.cells[i]);
  }
  grid /= n;
  const hash = hammingSimilarity(a.hash, b.hash);
  const luma = 1 - Math.abs(a.luma - b.luma);
  const center = 1 - Math.abs(a.centerLuma - b.centerLuma);
  const edge = 1 - Math.abs(a.edge - b.edge);

  return clamp01(
    color * 0.28 +
      grid * 0.32 +
      hash * 0.26 +
      luma * 0.05 +
      center * 0.05 +
      edge * 0.04,
  );
}

async function mapPool(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await mapper(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function fingerprintProductImage(url) {
  if (!url) return null;
  const cacheKey = `${FINGERPRINT_VERSION}:${url}`;
  const cached = urlFingerprintCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.fp;
  }

  try {
    const response = await fetch(tinyImageUrl(url), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const fp = await fingerprintFromBuffer(buffer);
    urlFingerprintCache.set(cacheKey, {
      fp,
      expires: Date.now() + URL_FP_TTL_MS,
    });
    return fp;
  } catch {
    return null;
  }
}

function productImageList(product) {
  const list = [];
  const push = (url) => {
    const value = String(url || "").trim();
    if (!value || list.includes(value)) return;
    list.push(value);
  };
  if (Array.isArray(product?.images)) {
    for (const url of product.images) push(url);
  }
  push(product?.image);
  return list.slice(0, MAX_IMAGES_PER_PRODUCT);
}

async function buildCatalogFingerprints(shop) {
  const catalog = await loadEnarteCatalogForVisualSearch({ shop });
  const products = catalog.products || [];

  const part = await mapPool(products, CONCURRENCY, async (product) => {
    const urls = productImageList(product);
    if (!urls.length) return null;

    const fingerprints = [];
    for (const url of urls) {
      const fp = await fingerprintProductImage(url);
      if (fp) fingerprints.push(fp);
    }
    if (!fingerprints.length) return null;

    const attributes = extractProductAttributes(product);
    return {
      product: { ...product, attributes },
      fingerprints,
      attributes,
    };
  });

  return part.filter(Boolean);
}

async function getCatalogFingerprints(shop) {
  const key = `${FINGERPRINT_VERSION}:${String(shop || "default").toLowerCase()}`;
  const cached = fingerprintCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.items;
  }
  if (fingerprintInflight.has(key)) {
    return fingerprintInflight.get(key);
  }

  const pending = buildCatalogFingerprints(shop)
    .then((items) => {
      fingerprintCache.set(key, {
        expires: Date.now() + FINGERPRINT_TTL_MS,
        items,
      });
      fingerprintInflight.delete(key);
      return items;
    })
    .catch((error) => {
      fingerprintInflight.delete(key);
      throw error;
    });

  fingerprintInflight.set(key, pending);
  return pending;
}

/** Fire-and-forget warm so the first customer search is fast. */
export function warmCatalogFingerprints(shop = null) {
  return getCatalogFingerprints(shop).catch((error) => {
    console.warn(
      "[enarte] visual fingerprint warm failed",
      error?.message || error,
    );
    return null;
  });
}

function bestImageScore(queryFp, fingerprints = []) {
  let best = 0;
  for (const fp of fingerprints) {
    const score = similarity(queryFp, fp);
    if (score > best) best = score;
  }
  return best;
}

/**
 * @param {object} options
 * @param {Buffer} options.imageBuffer
 * @param {string} [options.shop]
 * @param {number} [options.limit]
 */
export async function searchCatalogByImage({
  imageBuffer,
  shop = null,
  limit = MAX_MATCHES,
} = {}) {
  if (!imageBuffer?.length) {
    return {
      ok: false,
      error: "missing_image",
      products: [],
    };
  }

  const queryFp = await fingerprintFromBuffer(imageBuffer);
  const catalog = await getCatalogFingerprints(shop);

  if (!catalog.length) {
    return {
      ok: true,
      products: [],
      count: 0,
      note: "empty_catalog",
      unavailable: true,
      engine: "shopify-fingerprint-v6",
    };
  }

  // Score every product by its best matching image, then rank descending.
  const scored = catalog
    .map(({ product, fingerprints, attributes }) => ({
      product,
      attributes:
        attributes || product.attributes || extractProductAttributes(product),
      score: bestImageScore(queryFp, fingerprints),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.score || 0;
  const topLimit = Math.max(1, Math.min(limit || MAX_MATCHES, MAX_MATCHES));

  // No reasonable visual signal after full-catalog ranking → WhatsApp card.
  if (best < MIN_SCORE_REASONABLE) {
    return {
      ok: true,
      products: [],
      count: 0,
      note: "no_similar_match",
      unavailable: true,
      bestScore: Math.round(best * 1000) / 1000,
      searchedProducts: catalog.length,
      engine: "shopify-fingerprint-v6",
      shop: shop || null,
    };
  }

  const second = scored[1]?.score ?? 0;
  // Flat top scores ≈ background collision, not a real match.
  if (second > 0 && best - second < MIN_SCORE_GAP && best < MIN_SCORE_NEAR) {
    return {
      ok: true,
      products: [],
      count: 0,
      note: "ambiguous_visual_match",
      unavailable: true,
      bestScore: Math.round(best * 1000) / 1000,
      searchedProducts: catalog.length,
      engine: "shopify-fingerprint-v6",
      shop: shop || null,
    };
  }

  const ranked = scored
    .filter((row) => best - row.score <= 0.12)
    .slice(0, topLimit);

  return {
    ok: true,
    products: ranked.map(({ product, score, attributes }, index) => {
      const attrBits = describeAttributeReasons(
        attributes?.type ? [`type:${attributes.type}`] : [],
        "ar",
      );
      const visualBit =
        score >= MIN_SCORE_NEAR
          ? "مطابقة بصرية قريبة"
          : "أفضل تطابق بصري من الكتالوج";
      const reasonBits = [visualBit, ...attrBits].filter(Boolean).slice(0, 3);

      return {
        id: product.id,
        title: product.title,
        price: product.price,
        currency: product.currency,
        image: product.image,
        url: product.url,
        collection: product.collection,
        handle: product.handle,
        score: Math.round(score * 1000) / 1000,
        rank: index + 1,
        matchReason: reasonBits.join(" · "),
        attributes: {
          type: attributes?.type || null,
          shape: attributes?.shape || null,
          rings: attributes?.rings ?? null,
          colors: attributes?.colors || [],
          materials: attributes?.materials || [],
          styles: attributes?.styles || [],
          size: attributes?.size || null,
        },
      };
    }),
    count: ranked.length,
    unavailable: false,
    bestScore: Math.round(best * 1000) / 1000,
    searchedProducts: catalog.length,
    engine: "shopify-fingerprint-v6",
    shop: shop || null,
  };
}
