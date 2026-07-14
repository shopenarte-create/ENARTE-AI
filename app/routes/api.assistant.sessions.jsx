/**
 * POST /api/assistant/sessions
 * GET  /api/assistant/sessions?id=...
 *
 * Start or fetch an assistant chat session (welcome + history).
 */

import {
  startChatSession,
  getChatSession,
} from "../services/assistant/ux/index.js";
import {
  validateLocale,
  validateShop,
} from "../services/assistant/utils/validation.js";
import { corsHeaders } from "../services/assistant/utils/http.js";

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json(
      { ok: false, error: "id_required" },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  const result = await getChatSession(id);
  return Response.json(result, {
    status: result.ok ? 200 : 404,
    headers: corsHeaders(request),
  });
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: corsHeaders(request) },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  const shopCheck = validateShop(
    body.shop ||
      url.searchParams.get("shop") ||
      process.env.ASSISTANT_DEFAULT_SHOP ||
      null,
  );
  if (!shopCheck.ok) {
    return Response.json(
      { ok: false, error: shopCheck.error },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  const localeCheck = validateLocale(
    body.locale || url.searchParams.get("locale") || "ar",
  );

  const result = await startChatSession({
    shop: shopCheck.value,
    locale: localeCheck.value,
    channel: body.channel,
  });

  return Response.json(result, {
    status: result.ok ? 200 : 500,
    headers: corsHeaders(request),
  });
}
