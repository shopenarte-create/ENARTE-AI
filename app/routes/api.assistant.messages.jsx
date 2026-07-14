/**
 * POST /api/assistant/messages
 *
 * Send a text message or smart-action click into an existing session.
 */

import { sendChatMessage } from "../services/assistant/ux/index.js";
import { corsHeaders } from "../services/assistant/utils/http.js";

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, "POST, OPTIONS"),
    });
  }

  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: corsHeaders(request, "POST, OPTIONS") },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "invalid_json" },
      { status: 400, headers: corsHeaders(request, "POST, OPTIONS") },
    );
  }

  const result = await sendChatMessage({
    sessionId: body.sessionId,
    message: body.message,
    actionId: body.actionId,
    locale: body.locale,
    artifacts: body.artifacts,
    products: body.products,
    selectedProduct: body.selectedProduct,
    selectedRoom: body.selectedRoom,
    intent: body.intent,
    workflowId: body.workflowId,
    image: body.image,
    escalate: body.escalate,
    transitionEvent: body.transitionEvent,
  });

  const status = result.ok
    ? 200
    : result.error === "session_not_found"
      ? 404
      : result.error === "unknown_action"
        ? 400
        : result.error?.includes?.("required") || result.error === "invalid_payload"
          ? 400
          : 500;

  return Response.json(result, {
    status,
    headers: corsHeaders(request, "POST, OPTIONS"),
  });
}
