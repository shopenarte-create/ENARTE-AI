import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SHOP = "enarte-ai-dev.myshopify.com";
const jar = path.join(os.tmpdir(), "enarte-mobile-check.txt");
const pw = JSON.parse(
  fs.readFileSync(
    path.join(
      process.env.APPDATA,
      "shopify-cli-theme-store-password-nodejs/Config/config.json",
    ),
    "utf8",
  ),
)["enarte-ai-dev"].myshopify.com;

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

const html = curl(["-s", "-c", jar, "-b", jar, `https://${SHOP}/password`]);
const token = html.match(
  /name="authenticity_token"[^>]*value="([^"]+)/,
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
    `password=${pw}`,
    "--data-urlencode",
    "form_type=storefront_password",
    "-o",
    "NUL",
  ]);
}

const ua =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const out = ".runtime-mobile-assistant.html";
const meta = curl([
  "-s",
  "-L",
  "-b",
  jar,
  "-A",
  ua,
  "-w",
  "%{http_code} %{url_effective}",
  "-o",
  out,
  `https://${SHOP}/apps/enarte-ai/assistant?shop=${SHOP}&locale=ar&v=${Date.now()}`,
]);
const body = fs.readFileSync(out, "utf8");
const report = {
  meta,
  thirdParty: /third-party application/i.test(body),
  hasEaShell: body.includes("ea-shell") || body.includes("ea-panel"),
  title: (body.match(/<title>([^<]+)/i) || [])[1]?.trim() || null,
};
report.ok = report.hasEaShell && !report.thirdParty;
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
