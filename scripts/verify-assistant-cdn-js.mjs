import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SHOP = "enarte-ai-dev.myshopify.com";
const jar = path.join(os.tmpdir(), "enarte-home-check.txt");
const curl = (a) =>
  execFileSync("curl.exe", a, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });

const pw = JSON.parse(
  fs.readFileSync(
    path.join(
      process.env.APPDATA,
      "shopify-cli-theme-store-password-nodejs",
      "Config",
      "config.json",
    ),
    "utf8",
  ),
)["enarte-ai-dev"].myshopify.com;

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

const home = ".runtime-home-fresh.html";
curl(["-s", "-b", jar, "-L", "-o", home, `https://${SHOP}/?v=${Date.now()}`]);
const html = fs.readFileSync(home, "utf8");
const unique = [
  ...new Set(
    [...html.matchAll(/https:\/\/cdn\.shopify\.com\/extensions\/[^"']+enarte-try\.js[^"']*/g)].map(
      (m) => m[0],
    ),
  ),
];
console.log(
  JSON.stringify(
    {
      homeEmbed: /data-enarte-entry="home"/.test(html),
      jsUrls: unique.slice(0, 3),
    },
    null,
    2,
  ),
);

if (!unique[0]) process.exit(2);
const url = `${unique[0]}${unique[0].includes("?") ? "&" : "?"}cb=${Date.now()}`;
const text = await (await fetch(url)).text();
const openFn = (text.match(/function openAssistantChat\([\s\S]{0,400}\}/) || [])[0] || "";
const result = {
  jsLen: text.length,
  hasCameraLoading:
    /بدون فتح الكاميرا|Chat first — no camera|Starting ENARTE AI Assistant/i.test(
      text,
    ),
  openAssistantChat: openFn.replace(/\s+/g, " ").slice(0, 220),
  mentionsCameraInOpenAssistant: /كاميرا|camera/i.test(openFn),
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.hasCameraLoading || result.mentionsCameraInOpenAssistant ? 1 : 0);
