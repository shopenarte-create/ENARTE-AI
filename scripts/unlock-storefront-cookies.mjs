/**
 * Unlock storefront and write only cookie header to a temp file (no password print).
 * Then print paths used for verification.
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
  return JSON.parse(fs.readFileSync(file, "utf8"))["enarte-ai-dev"].myshopify
    .com;
}

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

const jar = path.join(root, ".runtime-sf-cookies.txt");
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

const cookieLine = fs
  .readFileSync(jar, "utf8")
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const cols = l.split("\t");
    return { name: cols[5], value: cols[6], domain: cols[0] };
  })
  .filter((c) => c.name && c.value);

fs.writeFileSync(
  path.join(root, ".runtime-sf-cookie-json.json"),
  JSON.stringify(cookieLine),
);

const home = path.join(root, ".runtime-home-guard-check.html");
curl([
  "-s",
  "-L",
  "-b",
  jar,
  `https://${SHOP}/?check=${Date.now()}`,
  "-o",
  home,
]);
const html = fs.readFileSync(home, "utf8");
console.log(
  JSON.stringify({
    cookies: cookieLine.length,
    hasGuard: html.includes("ENARTE AI Assistant entry guard"),
    hasBrand: html.includes("enarte-brand.js"),
    hasOpenAssistant: html.includes("openAssistantChat") || html.includes("/apps/enarte-ai/assistant"),
  }),
);
