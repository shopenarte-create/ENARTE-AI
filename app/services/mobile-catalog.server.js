/**
 * Mobile shopping catalog via Shopify Admin GraphQL (client credentials / offline session).
 */

import { unauthenticated, sessionStorage } from "../shopify.server.js";

const PREFERRED_SHOP =
  process.env.ASSISTANT_DEFAULT_SHOP ||
  process.env.SHOP ||
  "jb8xus-wn.myshopify.com";

function normalizeShop(shop) {
  const raw = String(shop || PREFERRED_SHOP)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!raw) return PREFERRED_SHOP;
  return raw.includes(".") ? raw : `${raw}.myshopify.com`;
}

function numericIdFromGid(gid) {
  const match = String(gid || "").match(/\/(\d+)\s*$/);
  return match ? match[1] : null;
}

function storefrontProductUrl(shop, handle, onlineStoreUrl) {
  if (onlineStoreUrl) return onlineStoreUrl;
  if (!handle) return "";
  const host = normalizeShop(shop).replace(".myshopify.com", "");
  // Prefer custom domain when configured.
  const custom = String(process.env.PUBLIC_STORE_DOMAIN || "enarteshop.com")
    .trim()
    .replace(/^https?:\/\//, "");
  if (custom) return `https://${custom}/products/${handle}`;
  return `https://${host}.myshopify.com/products/${handle}`;
}

async function getAdmin(shopHint) {
  const shop = normalizeShop(shopHint);
  try {
    if (sessionStorage?.findSessionsByShop) {
      const sessions = await sessionStorage.findSessionsByShop(shop);
      if (Array.isArray(sessions) && sessions.some((s) => s?.accessToken)) {
        return { ...(await unauthenticated.admin(shop)), shop };
      }
    }
  } catch {
    // fall through
  }
  try {
    return { ...(await unauthenticated.admin(shop)), shop };
  } catch {
    const { getClientCredentialsAdmin } = await import(
      "./shopify-admin-client-credentials.server.js"
    );
    return getClientCredentialsAdmin(shop);
  }
}

function mapVariant(node) {
  const amount = Number(node?.price);
  const compare = Number(node?.compareAtPrice);
  return {
    id: node.id,
    numericId: numericIdFromGid(node.id),
    title: node.title || "Default",
    available: Boolean(node.availableForSale),
    price: Number.isFinite(amount) ? amount.toFixed(2) : null,
    priceAmount: Number.isFinite(amount) ? amount : null,
    compareAtPrice: Number.isFinite(compare) && compare > 0 ? compare.toFixed(2) : null,
    currency: "JOD",
    selectedOptions: (node.selectedOptions || []).map((o) => ({
      name: o.name,
      value: o.value,
    })),
  };
}

function mapProduct(node, shop) {
  const images = [];
  if (node?.featuredImage?.url) images.push(node.featuredImage.url);
  for (const img of node?.images?.nodes || []) {
    if (img?.url && !images.includes(img.url)) images.push(img.url);
  }
  const variants = (node?.variants?.nodes || []).map(mapVariant);
  const firstAvailable = variants.find((v) => v.available) || variants[0] || null;
  const amount = Number(
    firstAvailable?.priceAmount ?? node?.priceRangeV2?.minVariantPrice?.amount,
  );
  const currency =
    node?.priceRangeV2?.minVariantPrice?.currencyCode ||
    firstAvailable?.currency ||
    "JOD";

  return {
    id: node.id,
    numericId: numericIdFromGid(node.id),
    title: node.title,
    handle: node.handle,
    description: node.description || "",
    descriptionHtml: node.descriptionHtml || "",
    productType: node.productType || "",
    vendor: node.vendor || "",
    tags: Array.isArray(node.tags) ? node.tags : [],
    image: images[0] || null,
    images,
    url: storefrontProductUrl(shop, node.handle, node.onlineStoreUrl),
    price: Number.isFinite(amount) ? amount.toFixed(2) : null,
    priceAmount: Number.isFinite(amount) ? amount : null,
    currency,
    available: Boolean(firstAvailable?.available),
    variants,
    selectedVariantId: firstAvailable?.id || null,
    selectedVariantNumericId: firstAvailable?.numericId || null,
  };
}

const PRODUCT_FIELDS = `
  id
  title
  handle
  status
  description
  descriptionHtml
  productType
  vendor
  tags
  onlineStoreUrl
  featuredImage { url altText }
  images(first: 12) { nodes { url } }
  priceRangeV2 {
    minVariantPrice { amount currencyCode }
  }
  variants(first: 50) {
    nodes {
      id
      title
      availableForSale
      price
      compareAtPrice
      selectedOptions { name value }
    }
  }
`;

export async function listMobileCollections(shopHint) {
  const { admin, shop } = await getAdmin(shopHint);
  const response = await admin.graphql(
    `#graphql
      query MobileCollections {
        collections(first: 50, sortKey: TITLE) {
          nodes {
            id
            title
            handle
            image { url }
          }
        }
      }`,
  );
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const nodes = json?.data?.collections?.nodes || [];
  return {
    shop,
    collections: nodes.map((node) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      image: node.image?.url || null,
    })),
  };
}

export async function listMobileProducts({
  shopHint,
  collection,
  q,
  cursor,
  first = 24,
} = {}) {
  const { admin, shop } = await getAdmin(shopHint);
  const limit = Math.min(Math.max(Number(first) || 24, 1), 50);

  if (collection) {
    const response = await admin.graphql(
      `#graphql
        query MobileCollectionProducts($handle: String!, $first: Int!, $after: String) {
          collectionByHandle(handle: $handle) {
            id
            title
            handle
            products(first: $first, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes { ${PRODUCT_FIELDS} }
            }
          }
        }`,
      { variables: { handle: String(collection), first: limit, after: cursor || null } },
    );
    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    const col = json?.data?.collectionByHandle;
    if (!col) {
      return { shop, collection: null, products: [], pageInfo: { hasNextPage: false } };
    }
    const products = (col.products?.nodes || [])
      .filter((n) => String(n.status || "").toUpperCase() === "ACTIVE")
      .map((n) => mapProduct(n, shop));
    return {
      shop,
      collection: { id: col.id, title: col.title, handle: col.handle },
      products,
      pageInfo: col.products?.pageInfo || { hasNextPage: false },
    };
  }

  const queryParts = ["status:active"];
  if (q) queryParts.push(`title:*${String(q).trim()}*`);
  const response = await admin.graphql(
    `#graphql
      query MobileProducts($first: Int!, $after: String, $query: String!) {
        products(first: $first, after: $after, query: $query, sortKey: TITLE) {
          pageInfo { hasNextPage endCursor }
          nodes { ${PRODUCT_FIELDS} }
        }
      }`,
    {
      variables: {
        first: limit,
        after: cursor || null,
        query: queryParts.join(" "),
      },
    },
  );
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const conn = json?.data?.products;
  return {
    shop,
    collection: null,
    products: (conn?.nodes || []).map((n) => mapProduct(n, shop)),
    pageInfo: conn?.pageInfo || { hasNextPage: false },
  };
}

export async function getMobileProduct({ shopHint, handle, id } = {}) {
  const { admin, shop } = await getAdmin(shopHint);
  if (handle) {
    const response = await admin.graphql(
      `#graphql
        query MobileProductByHandle($handle: String!) {
          productByHandle(handle: $handle) {
            ${PRODUCT_FIELDS}
          }
        }`,
      { variables: { handle: String(handle) } },
    );
    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    const node = json?.data?.productByHandle;
    if (!node) return { shop, product: null };
    return { shop, product: mapProduct(node, shop) };
  }

  if (id) {
    const response = await admin.graphql(
      `#graphql
        query MobileProductById($id: ID!) {
          product(id: $id) {
            ${PRODUCT_FIELDS}
          }
        }`,
      { variables: { id: String(id) } },
    );
    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    const node = json?.data?.product;
    if (!node) return { shop, product: null };
    return { shop, product: mapProduct(node, shop) };
  }

  throw new Error("handle_or_id_required");
}

export function buildCartCheckoutUrl(items, storeUrl = "https://enarteshop.com") {
  const parts = (items || [])
    .map((item) => {
      const id = item.variantNumericId || numericIdFromGid(item.variantId);
      const qty = Math.max(1, Number(item.quantity) || 1);
      return id ? `${id}:${qty}` : null;
    })
    .filter(Boolean);
  if (!parts.length) return null;
  const base = String(storeUrl || "https://enarteshop.com").replace(/\/$/, "");
  return `${base}/cart/${parts.join(",")}`;
}
