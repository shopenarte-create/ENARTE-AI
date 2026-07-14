/**
 * Verify جربها الآن on lighting product pages + full try handoff.
 * Usage: node --env-file=.env scripts/e2e-try-now-storefront.mjs
 */
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SHOP = "enarte-ai-dev.myshopify.com";
const TUNNEL = (
  process.env.ENARTE_TUNNEL_URL ||
  fs.readFileSync(".preview-url.txt", "utf8")
)
  .trim()
  .replace(/\/$/, "");

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function storePassword() {
  const cfg = JSON.parse(
    fs.readFileSync(
      path.join(
        os.homedir(),
        "AppData",
        "Roaming",
        "shopify-cli-theme-store-password-nodejs",
        "Config",
        "config.json",
      ),
      "utf8",
    ),
  );
  return cfg["enarte-ai-dev"].myshopify.com;
}

const cookieJar = path.join(os.tmpdir(), `enarte-e2e-${Date.now()}.txt`);
const pw = storePassword();
curl(["-s", "-c", cookieJar, "-b", cookieJar, `https://${SHOP}/password`]);
curl([
  "-s",
  "-c",
  cookieJar,
  "-b",
  cookieJar,
  "-X",
  "POST",
  `https://${SHOP}/password`,
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "--data-urlencode",
  `password=${pw}`,
  "--data-urlencode",
  "form_type=storefront_password",
]);

const productsJson = curl([
  "-s",
  "-b",
  cookieJar,
  `https://${SHOP}/products.json?limit=250`,
]);
const products = JSON.parse(productsJson).products || [];
const lighting = products.filter((p) => {
  const hay = `${p.title} ${(p.product_type || "")} ${(p.tags || []).join(" ")}`.toLowerCase();
  return (
    /led|chandelier|ثريا|إنارة|انارة|ابليك|أبليك|نجف|سقف|wall|pendant|chandelier|light/.test(
      hay,
    ) ||
    /led|chandelier|lighting/.test(String(p.product_type || "").toLowerCase())
  );
});

console.log(
  JSON.stringify({
    tunnel: TUNNEL,
    totalProducts: products.length,
    lightingCount: lighting.length,
    titles: lighting.map((p) => p.handle),
  }),
);

const results = [];
for (const p of lighting) {
  const url = `https://${SHOP}/products/${encodeURIComponent(p.handle)}?cb=${Date.now()}`;
  const html = curl(["-s", "-b", cookieJar, url]);
  const hasButton =
    html.includes("جربها الآن") || html.includes("data-enarte-try");
  const urls = [...html.matchAll(/data-app-url="([^"]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(urls)];
  const jsMatch = html.match(
    /https:\/\/cdn\.shopify\.com\/extensions\/[^"']+\/assets\/enarte-try\.js/,
  );
  let forced = null;
  if (jsMatch) {
    const js = curl(["-s", jsMatch[0] + `?cb=${Date.now()}`]);
    forced = (js.match(/FORCED_APP_URL\s*=\s*"([^"]*)"/) || [])[1] || null;
  }
  const ok =
    hasButton &&
    forced === TUNNEL &&
    (unique.length === 0 || unique.every((u) => u === TUNNEL));
  results.push({
    handle: p.handle,
    title: p.title,
    hasButton,
    dataAppUrls: unique,
    forced,
    ok,
  });
  console.log(
    ok ? "OK" : "FAIL",
    p.handle,
    "btn=" + hasButton,
    "forced=" + forced,
    "urls=" + JSON.stringify(unique),
  );
}

const fail = results.filter((r) => !r.ok);
console.log(
  JSON.stringify({
    checked: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: fail.map((f) => f.handle),
  }),
);

if (fail.length) process.exitCode = 1;
