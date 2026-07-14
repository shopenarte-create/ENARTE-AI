/**
 * Verify live assistant entry fix without Prisma.
 * Unlocks storefront via Shopify CLI stored password, checks theme brand.js + CTA markup.
 * Does not print secrets.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SHOP = "enarte-ai-dev.myshopify.com";

function loadStorePassword() {
  const file = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
    "shopify-cli-theme-store-password-nodejs/Config/config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const nested = raw?.["enarte-ai-dev"]?.myshopify?.com;
  if (typeof nested === "string" && nested.length) return nested;
  throw new Error("STORE_PASSWORD_NOT_FOUND");
}

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

const cookieJar = path.join(os.tmpdir(), `enarte-entry-verify-${Date.now()}.txt`);
const password = loadStorePassword();
const pwHtml = curl(["-s", "-c", cookieJar, "-b", cookieJar, `https://${SHOP}/password`]);
const tokenMatch = pwHtml.match(
  /name="authenticity_token"[^>]*value="([^"]+)"/,
);
if (!tokenMatch) throw new Error("NO_AUTH_TOKEN");

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
  `authenticity_token=${tokenMatch[1]}`,
  "--data-urlencode",
  `password=${password}`,
  "--data-urlencode",
  "form_type=storefront_password",
  "-o",
  "NUL",
]);

const bust = Date.now();
const homeFile = path.join(root, ".runtime-home-unlocked.html");
curl([
  "-s",
  "-L",
  "-b",
  cookieJar,
  "-c",
  cookieJar,
  "-H",
  "Cache-Control: no-cache",
  `https://${SHOP}/?v=${bust}`,
  "-o",
  homeFile,
]);
const homeHtml = fs.readFileSync(homeFile, "utf8");

const brandMatch = homeHtml.match(
  /\/\/cdn\.shopify\.com\/[^"']+enarte-brand\.js(\?v=[^"']+)?/,
);
const brandUrl = brandMatch ? `https:${brandMatch[0]}` : null;
let brandJs = "";
if (brandUrl) {
  const brandFile = path.join(root, ".runtime-brand-live.js");
  curl([
    "-s",
    "-H",
    "Cache-Control: no-cache",
    `${brandUrl}${brandUrl.includes("?") ? "&" : "?"}cb=${bust}`,
    "-o",
    brandFile,
  ]);
  brandJs = fs.readFileSync(brandFile, "utf8");
}

const tryMatch = homeHtml.match(
  /https:\/\/cdn\.shopify\.com\/extensions\/[^"']+enarte-try\.js/,
);
let tryJs = "";
if (tryMatch) {
  const tryFile = path.join(root, ".runtime-try-live.js");
  curl([
    "-s",
    "-H",
    "Cache-Control: no-cache",
    `${tryMatch[0]}?cb=${bust}`,
    "-o",
    tryFile,
  ]);
  tryJs = fs.readFileSync(tryFile, "utf8");
}

const assistantProbe = path.join(root, ".runtime-assistant-proxy.html");
curl([
  "-s",
  "-L",
  "-b",
  cookieJar,
  "-c",
  cookieJar,
  "-H",
  "Cache-Control: no-cache",
  `https://${SHOP}/apps/enarte-ai/assistant?locale=en&v=${bust}`,
  "-o",
  assistantProbe,
  "-w",
  "%{http_code} %{url_effective}\n",
]);
const assistantHtml = fs.readFileSync(assistantProbe, "utf8");

const report = {
  homeUnlocked: !/This store is password protected/i.test(homeHtml),
  hasHomeEntry: homeHtml.includes('data-enarte-entry="home"'),
  hasOpenHomeTryCta: homeHtml.includes("data-enarte-open-home-try"),
  brandUrl,
  brandHasOpenAssistantChat: brandJs.includes("openAssistantChat"),
  brandHasCaptureIntercept: brandJs.includes("stopImmediatePropagation"),
  extensionTryUrl: tryMatch?.[0] || null,
  extensionHasOpenAssistantChat: tryJs.includes("openAssistantChat"),
  extensionHomeSkipsCamera:
    tryJs.includes("openAssistantChat") &&
    /isHomeEntry\(root\)[\s\S]{0,180}openAssistantChat/.test(tryJs),
  assistantProxy: {
    hasEaShell: /class=["']ea-shell["']/.test(assistantHtml),
    hasAiAssistant: /AI Assistant/.test(assistantHtml),
    hasCameraChooser: /enarte-try-chooser|Take Photo|getUserMedia/.test(
      assistantHtml,
    ),
    hasPasswordWall: /This store is password protected/i.test(assistantHtml),
    size: assistantHtml.length,
  },
};

report.ok =
  report.homeUnlocked &&
  report.hasHomeEntry &&
  report.brandHasOpenAssistantChat &&
  report.brandHasCaptureIntercept;

fs.writeFileSync(
  path.join(root, ".runtime-assistant-entry-verify.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
