import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SHOP = process.env.ENARTE_SHOP || "enarte-ai-dev.myshopify.com";
const target =
  process.env.ENARTE_PROXY_PATH ||
  `/apps/enarte-ai/assistant?shop=${SHOP}&locale=en&v=${Date.now()}`;

function loadPassword() {
  const file = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
    "shopify-cli-theme-store-password-nodejs/Config/config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const nested = raw?.["enarte-ai-dev"]?.myshopify?.com;
  if (typeof nested === "string" && nested.length) return nested;
  if (process.env.STOREFRONT_PASSWORD) return process.env.STOREFRONT_PASSWORD;
  throw new Error("NO_PASSWORD");
}

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
}

const jar = path.join(os.tmpdir(), `enarte-probe-${Date.now()}.txt`);
const out = path.join(process.cwd(), ".runtime-proxy-probe.html");
const hdr = path.join(process.cwd(), ".runtime-proxy-probe-headers.txt");

const password = loadPassword();
const pwHtml = curl(["-s", "-c", jar, "-b", jar, `https://${SHOP}/password`]);
const token = pwHtml.match(
  /name="authenticity_token"[^>]*value="([^"]+)"/,
)?.[1];
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
    `password=${password}`,
    "--data-urlencode",
    "form_type=storefront_password",
    "-o",
    "NUL",
  ]);
}

const meta = curl([
  "-s",
  "-D",
  hdr,
  "-o",
  out,
  "-b",
  jar,
  "-c",
  jar,
  "-L",
  "--max-redirs",
  "5",
  "-w",
  "%{http_code} %{url_effective}",
  `https://${SHOP}${target}`,
]);

const html = fs.readFileSync(out, "utf8");
const headers = fs.readFileSync(hdr, "utf8");
const report = {
  meta,
  thirdPartyError: /third-party application/i.test(html),
  hasEaShell: html.includes("ea-shell") || html.includes("ea-panel"),
  title: (html.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || null,
  trycloudflare: [
    ...html.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com[^"'\\\s]*/gi),
  ]
    .map((m) => m[0])
    .slice(0, 5),
  headerHosts: [
    ...headers.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi),
  ].map((m) => m[0]),
  locations: [...headers.matchAll(/^location:\s*(.+)$/gim)].map((m) =>
    m[1].trim(),
  ),
  statusLines: headers
    .split(/\r?\n/)
    .filter((l) => /^HTTP\/|x-shopify|cf-|server:/i.test(l))
    .slice(0, 30),
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.hasEaShell && !report.thirdPartyError ? 0 : 1);
