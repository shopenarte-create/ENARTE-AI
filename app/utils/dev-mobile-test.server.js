import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOP = "enarte-ai-dev.myshopify.com";
const DEFAULT_NEXT =
  "/products/%D8%AB%D8%B1%D9%8A%D8%A7-%D8%A8%D8%A7%D8%A8%D9%84%D8%B2-%D9%82%D9%88%D8%B3-led-%D9%85%D9%88%D8%AF%D8%B1%D9%86";

function loadStorePassword() {
  if (process.env.STOREFRONT_PASSWORD) {
    return process.env.STOREFRONT_PASSWORD.trim();
  }
  try {
    const file = path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
      "shopify-cli-theme-store-password-nodejs/Config/config.json",
    );
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const nested = raw?.["enarte-ai-dev"]?.myshopify?.com;
    if (typeof nested === "string" && nested.length) return nested;
  } catch {
    /* ignore */
  }
  return "";
}

function sanitizeNext(raw) {
  const value = String(raw || "").trim();
  if (!value.startsWith("/")) return DEFAULT_NEXT;
  if (value.startsWith("//") || value.includes("://")) return DEFAULT_NEXT;
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function handleDevMobileTestLoader({ request }) {
  const password = loadStorePassword();
  const url = new URL(request.url);
  const nextPath = sanitizeNext(url.searchParams.get("next") || DEFAULT_NEXT);
  const productUrl = `https://${SHOP}${nextPath}`;
  const passwordAction = `https://${SHOP}/password`;

  if (!password) {
    return new Response(
      `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ENARTE unlock</title></head>
      <body style="font-family:system-ui,sans-serif;padding:24px;background:#f4f6f8">
        <h1>تعذر فتح المتجر تلقائياً</h1>
        <p>أضف <code>STOREFRONT_PASSWORD</code> إلى البيئة أو سجّل دخول Shopify CLI للثيم مرة واحدة.</p>
        <p><a href="${escapeHtml(productUrl)}">فتح صفحة المنتج يدوياً</a></p>
      </body></html>`,
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>فتح متجر ENARTE للاختبار</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(160deg,#eef3f8,#f7f1e8);color:#1c2430}
    .card{width:min(420px,92vw);padding:28px 22px;border-radius:18px;background:rgba(255,255,255,.92);
      box-shadow:0 18px 50px rgba(28,36,48,.12);text-align:center}
    .spin{width:36px;height:36px;margin:0 auto 14px;border-radius:50%;border:3px solid #c5ced9;border-top-color:#9a7b3c;
      animation:s .8s linear infinite}
    @keyframes s{to{transform:rotate(360deg)}}
    h1{margin:0 0 8px;font-size:1.25rem}
    p{margin:0;color:#5b6573;font-size:.95rem;line-height:1.5}
    button{margin-top:18px;width:100%;padding:14px 16px;border:0;border-radius:12px;font-size:1rem;font-weight:700;
      background:linear-gradient(135deg,#c4a35a,#9a7b3c);color:#1c1914;cursor:pointer}
    iframe{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="spin" aria-hidden="true"></div>
    <h1>جاري فتح المتجر…</h1>
    <p>لن تحتاج إدخال كلمة المرور في كل مرة على هذا الجهاز بعد فتح الرابط مرة واحدة.</p>
    <form id="unlock" method="post" action="${escapeHtml(passwordAction)}" target="enarte_unlock_frame">
      <input type="hidden" name="utf8" value="✓">
      <input type="hidden" name="form_type" value="storefront_password">
      <input type="hidden" name="password" value="${escapeHtml(password)}">
      <button type="submit" id="manual">متابعة يدوياً</button>
    </form>
  </div>
  <iframe name="enarte_unlock_frame" title="unlock"></iframe>
  <script>
    (function () {
      var productUrl = ${JSON.stringify(productUrl)};
      var form = document.getElementById("unlock");
      var frame = document.querySelector('iframe[name="enarte_unlock_frame"]');
      var done = false;
      function go() {
        if (done) return;
        done = true;
        window.location.replace(productUrl);
      }
      frame.addEventListener("load", function () {
        setTimeout(go, 250);
      });
      setTimeout(go, 1800);
      try { form.submit(); } catch (e) {}
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
