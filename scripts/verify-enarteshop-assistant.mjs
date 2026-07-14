import fs from "fs";
import { execFileSync } from "child_process";

const bust = Date.now();
const out = ".runtime-prod-assistant.html";
const hdr = ".runtime-prod-assistant-headers.txt";

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
}

const meta = curl([
  "-s",
  "-L",
  "-D",
  hdr,
  "-o",
  out,
  "-w",
  "%{http_code} %{url_effective}",
  "-A",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  `https://enarteshop.com/apps/enarte-ai/assistant?shop=jb8xus-wn.myshopify.com&locale=ar&v=${bust}`,
]);

const html = fs.readFileSync(out, "utf8");
const headers = fs.readFileSync(hdr, "utf8");
let pingBody = "";
let pingMeta = "";
try {
  pingMeta = curl([
    "-s",
    "-w",
    " %{http_code}",
    `https://enarteshop.com/apps/enarte-ai/api/try-handoff?id=ping&v=${bust}`,
  ]);
  pingBody = pingMeta;
} catch (e) {
  pingBody = String(e.message || e);
}

const report = {
  meta,
  ping: pingBody.slice(0, 200),
  len: html.length,
  passwordWall:
    /storefront_password/i.test(html) ||
    /\/password/.test(meta) ||
    /Opening soon/i.test(html),
  thirdPartyError: /third-party application/i.test(html),
  hasEaShell: html.includes("ea-shell") || html.includes("ea-panel"),
  hasBrand: /ENARTE/i.test(html),
  title: (html.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || null,
  locations: [...headers.matchAll(/^location:\s*(.+)$/gim)].map((m) =>
    m[1].trim(),
  ),
  statusLines: headers
    .split(/\r?\n/)
    .filter((l) => /^HTTP\/|x-shopify|cf-ray|server:/i.test(l))
    .slice(0, 25),
};

report.ok =
  report.hasEaShell && !report.thirdPartyError && !report.passwordWall;

fs.writeFileSync(".runtime-prod-verify.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
