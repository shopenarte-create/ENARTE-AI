/**
 * POST /api/assistant/teach
 *
 * Train-mode: approve, correct, or teach an answer for a question.
 * Requires trainKey matching ASSISTANT_TRAIN_KEY (or train=1 in non-production).
 */

import {
  upsertTaughtAnswer,
  verifyTrainKey,
} from "../services/assistant/learning/taught-answers.js";
import { corsHeaders } from "../services/assistant/utils/http.js";
import { validateShop } from "../services/assistant/utils/validation.js";

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

  const trainKey =
    body.trainKey ||
    request.headers.get("X-Enarte-Train-Key") ||
    new URL(request.url).searchParams.get("train");

  if (!verifyTrainKey(trainKey)) {
    return Response.json(
      { ok: false, error: "unauthorized_train" },
      { status: 401, headers: corsHeaders(request, "POST, OPTIONS") },
    );
  }

  const shopCheck = validateShop(
    body.shop ||
      process.env.ASSISTANT_DEFAULT_SHOP ||
      process.env.SHOP ||
      null,
  );
  if (!shopCheck.ok) {
    return Response.json(
      { ok: false, error: shopCheck.error },
      { status: 400, headers: corsHeaders(request, "POST, OPTIONS") },
    );
  }

  const kind = String(body.action || "approve").toLowerCase();
  if (!["approve", "correct", "teach"].includes(kind)) {
    return Response.json(
      { ok: false, error: "invalid_action" },
      { status: 400, headers: corsHeaders(request, "POST, OPTIONS") },
    );
  }

  const result = await upsertTaughtAnswer({
    shop: shopCheck.value,
    question: body.question,
    answer: body.answer,
    locale: body.locale || "ar",
    conversationId: body.sessionId || body.conversationId || null,
    sourceMessageId: body.messageId || null,
  });

  return Response.json(
    {
      ...result,
      action: kind,
    },
    {
      status: result.ok ? 200 : 400,
      headers: corsHeaders(request, "POST, OPTIONS"),
    },
  );
}
