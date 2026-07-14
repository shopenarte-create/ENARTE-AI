/**
 * GET /api/assistant/actions
 * List smart action buttons for the assistant welcome experience.
 */

import { listChatSmartActions } from "../services/assistant/ux/index.js";
import { corsHeaders } from "../services/assistant/utils/http.js";

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || "ar";
  const actions = listChatSmartActions(locale);

  return Response.json(
    { ok: true, actions },
    {
      headers: {
        ...corsHeaders(request),
      },
    },
  );
}
