import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SHOP = "enarte-ai-dev.myshopify.com";
const cfg = JSON.parse(
  fs.readFileSync(
    path.join(
      os.homedir(),
      "AppData/Roaming/shopify-cli-theme-store-password-nodejs/Config/config.json",
    ),
    "utf8",
  ),
);
const pw = cfg["enarte-ai-dev"].myshopify.com;
const jar = path.join(os.tmpdir(), "enarte-ux-cookies.txt");
const curl = (a) =>
  execFileSync("curl.exe", a, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });

curl(["-s", "-c", jar, "-b", jar, `https://${SHOP}/password`]);
curl([
  "-s",
  "-c",
  jar,
  "-b",
  jar,
  "-X",
  "POST",
  `https://${SHOP}/password`,
  "--data-urlencode",
  `password=${pw}`,
  "--data-urlencode",
  "form_type=storefront_password",
]);
const html = curl([
  "-s",
  "-b",
  jar,
  `https://${SHOP}/products/${encodeURIComponent("ثريا-بابلز-قوس-led-مودرن")}?cb=1`,
]);

const markers = [
  "Buy it now",
  "shopify-payment-button",
  "product-form",
  "add-to-cart",
  "enarte-try",
];
for (const m of markers) {
  console.log(m, html.indexOf(m));
}

const idx = Math.max(
  html.indexOf("shopify-payment-button"),
  html.toLowerCase().indexOf("buy it now"),
);
const slice = html.slice(Math.max(0, idx - 1500), idx + 2000);
fs.mkdirSync("tmp", { recursive: true });
fs.writeFileSync("tmp/buy-snippet.html", slice);

const classHits = [
  ...html.matchAll(
    /class="([^"]*(?:buy|payment|product-form|add-to-cart|accelerated)[^"]*)"/gi,
  ),
].map((m) => m[1]);
console.log("classes", [...new Set(classHits)].slice(0, 40));

const enarteBlocks = [...html.matchAll(/class="([^"]*enarte[^"]*)"/gi)].map(
  (m) => m[1],
);
console.log("enarte", [...new Set(enarteBlocks)]);
