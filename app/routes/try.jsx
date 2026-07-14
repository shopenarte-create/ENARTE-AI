import { useLoaderData } from "react-router";
import EnarteHomePage from "../components/EnarteHomePage.jsx";
import {
  isProductEntry,
  parseLockedProductFromSearchParams,
} from "../services/placement/product-entry.js";

/**
 * Storefront entry: /try?entry=product|home&handoff=...
 * - product: place the locked product (skip recommendations)
 * - home: analyze room → recommend top 3 → place
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const lockedProduct = parseLockedProductFromSearchParams(url.searchParams);
  const entryMode = isProductEntry(url.searchParams) ? "product" : "main";

  return {
    entryMode,
    lockedProduct,
    shop: url.searchParams.get("shop") || null,
    // Must be loader-driven so SSR + client initial state match (avoids React #418).
    handoffId: url.searchParams.get("handoff") || null,
  };
};

export default function TryRoute() {
  const data = useLoaderData();
  return (
    <EnarteHomePage
      entryMode={data.entryMode}
      lockedProduct={data.lockedProduct}
      handoffId={data.handoffId}
    />
  );
}
