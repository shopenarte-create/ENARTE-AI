/**
 * GET /api/assistant/taught?shop=...
 * Ops/debug: how many taught answers exist and whether they are in the DB.
 */

import { countTaughtAnswers } from "../services/assistant/learning/taught-answers.js";
import { corsHeaders } from "../services/assistant/utils/http.js";
import { validateShop } from "../services/assistant/utils/validation.js";

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);
  const shopCheck = validateShop(
    url.searchParams.get("shop") ||
      process.env.ASSISTANT_DEFAULT_SHOP ||
      process.env.SHOP ||
      null,
  );
  if (!shopCheck.ok) {
    return Response.json(
      { ok: false, error: shopCheck.error },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  const result = await countTaughtAnswers(shopCheck.value);
  return Response.json(
    {
      ok: true,
      shop: shopCheck.value,
      ...result,
      note:
        result.persisted
          ? "Taught answers are in the database and shared across web/mobile/app."
          : "Taught answers are only in memory — not shared across devices until DB migrate succeeds.",
    },
    { headers: corsHeaders(request) },
  );
}
