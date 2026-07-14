/**
 * Confirm unlock cookies allow product HTML (no password wall).
 * Does not print secrets.
 */
import fs from "fs";
import path from "path";
import os from "os";

const SHOP = "enarte-ai-dev.myshopify.com";
const PRODUCT =
  "/products/%D8%AB%D8%B1%D9%8A%D8%A7-%D8%A8%D8%A7%D8%A8%D9%84%D8%B2-%D9%82%D9%88%D8%B3-led-%D9%85%D9%88%D8%AF%D8%B1%D9%86";

function loadStorePassword() {
  const file = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
    "shopify-cli-theme-store-password-nodejs/Config/config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return raw?.["enarte-ai-dev"]?.myshopify?.com;
}

function mergeCookies(...parts) {
  const map = new Map();
  for (const part of parts) {
    for (const piece of String(part || "").split(";")) {
      const trimmed = piece.trim();
      if (!trimmed || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function cookiesFrom(res) {
  const raw = res.headers.getSetCookie?.() || [];
  if (raw.length) return raw.map((c) => c.split(";")[0]).join("; ");
  const single = res.headers.get("set-cookie");
  return single
    ? single
        .split(",")
        .map((c) => c.split(";")[0].trim())
        .join("; ")
    : "";
}

const password = loadStorePassword();
const page = await fetch(`https://${SHOP}/password`);
const html = await page.text();
const token = (html.match(/name="authenticity_token"[^>]*value="([^"]+)"/) ||
  [])[1];
const jar1 = cookiesFrom(page);

const unlock = await fetch(`https://${SHOP}/password`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: jar1,
  },
  body: new URLSearchParams({ authenticity_token: token, password }),
  redirect: "manual",
});
const jar = mergeCookies(jar1, cookiesFrom(unlock));

const product = await fetch(`https://${SHOP}${PRODUCT}`, {
  headers: { Cookie: jar },
  redirect: "follow",
});
const productHtml = await product.text();

console.log(
  JSON.stringify({
    unlockStatus: unlock.status,
    location: unlock.headers.get("location"),
    cookieNames: jar.split("; ").map((c) => c.split("=")[0]),
    productStatus: product.status,
    finalUrl: product.url,
    isPasswordWall:
      productHtml.includes("Are you the store owner") ||
      (productHtml.includes('name="password"') && productHtml.length < 20000),
    hasTryButton: productHtml.includes("data-enarte-try-button"),
    title: (productHtml.match(/<title>([^<]*)<\/title>/i) || [])[1] || null,
  }),
);
