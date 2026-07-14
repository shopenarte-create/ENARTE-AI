/**
 * Check live app proxy destination + retry /apps assistant.
 * Does not print secrets.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const SHOP = "enarte-ai-dev.myshopify.com";
const API = "2025-01";
const jar = path.join(os.tmpdir(), "enarte-asst-check2.txt");
const out = ".runtime-assistant-proxy.html";
const expected = fs
  .readFileSync("shopify.app.toml", "utf8")
  .match(/application_url = "(https:\/\/[^"]+)"/)?.[1];

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

const prisma = new PrismaClient();
const session = await prisma.session.findFirst({
  where: { shop: SHOP, isOnline: false },
});
if (!session?.accessToken) {
  console.log(JSON.stringify({ ok: false, error: "NO_SESSION", expected }));
  process.exit(1);
}

const gql = await fetch(`https://${SHOP}/admin/api/${API}/graphql.json`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": session.accessToken,
  },
  body: JSON.stringify({
    query: `{
      currentAppInstallation {
        app { handle title }
        launchUrl
      }
    }`,
  }),
});
const gqlJson = await gql.json();

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

const headersOut = ".runtime-assistant-headers.txt";
const meta = curl([
  "-s",
  "-b",
  jar,
  "-c",
  jar,
  "-L",
  "-D",
  headersOut,
  "-w",
  "%{http_code} %{url_effective}",
  "-o",
  out,
  `https://${SHOP}/apps/enarte-ai/assistant?shop=${SHOP}&locale=ar&v=${Date.now()}`,
]);
const html = fs.readFileSync(out, "utf8");
const headers = fs.readFileSync(headersOut, "utf8");
const checks = {
  expectedTunnel: expected,
  gql: gqlJson?.data?.currentAppInstallation || gqlJson?.errors || null,
  meta,
  hasEaShell: html.includes("ea-shell") || html.includes("ea-panel"),
  thirdPartyError: /third-party application/i.test(html),
  title: (html.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || null,
  proxyHint: /trycloudflare|Cloudflare Tunnel error|Error 1033|Error 502|Error 530/i.test(
    html,
  )
    ? (html.match(/trycloudflare\.com|Error \d+/i) || [])[0]
    : null,
  headerSnippet: headers
    .split(/\r?\n/)
    .filter((l) => /HTTP\/|x-proxy|cf-|server:|location:/i.test(l))
    .slice(0, 20),
  ok:
    !/third-party application/i.test(html) &&
    (html.includes("ea-shell") || html.includes("ea-panel")),
};
console.log(JSON.stringify(checks, null, 2));
await prisma.$disconnect();
process.exit(checks.ok ? 0 : 2);
