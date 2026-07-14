/**
 * Verify /apps/enarte-ai/assistant on the live storefront returns the chat UI
 * (not Shopify's third-party application error page).
 */
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SHOP = "enarte-ai-dev.myshopify.com";
const jar = path.join(os.tmpdir(), "enarte-asst-check.txt");
const out = ".runtime-assistant-proxy.html";

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

const pwStore = JSON.parse(
  fs.readFileSync(
    path.join(
      process.env.APPDATA,
      "shopify-cli-theme-store-password-nodejs",
      "Config",
      "config.json",
    ),
    "utf8",
  ),
);
const pw = pwStore["enarte-ai-dev"].myshopify.com;

const pwHtml = curl(["-s", "-c", jar, "-b", jar, `https://${SHOP}/password`]);
const token = (pwHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/) ||
  [])[1];
if (token) {
  curl([
    "-s",
    "-c",
    jar,
    "-b",
    jar,
    "-X",
    "POST",
    `https://${SHOP}/password`,
    "-H",
    "Content-Type: application/x-www-form-urlencoded",
    "--data-urlencode",
    `authenticity_token=${token}`,
    "--data-urlencode",
    `password=${pw}`,
    "--data-urlencode",
    "form_type=storefront_password",
    "-o",
    "NUL",
  ]);
}

const meta = curl([
  "-s",
  "-b",
  jar,
  "-c",
  jar,
  "-L",
  "-w",
  "%{http_code} %{url_effective}",
  "-o",
  out,
  `https://${SHOP}/apps/enarte-ai/assistant?shop=${SHOP}&locale=ar&v=${Date.now()}`,
]);
const html = fs.readFileSync(out, "utf8");
const checks = {
  meta,
  hasEaShell: html.includes("ea-shell") || html.includes("ea-panel"),
  hasBrand: /ENARTE/i.test(html),
  thirdPartyError: /third-party application/i.test(html),
  cameraLoading: /Chat first|بدون فتح الكاميرا|Starting ENARTE/i.test(html),
  title: (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || null,
  len: html.length,
  ok:
    !/third-party application/i.test(html) &&
    (html.includes("ea-shell") || html.includes("ea-panel")),
};
console.log(JSON.stringify(checks, null, 2));
fs.writeFileSync(".runtime-proxy-verify.json", JSON.stringify(checks, null, 2));
process.exit(checks.ok ? 0 : 1);
