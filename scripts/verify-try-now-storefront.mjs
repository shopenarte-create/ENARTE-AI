/**
 * Unlock password-protected storefront and verify ENARTE try-now markup.
 * Does not print the store password.
 */
import fs from "fs";
import path from "path";
import os from "os";

const SHOP = "enarte-ai-dev.myshopify.com";
const PRODUCT_PATH =
  "/products/%D8%A3%D8%A8%D9%84%D9%8A%D9%83-%D8%A8%D8%B1%D8%A7%D8%B3-%D8%A2%D8%B1%D8%AA-led";

function loadStorePassword() {
  const file = path.join(
    process.env.APPDATA || "",
    "shopify-cli-theme-store-password-nodejs",
    "Config",
    "config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  // Nested keys from CLI: { "enarte-ai-dev": { myshopify: { com: "..." } } }
  const nested = raw?.["enarte-ai-dev"]?.myshopify?.com;
  if (typeof nested === "string" && nested.length > 0) return nested;
  throw new Error("STORE_PASSWORD_NOT_FOUND");
}

function extractCookie(res) {
  const raw = res.headers.getSetCookie?.() || [];
  if (raw.length) {
    return raw.map((c) => c.split(";")[0]).join("; ");
  }
  const single = res.headers.get("set-cookie");
  return single ? single.split(",").map((c) => c.split(";")[0].trim()).join("; ") : "";
}

const password = loadStorePassword();
console.log("password_loaded", true);

const pwPage = await fetch(`https://${SHOP}/password`);
const pwHtml = await pwPage.text();
const tokenMatch = pwHtml.match(
  /name="authenticity_token"[^>]*value="([^"]+)"/,
);
if (!tokenMatch) throw new Error("NO_AUTHENTICITY_TOKEN");
const authenticity_token = tokenMatch[1];

const body = new URLSearchParams({
  authenticity_token,
  password,
});

const unlock = await fetch(`https://${SHOP}/password`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: extractCookie(pwPage),
  },
  body,
  redirect: "manual",
});

const unlockCookie = [extractCookie(pwPage), extractCookie(unlock)]
  .filter(Boolean)
  .join("; ");
console.log("unlock_status", unlock.status);
console.log("has_storefront_digest", unlockCookie.includes("storefront_digest"));

const productRes = await fetch(`https://${SHOP}${PRODUCT_PATH}`, {
  headers: { Cookie: unlockCookie },
  redirect: "follow",
});
const html = await productRes.text();
console.log("product_status", productRes.status);
console.log("product_url_final", productRes.url);
console.log("html_len", html.length);
console.log("is_password_page", /name="password"/.test(html) && html.length < 20000);
console.log("has_enarte_root", /data-enarte-try-root/.test(html));
console.log("has_enarte_button", /data-enarte-try-button/.test(html));
console.log("has_arabic_label", /جربها الآن/.test(html));
console.log("enarte_root_count", (html.match(/data-enarte-try-root/g) || []).length);
console.log("title", (html.match(/<title>(.*?)<\/title>/i) || [])[1] || "");

// Save cookie jar for browser use (digest only)
const digest = unlockCookie
  .split(";")
  .map((c) => c.trim())
  .find((c) => c.startsWith("storefront_digest="));
if (digest) {
  fs.writeFileSync(
    path.join(os.tmpdir(), "enarte-storefront-digest.txt"),
    digest,
    "utf8",
  );
  console.log("digest_saved", true);
}

if (!/data-enarte-try-button/.test(html) || !/جربها الآن/.test(html)) {
  // Dump a small snippet around enarte if present
  const idx = html.indexOf("enarte");
  if (idx >= 0) {
    console.log("enarte_snippet", html.slice(Math.max(0, idx - 80), idx + 200));
  } else {
    console.log("enarte_snippet", "NONE");
  }
  process.exitCode = 2;
} else {
  console.log("BUTTON_VISIBLE_OK");
}
