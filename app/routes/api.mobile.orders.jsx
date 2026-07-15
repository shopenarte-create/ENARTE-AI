/**
 * POST /api/mobile/orders
 * Receives mobile checkout form → Shopify draft order + store email → customer ack.
 */

import { corsHeaders } from "../services/assistant/utils/http.js";
import {
  CUSTOMER_ACK_AR,
  createOrderId,
  paymentLabelAr,
  sendOrderEmail,
} from "../services/orders/email.server.js";
import { createShopifyDraftOrder } from "../services/orders/shopify-draft-order.server.js";

const PAYMENT_METHODS = new Set(["cod", "cliq", "online"]);

const JORDAN_GOVERNORATES = new Set([
  "عمّان",
  "عمان",
  "إربد",
  "اربد",
  "الزرقاء",
  "البلقاء",
  "المفرق",
  "جرش",
  "عجلون",
  "مادبا",
  "الكرك",
  "الطفيلة",
  "معان",
  "العقبة",
]);

function json(data, status, request) {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(request, "POST, OPTIONS"),
      "Content-Type": "application/json",
    },
  });
}

function normalizePhone(raw) {
  let phone = String(raw || "").replace(/[^\d+]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (phone.startsWith("07") && phone.length === 10) phone = `+962${phone.slice(1)}`;
  if (phone.startsWith("962") && !phone.startsWith("+")) phone = `+${phone}`;
  return phone;
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, "POST, OPTIONS"),
    });
  }
  return json(
    {
      ok: true,
      notifyTo: process.env.ORDER_NOTIFY_TO || "shopenarte@gmail.com",
      governorates: [...JORDAN_GOVERNORATES],
      paymentMethods: [...PAYMENT_METHODS],
    },
    200,
    request,
  );
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, "POST, OPTIONS"),
    });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, request);
  }

  try {
    const body = await request.json();
    const name = String(body?.customer?.name || body?.name || "").trim();
    const phone = normalizePhone(body?.customer?.phone || body?.phone || "");
    const governorate = String(
      body?.customer?.governorate || body?.governorate || "",
    ).trim();
    const address = String(body?.customer?.address || body?.address || "").trim();
    const note = String(body?.note || "").trim();
    const paymentMethod = String(body?.paymentMethod || "")
      .trim()
      .toLowerCase();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!name || name.length < 2) {
      return json(
        { ok: false, error: "name_required", message: "الاسم مطلوب" },
        400,
        request,
      );
    }
    if (!isValidPhone(phone)) {
      return json(
        { ok: false, error: "phone_required", message: "رقم الهاتف غير صالح" },
        400,
        request,
      );
    }
    if (!governorate) {
      return json(
        {
          ok: false,
          error: "governorate_required",
          message: "يرجى اختيار المحافظة",
        },
        400,
        request,
      );
    }
    if (!items.length) {
      return json(
        { ok: false, error: "empty_cart", message: "السلة فارغة" },
        400,
        request,
      );
    }
    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return json(
        {
          ok: false,
          error: "payment_required",
          message: "يرجى اختيار طريقة الدفع",
        },
        400,
        request,
      );
    }

    const currency = String(items[0]?.currency || body?.currency || "JOD");
    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.price || 0) * Math.max(1, Number(item.quantity) || 1),
      0,
    );
    const count = items.reduce(
      (sum, item) => sum + Math.max(1, Number(item.quantity) || 1),
      0,
    );

    const orderId = createOrderId();
    const payLabel = paymentLabelAr(paymentMethod);
    const payload = {
      orderId,
      customer: { name, phone, governorate, address },
      paymentMethod,
      paymentLabel: payLabel,
      items: items.map((item) => ({
        productId: item.productId || null,
        productTitle: item.productTitle || item.title || "منتج",
        handle: item.handle || null,
        image: item.image || null,
        url: item.url || null,
        variantId: item.variantId || null,
        variantTitle: item.variantTitle || null,
        price: String(item.price ?? ""),
        currency: item.currency || currency,
        quantity: Math.max(1, Number(item.quantity) || 1),
      })),
      totals: {
        subtotal: subtotal.toFixed(2),
        currency,
        count,
      },
      note: note || null,
      source: "enarte-mobile",
      shop: body?.shop || process.env.ASSISTANT_DEFAULT_SHOP || null,
    };

    let shopify = { ok: false, skipped: true, reason: "not_attempted" };
    try {
      shopify = await createShopifyDraftOrder(payload);
    } catch (err) {
      console.error("[orders] shopify draft failed", err);
      shopify = {
        ok: false,
        reason: err?.message || "shopify_exception",
      };
    }

    const email = await sendOrderEmail({
      ...payload,
      shopifyDraftName: shopify.draftOrderName || null,
      shopifyDraftId: shopify.draftOrderId || null,
    });

    console.info("[orders] received", {
      orderId,
      name,
      phone,
      governorate,
      paymentMethod,
      items: items.length,
      shopifyOk: shopify.ok,
      shopifyReason: shopify.reason || null,
      draftName: shopify.draftOrderName || null,
      emailOk: email.ok,
      emailSkipped: email.skipped,
    });

    // Shopify draft is the primary store destination; email is optional when SMTP is set.
    if (!shopify.ok && !(email.ok && !email.skipped)) {
      return json(
        {
          ok: false,
          error: "order_delivery_failed",
          message:
            "تعذر تسجيل الطلب في المتجر حالياً. يرجى المحاولة بعد قليل.",
          shopify: {
            ok: false,
            reason: shopify.reason || null,
            errors: shopify.errors || null,
          },
          email: {
            ok: Boolean(email.ok),
            skipped: Boolean(email.skipped),
            reason: email.reason || null,
          },
        },
        503,
        request,
      );
    }

    return json(
      {
        ok: true,
        orderId,
        paymentMethod,
        paymentLabel: payLabel,
        customerMessage: CUSTOMER_ACK_AR,
        shopify: {
          ok: Boolean(shopify.ok),
          draftOrderId: shopify.draftOrderId || null,
          draftOrderName: shopify.draftOrderName || null,
          reason: shopify.reason || null,
        },
        email: {
          ok: Boolean(email.ok),
          skipped: Boolean(email.skipped),
          to: email.to,
          reason: email.reason || null,
        },
        next: {
          canContinueToPayment: paymentMethod === "online",
          messageAr: CUSTOMER_ACK_AR,
        },
      },
      200,
      request,
    );
  } catch (error) {
    console.error("[orders] failed", error);
    return json(
      {
        ok: false,
        error: "order_failed",
        message: error?.message || "تعذر إرسال الطلب",
      },
      500,
      request,
    );
  }
}
