/**
 * Create Shopify draft orders for mobile COD / CliQ / online leads,
 * then complete them so they appear under Orders (payment pending).
 */

import { unauthenticated, sessionStorage } from "../../shopify.server.js";
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
  if (raw.startsWith("gid://shopify/ProductVariant/")) return raw;
  // Ignore product GIDs mistaken for variants.
  if (raw.startsWith("gid://shopify/Product/")) return null;
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

const DRAFT_ORDER_COMPLETE = `#graphql
  mutation MobileDraftOrderComplete($id: ID!) {
    draftOrderComplete(id: $id, paymentPending: true) {
      draftOrder {
        id
        name
        order {
          id
          name
          displayFinancialStatus
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function buildLineItems(items, { forceCustom = false } = {}) {
  return (items || [])
    .map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const variantId = forceCustom
        ? null
        : toVariantGid(item.variantId || item.variantNumericId);

      if (variantId) {
        return { variantId, quantity };
      }

      const titleParts = [
        item.productTitle || item.title || "منتج ENARTE",
        item.variantTitle && item.variantTitle !== "Default Title"
          ? `(${item.variantTitle})`
          : null,
      ].filter(Boolean);

      const price = Number(item.price);
      const originalUnitPrice = Number.isFinite(price)
        ? price.toFixed(2)
        : String(item.price || "0");

      return {
        title: titleParts.join(" "),
        quantity,
        originalUnitPrice,
        customAttributes: [
          item.handle
            ? { key: "handle", value: String(item.handle) }
            : null,
          item.productId
            ? { key: "product_id", value: String(item.productId) }
            : null,
          item.variantId
            ? { key: "variant_id", value: String(item.variantId) }
            : null,
        ].filter(Boolean),
      };
    })
    .filter(Boolean);
}

function buildDraftInput(payload, lineItems, payLabel, firstName, lastName) {
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

  return {
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
  };
}

async function createDraft(admin, input) {
  const response = await admin.graphql(DRAFT_ORDER_MUTATION, {
    variables: { input },
  });
  const json = await response.json();
  return {
    json,
    draft: json?.data?.draftOrderCreate?.draftOrder || null,
    userErrors: json?.data?.draftOrderCreate?.userErrors || [],
  };
}

async function completeDraft(admin, draftId) {
  const response = await admin.graphql(DRAFT_ORDER_COMPLETE, {
    variables: { id: draftId },
  });
  const json = await response.json();
  const node = json?.data?.draftOrderComplete;
  return {
    json,
    order: node?.draftOrder?.order || null,
    userErrors: node?.userErrors || [],
  };
}

/**
 * @param {{
 *   orderId: string,
 *   customer: { name: string, phone: string, governorate: string, address?: string },
 *   items: Array<{ variantId?: string, variantNumericId?: string, productTitle?: string, variantTitle?: string, quantity?: number, price?: string }>,
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

  let lineItems = buildLineItems(payload.items, { forceCustom: false });
  if (!lineItems.length) {
    lineItems = buildLineItems(payload.items, { forceCustom: true });
  }
  if (!lineItems.length) {
    return {
      ok: false,
      skipped: true,
      reason: "no_line_items",
      shop,
    };
  }

  let { json, draft, userErrors } = await createDraft(
    admin,
    buildDraftInput(payload, lineItems, payLabel, firstName, lastName),
  );

  // Variant unavailable / invalid → retry as custom priced lines so the lead still lands.
  const variantFailed =
    !draft?.id &&
    userErrors.some((e) =>
      /available|variant|product|inventory|not found/i.test(
        String(e?.message || ""),
      ),
    );
  if (variantFailed) {
    lineItems = buildLineItems(payload.items, { forceCustom: true });
    ({ json, draft, userErrors } = await createDraft(
      admin,
      buildDraftInput(payload, lineItems, payLabel, firstName, lastName),
    ));
  }

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

  // Complete → real order under Shopify Orders (payment pending for COD/CliQ).
  let orderId = null;
  let orderName = null;
  let completeErrors = [];
  try {
    const completed = await completeDraft(admin, draft.id);
    if (completed.json?.errors?.length) {
      completeErrors = completed.json.errors.map((e) => e.message || String(e));
    } else if (completed.userErrors.length) {
      completeErrors = completed.userErrors.map((e) => e.message);
    } else if (completed.order?.id) {
      orderId = completed.order.id;
      orderName = completed.order.name || null;
    }
  } catch (err) {
    completeErrors = [err?.message || "complete_failed"];
  }

  return {
    ok: true,
    shop,
    draftOrderId: draft.id,
    draftOrderName: draft.name,
    draftStatus: draft.status,
    invoiceUrl: draft.invoiceUrl || null,
    orderId,
    orderName,
    completed: Boolean(orderId),
    completeErrors: completeErrors.length ? completeErrors : null,
  };
}
