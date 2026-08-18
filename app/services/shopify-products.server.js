import prisma from "../db.server";
import { Session } from "@shopify/shopify-api";
import { unauthenticated, sessionStorage } from "../shopify.server";
import { getBudgetRange, selectProductsForBudget } from "./budget.js";
import {
  runRecommendationEngine,
  PRODUCT_AI_METAFIELD_NAMESPACE,
  PRODUCT_AI_METAFIELD_KEYS,
} from "./recommendation/index.js";
import {
  normalizeMarkers,
  inferMarkerZoneHint,
  buildVirtualPlacementPlan,
} from "./placement/index.js";

export const TARGET_COLLECTIONS = Object.freeze([
  {
    key: "CHANDELIERS",
    handles: ["chandeliers"],
    titles: ["chandeliers", "CHANDELIERS"],
  },
  {
    key: "LED PENDANTS",
    handles: ["led-pendants", "led_pendants", "ledpendants"],
    titles: ["led pendants", "LED pendants", "LED PENDANTS"],
  },
]);

const PREFERRED_SHOP =
  process.env.ASSISTANT_DEFAULT_SHOP ||
  process.env.SHOP ||
  "jb8xus-wn.myshopify.com";
const PRODUCTS_PER_COLLECTION = 100;
const CATALOG_PAGE_SIZE = 50;
const CATALOG_MAX_PRODUCTS = 250;

/** Once Prisma is unreachable, never wait on it again this process. */
let prismaSessionCircuitOpen = false;

function shouldSkipPrismaSessionLookup() {
  if (prismaSessionCircuitOpen) return true;
  if (String(process.env.ENARTE_MEMORY_SESSION || "").toLowerCase() === "true") {
    return true;
  }
  const url = String(process.env.DATABASE_URL || "");
  return url.includes("localhost:51214") || url.includes("127.0.0.1:51214");
}

function markPrismaSessionUnavailable(error) {
  const message = String(error?.message || error || "");
  if (
    error?.name === "PrismaClientInitializationError" ||
    /can't reach database server|ECONNREFUSED|connect timeout/i.test(message)
  ) {
    prismaSessionCircuitOpen = true;
  }
}

/**
 * Catalog fields for Phase 1 scoring.
 * Phase 2: add metafield aliases under namespace enarte_ai when enrichment ships.
 */
const PRODUCT_NODE_FIELDS = `
  id
  title
  handle
  status
  productType
  tags
  onlineStoreUrl
  category {
    name
    fullName
  }
  featuredImage {
    url
    altText
  }
  images(first: 12) {
    nodes {
      url
    }
  }
  priceRangeV2 {
    minVariantPrice {
      amount
      currencyCode
    }
  }
`;

/**
 * MemorySessionStorage loses OAuth tokens on restart while Prisma may still
 * hold offline sessions. Hydrate so unauthenticated.admin(shop) can succeed.
 */
async function hydrateOfflineSessionIntoStorage(shop) {
  if (!shop || !sessionStorage?.storeSession) return false;
  try {
    const existing = await sessionStorage.findSessionsByShop?.(shop);
    if (Array.isArray(existing) && existing.some((s) => s?.accessToken)) {
      return true;
    }
  } catch {
    // continue — try Prisma only if DB is expected to be up
  }

  if (shouldSkipPrismaSessionLookup()) return false;

  try {
    const row = await prisma.session.findFirst({
      where: {
        isOnline: false,
        shop,
      },
    });
    if (!row?.accessToken) {
      const loose = await prisma.session.findFirst({
        where: {
          isOnline: false,
          shop: { contains: String(shop).split(".")[0] },
        },
      });
      if (!loose?.accessToken) return false;
      const session = new Session({
        id: loose.id,
        shop: loose.shop,
        state: loose.state || "",
        isOnline: false,
        scope: loose.scope || undefined,
        expires: loose.expires || undefined,
        accessToken: loose.accessToken,
        refreshToken: loose.refreshToken || undefined,
        refreshTokenExpires: loose.refreshTokenExpires || undefined,
      });
      await sessionStorage.storeSession(session);
      return true;
    }
    const session = new Session({
      id: row.id,
      shop: row.shop,
      state: row.state || "",
      isOnline: false,
      scope: row.scope || undefined,
      expires: row.expires || undefined,
      accessToken: row.accessToken,
      refreshToken: row.refreshToken || undefined,
      refreshTokenExpires: row.refreshTokenExpires || undefined,
    });
    await sessionStorage.storeSession(session);
    return true;
  } catch (error) {
    markPrismaSessionUnavailable(error);
    console.error(
      "Unable to hydrate offline session from Prisma:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

async function listKnownOfflineShops(preferredShop = null) {
  const shops = [];
  const pushShop = (shop) => {
    const normalized = String(shop || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (!normalized) return;
    const full = normalized.includes(".")
      ? normalized
      : `${normalized}.myshopify.com`;
    if (!shops.includes(full)) shops.push(full);
  };

  const requested = String(preferredShop || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (requested) {
    pushShop(requested);
  }

  if (requested && sessionStorage?.findSessionsByShop) {
    try {
      const sessions = await sessionStorage.findSessionsByShop(
        requested.includes(".") ? requested : `${requested}.myshopify.com`,
      );
      for (const session of sessions || []) {
        if (session?.shop) pushShop(session.shop);
      }
    } catch {
      // ignore
    }
  }

  try {
    if (shouldSkipPrismaSessionLookup()) {
      if (!requested) pushShop(PREFERRED_SHOP);
    } else {
      const offlineSessions = await prisma.session.findMany({
        where: { isOnline: false },
        select: { shop: true },
        distinct: ["shop"],
        take: 20,
      });
      if (requested) {
        const match = offlineSessions.find(
          (row) =>
            String(row.shop || "").toLowerCase() === requested ||
            String(row.shop || "")
              .toLowerCase()
              .startsWith(requested.split(".")[0]),
        );
        if (match?.shop) {
          shops.length = 0;
          pushShop(match.shop);
        }
      }
      if (!requested) {
        pushShop(PREFERRED_SHOP);
      }
      for (const row of offlineSessions) {
        pushShop(row.shop);
      }
    }
  } catch (error) {
    markPrismaSessionUnavailable(error);
    console.error("Unable to list offline sessions:", error.message);
    if (!requested) {
      pushShop(PREFERRED_SHOP);
    }
  }

  return shops;
}

async function getAdminContext(preferredShop = null) {
  const shopsToTry = await listKnownOfflineShops(preferredShop);
  let lastError = null;

  for (const shop of shopsToTry) {
    try {
      await hydrateOfflineSessionIntoStorage(shop);
      const context = await unauthenticated.admin(shop);
      return { ...context, shop };
    } catch (error) {
      lastError = error;
    }
  }

  // Fallback: client credentials when Prisma offline sessions are unavailable.
  for (const shop of shopsToTry) {
    try {
      const { getClientCredentialsAdmin } = await import(
        "./shopify-admin-client-credentials.server.js"
      );
      return await getClientCredentialsAdmin(shop);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError?.message ||
      "لا توجد جلسة Shopify محفوظة. افتح التطبيق من Admin أثناء npm run dev ثم أعد المحاولة.",
  );
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-");
}

function isActiveProduct(node) {
  const status = String(node?.status || "").toUpperCase();
  return !status || status === "ACTIVE";
}

function buildProductUrl(shop, handle, onlineStoreUrl) {
  if (handle) {
    return `https://enarteshop.com/products/${handle}`;
  }
  if (onlineStoreUrl) {
    try {
      const parsed = new URL(onlineStoreUrl);
      if (parsed.pathname.includes("/products/")) {
        return `https://enarteshop.com${parsed.pathname}${parsed.search}`;
      }
    } catch {
      // fall through
    }
    return onlineStoreUrl;
  }
  if (!shop || !handle) {
    return "";
  }
  const host = shop.includes(".") ? shop : `${shop}.myshopify.com`;
  return `https://${host}/products/${handle}`;
}

function collectProductImageUrls(node) {
  const urls = [];
  const push = (url) => {
    const value = String(url || "").trim();
    if (!value || urls.includes(value)) return;
    urls.push(value);
  };
  push(node?.featuredImage?.url);
  const nodes = node?.images?.nodes || [];
  for (const image of nodes) {
    push(image?.url);
  }
  // Legacy edges shape if API ever returns it.
  for (const edge of node?.images?.edges || []) {
    push(edge?.node?.url);
  }
  return urls;
}

function mapProductNode(node, collectionKey, shop) {
  const amount = Number(node?.priceRangeV2?.minVariantPrice?.amount);
  const currency =
    node?.priceRangeV2?.minVariantPrice?.currencyCode || "JOD";
  const tags = Array.isArray(node?.tags)
    ? node.tags
    : String(node?.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
  const images = collectProductImageUrls(node);

  return {
    id: node.id,
    title: node.title,
    price: Number.isFinite(amount) ? amount.toFixed(2) : null,
    priceAmount: Number.isFinite(amount) ? amount : null,
    currency,
    image: images[0] || null,
    images,
    url: buildProductUrl(shop, node.handle, node.onlineStoreUrl),
    collection: collectionKey,
    handle: node.handle,
    productType: node?.productType || "",
    tags,
    categoryName: node?.category?.name || "",
    categoryFullName: node?.category?.fullName || "",
    // Phase 2 hook: populate from Shopify metafields when enrichment exists
    aiMetadata: null,
    metafields: null,
  };
}

function collectionMatchesConfig(node, config) {
  const title = normalizeText(node.title);
  const handle = normalizeHandle(node.handle);

  if (
    config.handles.some((candidate) => normalizeHandle(candidate) === handle)
  ) {
    return true;
  }

  if (config.titles.some((candidate) => normalizeText(candidate) === title)) {
    return true;
  }

  if (config.key === "CHANDELIERS") {
    return title.includes("chandelier") || handle.includes("chandelier");
  }
  if (config.key === "LED PENDANTS") {
    const hasLed = title.includes("led") || handle.includes("led");
    const hasPendant = title.includes("pendant") || handle.includes("pendant");
    return hasLed && hasPendant;
  }

  return false;
}

async function listAllCollectionsMeta(admin) {
  const response = await admin.graphql(
    `#graphql
      query EnarteListCollectionMeta {
        collections(first: 250) {
          edges {
            node {
              id
              title
              handle
            }
          }
        }
      }`,
  );

  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  return (json?.data?.collections?.edges || []).map((edge) => edge.node);
}

async function fetchCollectionByHandle(admin, handle) {
  const response = await admin.graphql(
    `#graphql
      query EnarteCollectionByHandle($handle: String!) {
        collectionByHandle(handle: $handle) {
          id
          title
          handle
        }
      }`,
    { variables: { handle } },
  );

  const json = await response.json();
  if (json.errors?.length) {
    const fatal = json.errors.some(
      (error) => !/not found|doesn't exist|null/i.test(error.message || ""),
    );
    if (fatal) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    return null;
  }

  return json?.data?.collectionByHandle || null;
}

async function fetchProductsForCollectionId(admin, collectionId, first) {
  const response = await admin.graphql(
    `#graphql
      query EnarteCollectionProducts($id: ID!, $first: Int!) {
        collection(id: $id) {
          id
          title
          handle
          products(first: $first) {
            edges {
              node {
                ${PRODUCT_NODE_FIELDS}
              }
            }
          }
        }
      }`,
    { variables: { id: collectionId, first } },
  );

  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  return json?.data?.collection || null;
}

async function searchCollectionsMeta(admin, searchQuery) {
  const response = await admin.graphql(
    `#graphql
      query EnarteSearchCollections($query: String!) {
        collections(first: 25, query: $query) {
          edges {
            node {
              id
              title
              handle
            }
          }
        }
      }`,
    { variables: { query: searchQuery } },
  );

  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  return (json?.data?.collections?.edges || []).map((edge) => edge.node);
}

async function fetchCollectionProducts(admin, config) {
  for (const handle of config.handles) {
    const byHandle = await fetchCollectionByHandle(
      admin,
      normalizeHandle(handle),
    );
    if (byHandle && collectionMatchesConfig(byHandle, config)) {
      return fetchProductsForCollectionId(
        admin,
        byHandle.id,
        PRODUCTS_PER_COLLECTION,
      );
    }
  }

  const searchTerms = [...config.handles, ...config.titles, config.key]
    .map((term) => String(term).trim())
    .filter(Boolean);

  const searchQuery = Array.from(new Set(searchTerms))
    .map((term) => {
      const safe = term.replace(/"/g, "");
      return `title:${safe} OR handle:${normalizeHandle(safe)} OR ${safe}`;
    })
    .join(" OR ");

  const searched = await searchCollectionsMeta(admin, searchQuery);
  const searchMatch = searched.find((node) =>
    collectionMatchesConfig(node, config),
  );
  if (searchMatch) {
    return fetchProductsForCollectionId(
      admin,
      searchMatch.id,
      PRODUCTS_PER_COLLECTION,
    );
  }

  const listed = await listAllCollectionsMeta(admin);
  const matched = listed.find((node) => collectionMatchesConfig(node, config));
  if (!matched) {
    return null;
  }

  return fetchProductsForCollectionId(
    admin,
    matched.id,
    PRODUCTS_PER_COLLECTION,
  );
}

async function fetchAllActiveProducts(admin, shop, { maxProducts = CATALOG_MAX_PRODUCTS } = {}) {
  const products = [];
  let cursor = null;
  const hardCap = Math.max(1, Number(maxProducts) || CATALOG_MAX_PRODUCTS);

  while (products.length < hardCap) {
    const response = await admin.graphql(
      `#graphql
        query EnarteActiveProducts($first: Int!, $cursor: String) {
          products(first: $first, after: $cursor, query: "status:active") {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                ${PRODUCT_NODE_FIELDS}
              }
            }
          }
        }`,
      {
        variables: {
          first: CATALOG_PAGE_SIZE,
          cursor,
        },
      },
    );

    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }

    const connection = json?.data?.products;
    for (const edge of connection?.edges || []) {
      const node = edge?.node;
      if (!node || !isActiveProduct(node)) {
        continue;
      }
      products.push(mapProductNode(node, "CATALOG", shop));
      if (products.length >= hardCap) break;
    }

    if (!connection?.pageInfo?.hasNextPage) {
      break;
    }
    cursor = connection.pageInfo.endCursor;
  }

  console.log("ENARTE catalog products loaded:", {
    shop,
    count: products.length,
  });
  return products;
}

function dedupeProducts(products) {
  const seen = new Set();
  const result = [];
  for (const product of products) {
    if (!product?.id || seen.has(product.id)) {
      continue;
    }
    seen.add(product.id);
    result.push(product);
  }
  return result;
}

function toPublicProduct(product) {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    currency: product.currency || "JOD",
    image: product.image,
    url: product.url,
    collection: product.collection,
  };
}

/**
 * Load Shopify products, then run the configurable recommendation engine.
 * Phase 5: when markers are provided, return top 3 products per marker.
 */
export async function recommendProducts({
  budgetId,
  analysisText = "",
  markers = [],
  shop: shopHint = null,
} = {}) {
  const budgetRange = getBudgetRange(budgetId);
  const normalizedMarkers = normalizeMarkers(markers);

  // Reuse shared catalog loader (avoids double GraphQL crawl: collections + full catalog).
  const catalogPayload = await loadEnarteCatalog({ shop: shopHint });
  const shop = catalogPayload.shop;
  const unique = catalogPayload.products || [];
  const source = catalogPayload.source || "catalog";
  const missingCollections = catalogPayload.missingCollections || [];

  console.log("ENARTE product match source:", {
    shop,
    source,
    loaded: unique.length,
    missingCollections,
    markerCount: normalizedMarkers.length,
    aiMetafieldNamespace: PRODUCT_AI_METAFIELD_NAMESPACE,
    aiMetafieldKeys: PRODUCT_AI_METAFIELD_KEYS,
  });

  if (unique.length === 0) {
    return {
      mode: normalizedMarkers.length ? "markers" : "room",
      products: [],
      markerRecommendations: [],
      count: 0,
      partial: true,
      budgetRange,
      missingCollections,
      candidateCount: 0,
      shop,
      source,
    };
  }

  const budgetSelection = selectProductsForBudget(unique, budgetRange);
  let inBudget = budgetSelection.products;
  let usedBudgetFallback = budgetSelection.usedBudgetFallback;
  if (usedBudgetFallback) {
    console.log(
      "ENARTE budget matched 0 products; falling back to closest prices",
      {
        budgetId: budgetRange.id,
        min: budgetRange.min,
        max: budgetRange.max,
        candidateCount: inBudget.length,
      },
    );
  }

  // No markers → keep current automatic room-level recommendations.
  if (normalizedMarkers.length === 0) {
    const engineResult = runRecommendationEngine({
      analysisText,
      budgetRange,
      products: inBudget,
    });

    const products = engineResult.products.map(toPublicProduct);

    console.log("ENARTE recommendation engine:", {
      shop,
      mode: "room",
      version: engineResult.version,
      roomProfile: engineResult.roomProfile,
      count: products.length,
      candidateCount: inBudget.length,
      usedBudgetFallback,
      rankings: engineResult.rankings,
    });

    return {
      mode: "room",
      products,
      markerRecommendations: [],
      count: products.length,
      partial: products.length < 3,
      budgetRange,
      missingCollections,
      candidateCount: inBudget.length,
      shop,
      source,
      engineVersion: engineResult.version,
      roomProfile: engineResult.roomProfile,
    };
  }

  // Marker-based: top 3 products for each lighting position.
  const usedProductIds = new Set();
  const markerRecommendations = normalizedMarkers.map((marker, index) => {
    const zone = inferMarkerZoneHint(marker);
    const available = inBudget.filter((product) => !usedProductIds.has(product.id));
    const pool = available.length >= 3 ? available : inBudget;

    const engineResult = runRecommendationEngine({
      analysisText,
      budgetRange,
      products: pool,
      markerZone: zone,
    });

    const products = engineResult.products.map(toPublicProduct);
    for (const product of products) {
      usedProductIds.add(product.id);
    }

    return {
      id: marker.id,
      x: marker.x,
      y: marker.y,
      index: index + 1,
      label: marker.label || `Marker ${index + 1}`,
      zone: zone.zone,
      zoneLabelAr: zone.labelAr,
      products,
      count: products.length,
      partial: products.length < 3,
      // Future virtual placement hook (not generated yet)
      placementPlan: buildVirtualPlacementPlan(marker, products[0] || null),
      rankings: engineResult.rankings,
      roomProfile: engineResult.roomProfile,
    };
  });

  console.log("ENARTE recommendation engine:", {
    shop,
    mode: "markers",
    markerCount: markerRecommendations.length,
    usedBudgetFallback,
    summaries: markerRecommendations.map((item) => ({
      id: item.id,
      zone: item.zone,
      count: item.count,
      titles: item.products.map((product) => product.title),
    })),
  });

  return {
    mode: "markers",
    products: [],
    markerRecommendations,
    count: markerRecommendations.reduce((sum, item) => sum + item.count, 0),
    partial: markerRecommendations.some((item) => item.partial),
    budgetRange,
    missingCollections,
    candidateCount: inBudget.length,
    shop,
    source,
    engineVersion: "recommendation.engine.phase4.v1",
  };
}

/**
 * Load ENARTE Shopify catalog only (collections + active products).
 * Used by the assistant Shopify Catalog Adapter — no internet / external stores.
 */
const LOAD_CATALOG_TTL_MS = 180_000;
/** @type {Map<string, { at: number, payload: object }>} */
const loadCatalogCache = new Map();
/** @type {Map<string, Promise<object>>} */
const loadCatalogInflight = new Map();

export async function loadEnarteCatalog({ shop: shopHint = null } = {}) {
  const cacheKey = String(shopHint || "default").toLowerCase();
  const cached = loadCatalogCache.get(cacheKey);
  if (cached && Date.now() - cached.at < LOAD_CATALOG_TTL_MS) {
    return cached.payload;
  }
  if (loadCatalogInflight.has(cacheKey)) {
    return loadCatalogInflight.get(cacheKey);
  }

  const pending = (async () => {
    const { admin, shop } = await getAdminContext(shopHint);
    const collected = [];
    const missingCollections = [];

    // Prefer target collections first; only fall back to full catalog if empty.
    for (const config of TARGET_COLLECTIONS) {
      try {
        const collectionNode = await fetchCollectionProducts(admin, config);
        if (!collectionNode) {
          missingCollections.push(config.key);
          continue;
        }

        for (const edge of collectionNode.products?.edges || []) {
          const node = edge.node;
          if (!node || !isActiveProduct(node)) {
            continue;
          }
          collected.push(mapProductNode(node, config.key, shop));
        }
      } catch (error) {
        console.error(`Collection load failed for ${config.key}:`, error.message);
        missingCollections.push(config.key);
      }
    }

    let catalog = [];
    if (collected.length < 8) {
      try {
        catalog = await fetchAllActiveProducts(admin, shop);
      } catch (error) {
        console.error("Catalog load failed:", error.message);
      }
    }

    const products = dedupeProducts([...collected, ...catalog]);

    return {
      shop,
      products,
      count: products.length,
      missingCollections,
      source:
        collected.length > 0 && catalog.length > 0
          ? "collections+catalog"
          : collected.length > 0
            ? "collections"
            : "catalog",
    };
  })()
    .then((payload) => {
      loadCatalogCache.set(cacheKey, { at: Date.now(), payload });
      loadCatalogInflight.delete(cacheKey);
      return payload;
    })
    .catch((error) => {
      loadCatalogInflight.delete(cacheKey);
      throw error;
    });

  loadCatalogInflight.set(cacheKey, pending);
  return pending;
}

/** Full active Shopify catalog for visual search (all products + all images). */
const VISUAL_CATALOG_MAX_PRODUCTS = 2000;
const VISUAL_CATALOG_TTL_MS = 10 * 60 * 1000;
/** @type {Map<string, { at: number, payload: object }>} */
const visualCatalogCache = new Map();
/** @type {Map<string, Promise<object>>} */
const visualCatalogInflight = new Map();

export async function loadEnarteCatalogForVisualSearch({
  shop: shopHint = null,
} = {}) {
  const cacheKey = `visual:${String(shopHint || "default").toLowerCase()}`;
  const cached = visualCatalogCache.get(cacheKey);
  if (cached && Date.now() - cached.at < VISUAL_CATALOG_TTL_MS) {
    return cached.payload;
  }
  if (visualCatalogInflight.has(cacheKey)) {
    return visualCatalogInflight.get(cacheKey);
  }

  const pending = (async () => {
    const { admin, shop } = await getAdminContext(shopHint);
    const products = await fetchAllActiveProducts(admin, shop, {
      maxProducts: VISUAL_CATALOG_MAX_PRODUCTS,
    });
    const withImages = products.filter(
      (product) =>
        (Array.isArray(product.images) && product.images.length > 0) ||
        product.image,
    );
    return {
      shop,
      products: withImages,
      count: withImages.length,
      source: "full-active-catalog",
    };
  })()
    .then((payload) => {
      visualCatalogCache.set(cacheKey, { at: Date.now(), payload });
      visualCatalogInflight.delete(cacheKey);
      return payload;
    })
    .catch((error) => {
      visualCatalogInflight.delete(cacheKey);
      throw error;
    });

  visualCatalogInflight.set(cacheKey, pending);
  return pending;
}
