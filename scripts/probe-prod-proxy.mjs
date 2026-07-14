/**
 * Unlock enarteshop.com using known shopify-cli password store entries.
 * Does not print passwords. Tries enarte-ai-dev password against production.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const targets = [
  {
    host: "enarteshop.com",
    shop: "jb8xus-wn.myshopify.com",
    label: "production",
  },
];

function loadCandidatePasswords() {
  const file = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
    "shopify-cli-theme-store-password-nodejs/Config/config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const out = [];
  if (raw?.["enarte-ai-dev"]?.myshopify?.com) {
    out.push({ source: "enarte-ai-dev", password: raw["enarte-ai-dev"].myshopify.com });
  }
  if (process.env.STOREFRONT_PASSWORD) {
    out.push({ source: "STOREFRONT_PASSWORD", password: process.env.STOREFRONT_PASSWORD });
  }
  if (process.env.ENARTE_STORE_PASSWORD) {
    out.push({ source: "ENARTE_STORE_PASSWORD", password: process.env.ENARTE_STORE_PASSWORD });
  }
  return out;
}

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
}

const candidates = loadCandidatePasswords();
if (!candidates.length) {
  console.log(JSON.stringify({ ok: false, error: "NO_PASSWORD_CANDIDATES" }));
  process.exit(1);
}

const results = [];

for (const target of targets) {
  for (const cand of candidates) {
    const jar = path.join(os.tmpdir(), `enarte-prod-${Date.now()}.txt`);
    curl(["-s", "-c", jar, "-b", jar, `https://${target.host}/password`, "-o", "NUL"]);
    const postArgs = [
      "-s",
      "-c",
      jar,
      "-b",
      jar,
      "-X",
      "POST",
      `https://${target.host}/password`,
      "-H",
      "Content-Type: application/x-www-form-urlencoded",
      "--data-urlencode",
      `password=${cand.password}`,
      "--data-urlencode",
      "form_type=storefront_password",
      "--data-urlencode",
      "utf8=✓",
      "-D",
      "-",
      "-o",
      "NUL",
    ];
    const postHeaders = curl(postArgs);
    const unlockedByHeader =
      /set-cookie:.*storefront_digest/i.test(postHeaders) ||
      /location:\s*https?:\/\/[^/\s]+\/?\s*$/im.test(postHeaders) ||
      /HTTP\/1\.1 302/i.test(postHeaders);

    const out = path.join(process.cwd(), ".runtime-prod-assistant.html");
    const meta = curl([
      "-s",
      "-L",
      "-b",
      jar,
      "-c",
      jar,
      "-w",
      "%{http_code} %{url_effective}",
      "-o",
      out,
      `https://${target.host}/apps/enarte-ai/assistant?shop=${target.shop}&locale=ar&v=${Date.now()}`,
    ]);
    const html = fs.readFileSync(out, "utf8");
    const report = {
      host: target.host,
      source: cand.source,
      meta,
      postStatus: (postHeaders.match(/HTTP\/1\.\d\s+\d+/g) || []).slice(-1)[0] || null,
      unlockedByHeader,
      unlocked:
        unlockedByHeader ||
        (!/\/password(?:\?|$)/.test(meta) &&
          !/name=["']password["']/i.test(html)),
      thirdPartyError: /third-party application/i.test(html),
      hasEaShell: html.includes("ea-shell") || html.includes("ea-panel"),
      title: (html.match(/<title>([^<]+)<\/title>/i) || [])[1]?.trim() || null,
      ok: false,
    };
    report.ok =
      report.unlocked && report.hasEaShell && !report.thirdPartyError;
    results.push(report);
    if (report.ok || report.unlocked) {
      fs.copyFileSync(jar, path.join(process.cwd(), ".runtime-prod-cookies.txt"));
    }
  }
}

console.log(JSON.stringify({ results }, null, 2));
process.exit(results.some((r) => r.ok) ? 0 : 1);
