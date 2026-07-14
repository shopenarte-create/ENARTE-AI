/**
 * GET /api/assistant/actions
 * List smart action buttons for the assistant welcome experience.
 */

import { listChatSmartActions } from "../services/assistant/ux/index.js";

export async function loader({ request }) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || "ar";
  const actions = listChatSmartActions(locale);

  return Response.json(
    { ok: true, actions },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
