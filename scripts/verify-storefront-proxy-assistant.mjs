import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SHOP = "enarte-ai-dev.myshopify.com";

function loadStorePassword() {
  const file = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
    "shopify-cli-theme-store-password-nodejs/Config/config.json",
  );
  return JSON.parse(fs.readFileSync(file, "utf8"))["enarte-ai-dev"].myshopify
    .com;
}

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
}

const jar = path.join(os.tmpdir(), `enarte-proxy-${Date.now()}.txt`);
const password = loadStorePassword();
const pwHtml = curl(["-s", "-c", jar, "-b", jar, `https://${SHOP}/password`]);
const token = pwHtml.match(
  /name="authenticity_token"[^>]*value="([^"]+)"/,
)?.[1];
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
  `password=${password}`,
  "--data-urlencode",
  "form_type=storefront_password",
  "-o",
  "NUL",
]);

const bust = Date.now();
const home = path.join(root, ".runtime-proxy-home.html");
curl([
  "-s",
  "-L",
  "-b",
  jar,
  `https://${SHOP}/?v=${bust}`,
  "-o",
  home,
]);
const homeHtml = fs.readFileSync(home, "utf8");

const asst = path.join(root, ".runtime-proxy-assistant.html");
const meta = curl([
  "-s",
  "-L",
  "-b",
  jar,
  "-w",
  "\n%{http_code} %{url_effective}",
  `https://${SHOP}/apps/enarte-ai/assistant?shop=${SHOP}&locale=en&v=${bust}`,
  "-o",
  asst,
]);
const asstHtml = fs.readFileSync(asst, "utf8");

const report = {
  homeHasGuard: homeHtml.includes("ENARTE AI Assistant entry guard"),
  homeHasBrand: homeHtml.includes("enarte-brand.js"),
  assistantMeta: meta.trim().split("\n").pop(),
  assistantHasEaShell: asstHtml.includes("ea-shell"),
  assistantHasWelcomeShell: /AI Assistant/.test(asstHtml),
  assistantShopRequired: asstHtml.includes("shop_required"),
  assistantLooksLikeThemeError:
    asstHtml.includes("shopify-section") && !asstHtml.includes("ea-shell"),
};

report.ok = report.homeHasGuard && report.assistantHasEaShell;
fs.writeFileSync(
  path.join(root, ".runtime-proxy-verify.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
