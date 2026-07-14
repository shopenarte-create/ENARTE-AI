import {
  resolveBudgetInput,
} from "../services/budget.js";
import { recommendProducts } from "../services/shopify-products.server.js";
import { parseMarkersInput } from "../services/placement/index.js";

export async function action({ request }) {
  try {
    const formData = await request.formData();
    const budgetResolved = resolveBudgetInput(formData.get("budget"));

    if (!budgetResolved.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: budgetResolved.error,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const analysisText = String(formData.get("analysis") || "").trim();
    const markers = parseMarkersInput(formData.get("markers"));
    const shopHint = String(formData.get("shop") || "").trim() || null;

    const recommendation = await recommendProducts({
      budgetId: budgetResolved.budgetId,
      analysisText,
      markers,
      shop: shopHint,
    });

    // Warm product image cache in the background (does not delay the response).
    // Speeds up later /api/place when the customer taps "جربها الآن".
    const urls = new Set();
    for (const product of recommendation.products || []) {
      if (product?.image) {
        urls.add(product.image);
      }
    }
    for (const markerRec of recommendation.markerRecommendations || []) {
      for (const product of markerRec.products || []) {
        if (product?.image) {
          urls.add(product.image);
        }
      }
    }
    if (urls.size > 0) {
      import("../services/placement/cache.server.js")
        .then(async ({ getCachedProductImage, setCachedProductImage }) => {
          await Promise.all(
            [...urls].map(async (url) => {
              if (getCachedProductImage(url)) {
                return;
              }
              try {
                const response = await fetch(url);
                if (!response.ok) {
                  return;
                }
                const buffer = Buffer.from(await response.arrayBuffer());
                setCachedProductImage(url, buffer);
              } catch {
                // ignore warm failures
              }
            }),
          );
        })
        .catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: recommendation.mode || "room",
        budget: recommendation.budgetRange.id,
        budgetRange: recommendation.budgetRange,
        products: recommendation.products,
        markerRecommendations: recommendation.markerRecommendations || [],
        markers,
        count: recommendation.count,
        partial: recommendation.partial,
        missingCollections: recommendation.missingCollections,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "تعذر جلب المنتجات من Shopify.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
