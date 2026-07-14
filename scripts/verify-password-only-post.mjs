/**
 * Test whether browser-style form POST without session cookie unlocks storefront.
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

// Simulate fresh browser: no prior cookies, POST password only.
const unlock = await fetch(`https://${SHOP}/password`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    password,
    form_type: "storefront_password",
    utf8: "✓",
  }),
  redirect: "manual",
});
const jar = cookiesFrom(unlock);
const product = await fetch(`https://${SHOP}${PRODUCT}`, {
  headers: jar ? { Cookie: jar } : {},
  redirect: "follow",
});
const html = await product.text();
console.log(
  JSON.stringify({
    unlockStatus: unlock.status,
    location: unlock.headers.get("location"),
    cookieNames: jar
      ? jar.split("; ").map((c) => c.split("=")[0])
      : [],
    productOk:
      !html.includes("Are you the store owner") &&
      html.includes("data-enarte-try-button"),
    title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || null,
  }),
);
