/**
 * Probe which return_* fields Shopify honors after storefront unlock.
 * Does not print the store password.
 */
import fs from "fs";
import path from "path";
import os from "os";

const SHOP = "enarte-ai-dev.myshopify.com";
const RETURN = "/products/ثريا-بابلز-قوس-led-مودرن";

function loadStorePassword() {
  const file = path.join(
    process.env.APPDATA || "",
    "shopify-cli-theme-store-password-nodejs",
    "Config",
    "config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const nested = raw?.["enarte-ai-dev"]?.myshopify?.com;
  if (typeof nested === "string" && nested.length > 0) return nested;
  throw new Error("STORE_PASSWORD_NOT_FOUND");
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
const pwPage = await fetch(`https://${SHOP}/password`);
const pwHtml = await pwPage.text();
const token = (pwHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/) ||
  [])[1];
if (!token) throw new Error("NO_TOKEN");

const jar = cookiesFrom(pwPage);
const attempts = [
  { return_to: RETURN },
  { return_url: RETURN },
  { return_to: `https://${SHOP}${RETURN}` },
];

for (const extra of attempts) {
  const body = new URLSearchParams({
    authenticity_token: token,
    password,
    utf8: "✓",
    ...extra,
  });
  const res = await fetch(`https://${SHOP}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar,
    },
    body,
    redirect: "manual",
  });
  console.log(
    JSON.stringify({
      extra: Object.keys(extra)[0],
      status: res.status,
      location: res.headers.get("location"),
      hasDigest: cookiesFrom(res).includes("storefront_digest"),
    }),
  );
}
