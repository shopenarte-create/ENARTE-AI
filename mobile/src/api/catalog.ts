import { SHOP_DOMAIN } from "../config";
import { apiFetch } from "./client";

export type CatalogCollection = {
  id: string;
  title: string;
  handle: string;
  image?: string | null;
};

export type CatalogVariant = {
  id: string;
  numericId: string | null;
  title: string;
  available: boolean;
  price: string | null;
  priceAmount: number | null;
  compareAtPrice?: string | null;
  currency: string;
  selectedOptions?: { name: string; value: string }[];
};

export type CatalogProduct = {
  id: string;
  title: string;
  handle: string;
  description?: string;
  image?: string | null;
  images?: string[];
  url?: string | null;
  price?: string | null;
  currency?: string;
  available?: boolean;
  variants?: CatalogVariant[];
  selectedVariantId?: string | null;
  selectedVariantNumericId?: string | null;
  productType?: string;
};

export async function fetchCollections(shop = SHOP_DOMAIN) {
  const data = await apiFetch<{
    ok: boolean;
    collections: CatalogCollection[];
  }>(`/api/mobile/catalog?type=collections&shop=${encodeURIComponent(shop)}`);
  return data.collections || [];
}

export async function fetchProducts(params: {
  shop?: string;
  collection?: string;
  q?: string;
  cursor?: string;
  first?: number;
} = {}) {
  const search = new URLSearchParams({
    type: "products",
    shop: params.shop || SHOP_DOMAIN,
  });
  if (params.collection) search.set("collection", params.collection);
  if (params.q) search.set("q", params.q);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.first) search.set("first", String(params.first));

  return apiFetch<{
    ok: boolean;
    products: CatalogProduct[];
    collection?: { id: string; title: string; handle: string } | null;
    pageInfo?: { hasNextPage?: boolean; endCursor?: string };
  }>(`/api/mobile/catalog?${search.toString()}`);
}

export async function fetchProduct(params: {
  handle?: string;
  id?: string;
  shop?: string;
}) {
  const search = new URLSearchParams({
    type: "product",
    shop: params.shop || SHOP_DOMAIN,
  });
  if (params.handle) search.set("handle", params.handle);
  if (params.id) search.set("id", params.id);
  const data = await apiFetch<{ ok: boolean; product: CatalogProduct }>(
    `/api/mobile/catalog?${search.toString()}`,
  );
  return data.product;
}
