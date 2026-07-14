/**
 * Request validation for assistant HTTP / chat API inputs.
 */

export function validateShop(shop) {
  if (!shop || typeof shop !== "string" || !shop.trim()) {
    return { ok: false, error: "shop_required" };
  }
  return { ok: true, value: shop.trim() };
}

export function validateLocale(locale, fallback = "ar") {
  const value = String(locale || fallback).trim().toLowerCase();
  if (!value) return { ok: true, value: fallback };
  if (value.length > 16) return { ok: false, error: "locale_invalid" };
  return { ok: true, value };
}

export function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
    return { ok: false, error: "session_id_required" };
  }
  return { ok: true, value: sessionId.trim() };
}

export function validateMessagePayload(input = {}) {
  const session = validateSessionId(input.sessionId);
  if (!session.ok) return session;

  const hasMessage = Boolean(String(input.message || "").trim());
  const hasAction = Boolean(input.actionId);
  const hasImage = Boolean(input.image && typeof input.image === "object");
  if (!hasMessage && !hasAction && !hasImage) {
    return { ok: false, error: "message_required" };
  }

  if (input.actionId && typeof input.actionId !== "string") {
    return { ok: false, error: "action_id_invalid" };
  }

  return {
    ok: true,
    value: {
      sessionId: session.value,
      message: hasMessage ? String(input.message).trim() : "",
      actionId: input.actionId || null,
      artifacts: input.artifacts && typeof input.artifacts === "object"
        ? input.artifacts
        : {},
      selectedProduct: input.selectedProduct || null,
      selectedRoom: input.selectedRoom || null,
      locale: input.locale || null,
      products: input.products,
      image: hasImage ? input.image : null,
    },
  };
}
