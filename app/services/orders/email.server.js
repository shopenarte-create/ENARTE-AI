/**
 * Order notification email (store inbox).
 * Configure via env:
 *   ORDER_NOTIFY_TO=shopenarte@gmail.com
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_USER=...
 *   SMTP_PASS=... (Gmail App Password)
 */

import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";

export const DEFAULT_ORDER_NOTIFY_TO = "shopenarte@gmail.com";

export function createOrderId() {
  return `EN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const PAYMENT_LABELS_AR = {
  cod: "الدفع عند الاستلام",
  cliq: "الدفع عبر كليك (CliQ) — 00962782404023 — الحساب باسم: لانا عماد عطاالله",
  online: "الدفع الإلكتروني",
};

export function paymentLabelAr(method) {
  return PAYMENT_LABELS_AR[method] || method || "غير محدد";
}

export function buildOrderEmail({
  orderId,
  customer,
  items,
  totals,
  note,
  paymentMethod,
  paymentLabel,
  shopifyDraftName,
  shopifyDraftId,
}) {
  const payLabel = paymentLabel || paymentLabelAr(paymentMethod);
  const shopifyLine = shopifyDraftName
    ? `مسودة شوبيفاي: ${shopifyDraftName}${shopifyDraftId ? ` (${shopifyDraftId})` : ""}`
    : shopifyDraftId
      ? `مسودة شوبيفاي: ${shopifyDraftId}`
      : "مسودة شوبيفاي: لم تُنشأ (تحقق من صلاحيات write_draft_orders)";
  const lines = (items || [])
    .map((item, i) => {
      const variant =
        item.variantTitle && item.variantTitle !== "Default Title"
          ? ` — المواصفات: ${item.variantTitle}`
          : "";
      return `${i + 1}) ${item.productTitle || item.title || "منتج"}${variant}
الكمية: ${item.quantity || 1}
السعر: ${item.price || "—"} ${item.currency || "JOD"}
${item.handle ? `رمز/رابط: ${item.handle}` : ""}
${item.image ? `صورة: ${item.image}` : ""}
${item.url ? `الرابط: ${item.url}` : ""}`;
    })
    .join("\n\n");

  const text = `طلب جديد من تطبيق ENARTE
رقم الطلب: ${orderId}

=== بيانات الزبون ===
الاسم: ${customer.name}
الهاتف: ${customer.phone}
المحافظة: ${customer.governorate}
${customer.address ? `تفاصيل العنوان: ${customer.address}` : ""}

=== طريقة الدفع ===
${payLabel}

=== شوبيفاي ===
${shopifyLine}

=== المنتجات ===
${lines}

=== المجموع ===
${totals.subtotal} ${totals.currency}
عدد القطع: ${totals.count}

${note ? `ملاحظات: ${note}` : ""}

---
تم الاستلام عبر تطبيق ENARTE Mobile
التاريخ: ${new Date().toLocaleString("ar-JO", { timeZone: "Asia/Amman" })}
`;

  const itemsHtml = (items || [])
    .map((item) => {
      const variant =
        item.variantTitle && item.variantTitle !== "Default Title"
          ? `<div style="color:#6b6560;font-size:13px">المواصفات المختارة: <b>${escapeHtml(item.variantTitle)}</b></div>`
          : "";
      const img = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="" width="96" height="96" style="object-fit:cover;border-radius:10px;border:1px solid #eee" />`
        : "";
      return `<tr>
        <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top">${img}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right">
          <div style="font-weight:700">${escapeHtml(item.productTitle || item.title || "منتج")}</div>
          ${variant}
          <div style="margin-top:6px">الكمية: ${escapeHtml(item.quantity || 1)}</div>
          <div style="color:#9a7b3c;font-weight:700">${escapeHtml(item.price || "—")} ${escapeHtml(item.currency || "JOD")}</div>
          ${item.url ? `<div style="font-size:12px;margin-top:4px"><a href="${escapeHtml(item.url)}">عرض المنتج</a></div>` : ""}
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<body style="font-family:Tahoma,Arial,sans-serif;background:#f7f3ec;padding:24px;color:#1c1914">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8dfd0">
    <div style="background:#1c1914;color:#c4a35a;padding:18px 20px;letter-spacing:4px;font-weight:700">ENARTE</div>
    <div style="padding:20px">
      <h2 style="margin:0 0 8px">طلب شراء جديد</h2>
      <p style="margin:0 0 16px;color:#6b6560">رقم الطلب: <b>${escapeHtml(orderId)}</b></p>

      <h3 style="margin:0 0 8px;color:#9a7b3c">بيانات الزبون</h3>
      <ul style="padding-right:18px;line-height:1.8;margin-top:0">
        <li>الاسم: <b>${escapeHtml(customer.name)}</b></li>
        <li>الهاتف: <b dir="ltr">${escapeHtml(customer.phone)}</b></li>
        <li>المحافظة: <b>${escapeHtml(customer.governorate)}</b></li>
        ${customer.address ? `<li>العنوان: ${escapeHtml(customer.address)}</li>` : ""}
      </ul>

      <h3 style="margin:18px 0 8px;color:#9a7b3c">طريقة الدفع</h3>
      <p style="margin:0 0 16px;padding:12px;background:#f7f3ec;border-radius:10px;font-weight:700">${escapeHtml(payLabel)}</p>
      <p style="margin:0 0 16px;color:#6b6560;font-size:13px">${escapeHtml(shopifyLine)}</p>

      <h3 style="margin:18px 0 8px;color:#9a7b3c">بطاقة المنتجات والمواصفات</h3>
      <table style="width:100%;border-collapse:collapse">${itemsHtml}</table>

      <div style="margin-top:18px;padding:14px;background:#f7f3ec;border-radius:12px">
        <div>المجموع: <b>${escapeHtml(totals.subtotal)} ${escapeHtml(totals.currency)}</b></div>
        <div>عدد القطع: <b>${escapeHtml(totals.count)}</b></div>
      </div>

      ${note ? `<p style="margin-top:16px"><b>ملاحظات:</b> ${escapeHtml(note)}</p>` : ""}
      <p style="margin-top:20px;font-size:12px;color:#6b6560">تاريخ الاستلام: ${escapeHtml(new Date().toLocaleString("ar-JO", { timeZone: "Asia/Amman" }))}</p>
    </div>
  </div>
</body>
</html>`;

  return { text, html, subject: `طلب ENARTE جديد ${orderId} — ${customer.name}` };
}

export function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );
}

export async function sendOrderEmail(payload) {
  const to =
    String(process.env.ORDER_NOTIFY_TO || DEFAULT_ORDER_NOTIFY_TO).trim() ||
    DEFAULT_ORDER_NOTIFY_TO;
  const { subject, text, html } = buildOrderEmail(payload);

  if (!smtpConfigured()) {
    console.warn("[orders] SMTP not configured — email skipped", {
      to,
      orderId: payload.orderId,
    });
    console.info("[orders] EMAIL_PREVIEW\n", text);
    return {
      ok: false,
      skipped: true,
      to,
      reason: "smtp_not_configured",
      subject,
      text,
    };
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465 || String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      `"ENARTE Orders" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });

  return {
    ok: true,
    skipped: false,
    to,
    messageId: info.messageId || null,
  };
}

/** Short WhatsApp text for store staff (fallback / parallel notify). */
export function buildStoreWhatsAppText(payload) {
  const items = (payload.items || [])
    .map(
      (item, i) =>
        `${i + 1}) ${item.productTitle}${
          item.variantTitle && item.variantTitle !== "Default Title"
            ? ` (${item.variantTitle})`
            : ""
        } ×${item.quantity} — ${item.price} ${item.currency || "JOD"}`,
    )
    .join("\n");
  const pay = paymentLabelAr(payload.paymentMethod);
  return `طلب تطبيق ENARTE ${payload.orderId}
الاسم: ${payload.customer.name}
الهاتف: ${payload.customer.phone}
المحافظة: ${payload.customer.governorate}
الدفع: ${pay}
${items}
المجموع: ${payload.totals.subtotal} ${payload.totals.currency}`;
}

export const CUSTOMER_ACK_AR =
  "لقد تم استلام طلبكم وسنبدأ التجهيز ونتواصل معكم للتسليم. شكراً لثقتكم بـ ENARTE.";
