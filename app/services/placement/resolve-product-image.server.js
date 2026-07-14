import { unauthenticated } from "../../shopify.server.js";
import { normalizeProductId, normalizeProductImageUrl } from "./product-entry.js";
import {
  getCachedProductImage,
  setCachedProductImage,
} from "./cache.server.js";

const PREFERRED_SHOP = "jb8xus-wn.myshopify.com";
const FALLBACK_SHOP = "enarte-ai-dev.myshopify.com";

/**
 * Download a product image URL into a Buffer (with memory cache).
 */
export async function fetchImageBuffer(url) {
  if (!url) {
    throw new Error("Missing product image URL");
  }

  let absolute = String(url).trim();
  if (absolute.startsWith("//")) {
    absolute = `https:${absolute}`;
  }

  const cached = getCachedProductImage(absolute);
  if (cached) {
    return { buffer: cached, url: absolute };
  }

  const response = await fetch(absolute);
  if (!response.ok) {
    throw new Error(`Failed to download product image (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  setCachedProductImage(absolute, buffer);
  return { buffer, url: absolute };
}

/**
 * Look up the live featured image for a Shopify product id.
 */
export async function fetchShopifyProductImageUrl(
  productId,
  shop = PREFERRED_SHOP,
) {
  const gid = normalizeProductId(productId);
  if (!gid) return null;

  const shops = [
    shop,
    PREFERRED_SHOP,
    FALLBACK_SHOP,
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);

  for (const shopDomain of shops) {
    try {
      const { admin } = await unauthenticated.admin(shopDomain);
      const response = await admin.graphql(
        `#graphql
        query EnarteProductImage($id: ID!) {
          product(id: $id) {
            featuredImage { url }
            images(first: 1) {
              nodes { url }
            }
          }
        }`,
        { variables: { id: gid } },
      );
      const json = await response.json();
      const product = json?.data?.product;
      const url =
        product?.featuredImage?.url ||
        product?.images?.nodes?.[0]?.url ||
        null;
      const normalized = normalizeProductImageUrl(url);
      if (normalized) return normalized;
    } catch (error) {
      console.warn(
        "[resolve-product-image] shopify lookup failed:",
        shopDomain,
        error?.message || error,
      );
    }
  }
  return null;
}

/**
 * Resolve a usable product image buffer.
 * Tries the provided URL first; on failure, fetches the live Shopify image by id.
 */
export async function resolveProductImageBuffer({ imageUrl, productId, shop }) {
  const normalizedUrl = normalizeProductImageUrl(imageUrl);
  if (normalizedUrl) {
    try {
      return await fetchImageBuffer(normalizedUrl);
    } catch (error) {
      console.warn(
        "[resolve-product-image] url failed, trying Shopify id:",
        {
          imageUrl: normalizedUrl,
          productId,
          error: error?.message || String(error),
        },
      );
    }
  }

  const resolvedUrl = await fetchShopifyProductImageUrl(productId, shop);
  if (!resolvedUrl) {
    throw new Error(
      normalizedUrl
        ? `Failed to download product image and Shopify lookup returned empty`
        : `Missing product image URL and Shopify lookup returned empty`,
    );
  }

  return fetchImageBuffer(resolvedUrl);
}
