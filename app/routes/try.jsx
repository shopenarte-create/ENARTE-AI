import { useLoaderData } from "react-router";
import RoomTryStudio from "../components/RoomTryStudio.jsx";
import {
  isProductEntry,
  parseLockedProductFromSearchParams,
} from "../services/placement/product-entry.js";

/**
 * Storefront entry: /try?entry=product|home&handoff=...
 * Automatic virtual-try studio (no manual markers).
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const lockedProduct = parseLockedProductFromSearchParams(url.searchParams);
  const entryMode = isProductEntry(url.searchParams) ? "product" : "main";

  return {
    entryMode,
    lockedProduct,
    shop: url.searchParams.get("shop") || null,
    handoffId: url.searchParams.get("handoff") || null,
  };
};

export default function TryRoute() {
  const data = useLoaderData();
  return (
    <RoomTryStudio
      entryMode={data.entryMode}
      lockedProduct={data.lockedProduct}
      handoffId={data.handoffId}
    />
  );
}
