/**
 * Create Shopify draft orders for mobile COD / CliQ / online leads.
 */

import { unauthenticated, sessionStorage } from "../shopify.server.js";
import { paymentLabelAr } from "./email.server.js";

const PREFERRED_SHOP =
  process.env.ASSISTANT_DEFAULT_SHOP ||
  process.env.SHOP ||
  "jb8xus-wn.myshopify.com";

function normalizeShop(shop) {
  const raw = String(shop || PREFERRED_SHOP)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!raw) return PREFERRED_SHOP;
  return raw.includes(".") ? raw : `${raw}.myshopify.com`;
}

function toVariantGid(variantId) {
  const raw = String(variantId || "").trim();
  if (!raw) return null;
  if (raw.startsWith("gid://")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return `gid://shopify/ProductVariant/${digits}`;
}

function splitName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: "Customer", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function getAdmin(shopHint) {
  const shop = normalizeShop(shopHint);
  try {
    if (sessionStorage?.findSessionsByShop) {
      const sessions = await sessionStorage.findSessionsByShop(shop);
      if (Array.isArray(sessions) && sessions.some((s) => s?.accessToken)) {
        return { ...(await unauthenticated.admin(shop)), shop };
      }
    }
  } catch {
    // fall through
  }
  try {
    return { ...(await unauthenticated.admin(shop)), shop };
  } catch {
    const { getClientCredentialsAdmin } = await import(
      "../shopify-admin-client-credentials.server.js"
    );
    return getClientCredentialsAdmin(shop);
  }
}

const DRAFT_ORDER_MUTATION = `#graphql
  mutation MobileDraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        status
        invoiceUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * @param {{
 *   orderId: string,
 *   customer: { name: string, phone: string, governorate: string, address?: string },
 *   items: Array<{ variantId?: string, productTitle?: string, variantTitle?: string, quantity?: number, price?: string }>,
 *   paymentMethod: string,
 *   paymentLabel?: string,
 *   note?: string | null,
 *   totals?: { subtotal?: string, currency?: string, count?: number },
 *   shop?: string | null,
 * }} payload
 */
export async function createShopifyDraftOrder(payload) {
  const { admin, shop } = await getAdmin(payload.shop);
  const { firstName, lastName } = splitName(payload.customer?.name);
  const payLabel =
    payload.paymentLabel || paymentLabelAr(payload.paymentMethod);

  const lineItems = (payload.items || [])
    .map((item) => {
      const variantId = toVariantGid(item.variantId);
      if (!variantId) return null;
      return {
        variantId,
        quantity: Math.max(1, Number(item.quantity) || 1),
      };
    })
    .filter(Boolean);

  if (!lineItems.length) {
    return {
      ok: false,
      skipped: true,
      reason: "no_variant_ids",
      shop,
    };
  }

  const noteParts = [
    `طلب تطبيق ENARTE ${payload.orderId}`,
    `طريقة الدفع: ${payLabel}`,
    `الهاتف: ${payload.customer?.phone || ""}`,
    `المحافظة: ${payload.customer?.governorate || ""}`,
    payload.customer?.address
      ? `العنوان: ${payload.customer.address}`
      : null,
    payload.note ? `ملاحظات الزبون: ${payload.note}` : null,
  ].filter(Boolean);

  const input = {
    note: noteParts.join("\n"),
    tags: ["enarte-mobile", `pay-${payload.paymentMethod || "unknown"}`],
    customAttributes: [
      { key: "enarte_order_id", value: String(payload.orderId) },
      { key: "payment_method", value: String(payload.paymentMethod || "") },
      { key: "payment_label", value: String(payLabel) },
      { key: "customer_phone", value: String(payload.customer?.phone || "") },
      {
        key: "governorate",
        value: String(payload.customer?.governorate || ""),
      },
    ],
    shippingAddress: {
      firstName,
      lastName,
      phone: payload.customer?.phone || "",
      city: payload.customer?.governorate || "",
      province: payload.customer?.governorate || "",
      countryCode: "JO",
      address1:
        payload.customer?.address ||
        payload.customer?.governorate ||
        "Jordan",
    },
    billingAddress: {
      firstName,
      lastName,
      phone: payload.customer?.phone || "",
      city: payload.customer?.governorate || "",
      province: payload.customer?.governorate || "",
      countryCode: "JO",
      address1:
        payload.customer?.address ||
        payload.customer?.governorate ||
        "Jordan",
    },
    lineItems,
    // Phone-only customers: leave email empty; merchant contacts via phone.
  };

  const response = await admin.graphql(DRAFT_ORDER_MUTATION, {
    variables: { input },
  });
  const json = await response.json();
  const payloadNode = json?.data?.draftOrderCreate;
  const userErrors = payloadNode?.userErrors || [];
  const draft = payloadNode?.draftOrder;

  if (json?.errors?.length) {
    return {
      ok: false,
      shop,
      reason: "graphql_errors",
      errors: json.errors.map((e) => e.message || String(e)),
    };
  }
  if (userErrors.length || !draft?.id) {
    return {
      ok: false,
      shop,
      reason: "user_errors",
      errors: userErrors.map((e) => e.message),
    };
  }

  return {
    ok: true,
    shop,
    draftOrderId: draft.id,
    draftOrderName: draft.name,
    draftStatus: draft.status,
    invoiceUrl: draft.invoiceUrl || null,
  };
}
