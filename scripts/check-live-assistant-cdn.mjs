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
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return raw["enarte-ai-dev"].myshopify.com;
}

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
}

const jar = path.join(os.tmpdir(), `enarte-cdn-check-${Date.now()}.txt`);
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
const homeFile = path.join(root, ".runtime-home-fresh.html");
curl([
  "-s",
  "-L",
  "-b",
  jar,
  "-H",
  "Cache-Control: no-cache",
  `https://${SHOP}/?nocache=${bust}`,
  "-o",
  homeFile,
]);
const html = fs.readFileSync(homeFile, "utf8");

const boots = [
  ...html.matchAll(
    /https:\/\/cdn\.shopify\.com\/extensions\/[^"']+enarte-boot\.js[^"']*/g,
  ),
].map((m) => m[0]);
const brands = [
  ...html.matchAll(/\/\/cdn\.shopify\.com\/[^"']*enarte-brand\.js[^"']*/g),
].map((m) => "https:" + m[0]);
const brands2 = [
  ...html.matchAll(/https:\/\/cdn\.shopify\.com\/[^"']*enarte-brand\.js[^"']*/g),
].map((m) => m[0]);

const bootUrl = [...new Set(boots)][0] || null;
const brandUrl = [...new Set([...brands, ...brands2])][0] || null;
const tryUrl = bootUrl
  ? bootUrl.replace(/enarte-boot\.js.*$/, "enarte-try.js")
  : null;

let tryJs = "";
let brandJs = "";
if (tryUrl) {
  const f = path.join(root, ".runtime-cdn-try-fresh.js");
  curl(["-s", `${tryUrl}?v=${bust}`, "-o", f]);
  tryJs = fs.readFileSync(f, "utf8");
}
if (brandUrl) {
  const f = path.join(root, ".runtime-cdn-brand-fresh.js");
  curl(["-s", `${brandUrl}${brandUrl.includes("?") ? "&" : "?"}v=${bust}`, "-o", f]);
  brandJs = fs.readFileSync(f, "utf8");
}

const assistantFile = path.join(root, ".runtime-assistant-fresh.html");
const assistantMeta = curl([
  "-s",
  "-L",
  "-b",
  jar,
  "-w",
  "\n%{http_code} %{url_effective}",
  `https://${SHOP}/apps/enarte-ai/assistant?locale=en&v=${bust}`,
  "-o",
  assistantFile,
]);
const assistantHtml = fs.readFileSync(assistantFile, "utf8");

const report = {
  bootUrl,
  tryUrl,
  brandUrl,
  tryJs: {
    size: tryJs.length,
    hasOpenAssistantChat: tryJs.includes("openAssistantChat"),
    homeOpensAssistant:
      /isHomeEntry\(root\)[\s\S]{0,220}openAssistantChat/.test(tryJs),
    onActivateStillOpensSheetFirst:
      /function onActivate\([\s\S]{0,260}openSheet/.test(tryJs) &&
      !/function onActivate\([\s\S]{0,260}isHomeEntry/.test(tryJs),
  },
  brandJs: {
    size: brandJs.length,
    hasOpenAssistantChat: brandJs.includes("openAssistantChat"),
  },
  assistant: {
    meta: assistantMeta.trim().split("\n").pop(),
    hasEaShell: assistantHtml.includes("ea-shell"),
    hasAiAssistantTitle: /AI Assistant/.test(assistantHtml),
    looksLikeTheme:
      /og:site_name|theme-color|shopify-section/.test(assistantHtml) &&
      !assistantHtml.includes("ea-shell"),
    size: assistantHtml.length,
  },
};

report.ok =
  report.tryJs.hasOpenAssistantChat && report.tryJs.homeOpensAssistant;

fs.writeFileSync(
  path.join(root, ".runtime-assistant-entry-verify.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
