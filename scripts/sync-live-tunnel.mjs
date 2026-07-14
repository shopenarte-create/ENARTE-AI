/**
 * Sync shopify.app.toml + both themes to the live Cloudflare tunnel.
 * Usage: ENARTE_TUNNEL_URL=https://....trycloudflare.com node --env-file=.env scripts/sync-live-tunnel.mjs
 */
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const SHOP = "enarte-ai-dev.myshopify.com";
const API = "2025-01";

function detectTunnel() {
  if (process.env.ENARTE_TUNNEL_URL) {
    return process.env.ENARTE_TUNNEL_URL.replace(/\/$/, "");
  }
  const termDir =
    "C:/Users/NTC/.cursor/projects/c-Users-NTC-Desktop-enarte-enarte-ai/terminals";
  const files = fs
    .readdirSync(termDir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => path.join(termDir, f));
  let best = null;
  let bestMtime = 0;
  for (const file of files) {
    const st = fs.statSync(file);
    const text = fs.readFileSync(file, "utf8");
    if (!/Using URL:\s*https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.test(text)) {
      continue;
    }
    if (st.mtimeMs >= bestMtime) {
      const matches = [
        ...text.matchAll(
          /Using URL:\s*(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/gi,
        ),
      ];
      if (matches.length) {
        best = matches[matches.length - 1][1];
        bestMtime = st.mtimeMs;
      }
    }
  }
  return best;
}

const TUNNEL = detectTunnel();
if (!TUNNEL) throw new Error("NO_TUNNEL_DETECTED");
console.log("TUNNEL", TUNNEL);

const DEAD_HOSTS = [
  "linux-harvey-mixture-ranked.trycloudflare.com",
  "referenced-complete-breaks-gadgets.trycloudflare.com",
  "promotion-indicate-breaking-recorders.trycloudflare.com",
  "mounting-alberta-cst-proof.trycloudflare.com",
  "easter-use-imperial-pencil.trycloudflare.com",
];

const header = `/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
`;

function stripComment(raw) {
  return raw.replace(/^\/\*[\s\S]*?\*\/\s*/, "");
}

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

// 1) Update shopify.app.toml
let toml = fs.readFileSync("shopify.app.toml", "utf8");
toml = toml.replace(
  /application_url\s*=\s*"https:\/\/[^"]+trycloudflare\.com"/,
  `application_url = "${TUNNEL}"`,
);
toml = toml.replace(
  /https:\/\/[a-z0-9-]+\.trycloudflare\.com/g,
  TUNNEL.replace("https://", "https://").replace(/^https:\/\//, "")
    ? TUNNEL
    : TUNNEL,
);
// safer explicit replacements for auth + proxy blocks
toml = fs.readFileSync("shopify.app.toml", "utf8");
toml = toml.replace(
  /application_url = "https:\/\/[^"]+"/g,
  `application_url = "${TUNNEL}"`,
);
toml = toml.replace(
  /"https:\/\/[^"]+trycloudflare\.com\/auth\/callback"/g,
  `"${TUNNEL}/auth/callback"`,
);
toml = toml.replace(
  /"https:\/\/[^"]+trycloudflare\.com\/auth\/shopify\/callback"/g,
  `"${TUNNEL}/auth/shopify/callback"`,
);
toml = toml.replace(
  /"https:\/\/[^"]+trycloudflare\.com\/api\/auth\/callback"/g,
  `"${TUNNEL}/api/auth/callback"`,
);
toml = toml.replace(
  /(\[app_proxy\][\s\S]*?url\s*=\s*)"https:\/\/[^"]+"/,
  `$1"${TUNNEL}"`,
);
fs.writeFileSync("shopify.app.toml", toml);
console.log("toml_updated");

// 2) Update extension liquid defaults + JS dead-host list
for (const file of [
  "extensions/enarte-try-in-room/blocks/enarte-try-embed.liquid",
  "extensions/enarte-try-in-room/blocks/try-now.liquid",
]) {
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(
    /("id": "app_base_url"[\s\S]*?"default":\s*")[^"]+(")/,
    `$1${TUNNEL}$2`,
  );
  fs.writeFileSync(file, src);
  console.log("liquid_default", file);
}

let js = fs.readFileSync(
  "extensions/enarte-try-in-room/assets/enarte-try.js",
  "utf8",
);
if (/var FORCED_APP_URL = "/.test(js)) {
  js = js.replace(
    /var FORCED_APP_URL = "[^"]*"/,
    `var FORCED_APP_URL = "${TUNNEL}"`,
  );
} else {
  js = js.replace(
    /\(function \(\) \{/,
    `(function () {\n  var FORCED_APP_URL = "${TUNNEL}";`,
  );
}
const deadList = DEAD_HOSTS.filter((h) => !TUNNEL.includes(h.split(".")[0]))
  .map((h) => `      "${h}",`)
  .join("\n");
if (/var deadHosts = \[/.test(js)) {
  js = js.replace(
    /var deadHosts = \[[\s\S]*?\];/,
    `var deadHosts = [\n${deadList}\n    ];`,
  );
}
fs.writeFileSync("extensions/enarte-try-in-room/assets/enarte-try.js", js);
console.log("js_forced_url_updated", TUNNEL);

// 3) Update both themes via Admin API
const prisma = new PrismaClient();
try {
  const session = await prisma.session.findFirst({
    where: { shop: SHOP, isOnline: false },
  });
  if (!session?.accessToken) throw new Error("NO_SESSION");
  const token = session.accessToken;

  async function getAsset(themeId, key) {
    const res = await fetch(
      `https://${SHOP}/admin/api/${API}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
      { headers: { "X-Shopify-Access-Token": token } },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(`get ${themeId} ${key} ${res.status}`);
    return json.asset.value;
  }

  async function putAsset(themeId, key, value) {
    const res = await fetch(
      `https://${SHOP}/admin/api/${API}/themes/${themeId}/assets.json`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ asset: { key, value } }),
      },
    );
    if (!res.ok) {
      const json = await res.json();
      console.log("PUT_FAIL", themeId, key, res.status, JSON.stringify(json));
      throw new Error(`put ${themeId} ${key}`);
    }
  }

  async function deleteAsset(themeId, key) {
    const res = await fetch(
      `https://${SHOP}/admin/api/${API}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
      { method: "DELETE", headers: { "X-Shopify-Access-Token": token } },
    );
    console.log("delete", themeId, key, res.status);
  }

  const themes = (
    await (
      await fetch(`https://${SHOP}/admin/api/${API}/themes.json`, {
        headers: { "X-Shopify-Access-Token": token },
      })
    ).json()
  ).themes;

  for (const theme of themes) {
    const themeId = String(theme.id);
    console.log("theme", themeId, theme.role);

    const settings = JSON.parse(
      stripComment(await getAsset(themeId, "config/settings_data.json")),
    );
    const blocks = settings.current?.blocks || {};
    for (const [, block] of Object.entries(blocks)) {
      if (!String(block?.type || "").includes("enarte")) continue;
      block.disabled = false;
      block.settings = block.settings || {};
      block.settings.app_base_url = TUNNEL;
    }
    await putAsset(
      themeId,
      "config/settings_data.json",
      header + JSON.stringify(settings, null, 2) + "\n",
    );

    const product = JSON.parse(
      stripComment(await getAsset(themeId, "templates/product.json")),
    );
    product.sections = product.sections || {};
    const uuid =
      Object.values(blocks)
        .map((b) => String(b.type || ""))
        .find((t) => t.includes("enarte"))
        ?.match(/\/([0-9a-f-]{20,})$/i)?.[1] ||
      "019f4cc2-6806-7505-ba0a-8cf34e6bb189";

    product.sections.enarte_try_now_section = {
      type: "apps",
      blocks: {
        enarte_try_now_block: {
          type: `shopify://apps/enarte-ai/blocks/try-now/${uuid}`,
          settings: {
            button_label: "✨ جربها الآن",
            hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
            show_mode: "lighting",
            app_base_url: TUNNEL,
          },
        },
      },
      block_order: ["enarte_try_now_block"],
      settings: { include_margins: true },
    };
    const order = Array.isArray(product.order)
      ? [...product.order]
      : Object.keys(product.sections);
    if (!order.includes("enarte_try_now_section")) {
      const mainIdx = order.indexOf("main");
      if (mainIdx >= 0) order.splice(mainIdx + 1, 0, "enarte_try_now_section");
      else order.push("enarte_try_now_section");
    }
    product.order = order;
    await putAsset(
      themeId,
      "templates/product.json",
      header.trimStart() + JSON.stringify(product, null, 2) + "\n",
    );

    try {
      await getAsset(themeId, "snippets/enarte-try-now.liquid");
      await deleteAsset(themeId, "snippets/enarte-try-now.liquid");
    } catch {
      /* missing ok */
    }

    try {
      let themeLiq = await getAsset(themeId, "layout/theme.liquid");
      if (/enarte-try-now|trycloudflare|linux-harvey/.test(themeLiq)) {
        themeLiq = themeLiq.replace(
          /\n?\s*\{%\s*render\s+['\"]enarte-try-now['\"]\s*%\}\s*/g,
          "\n",
        );
        await putAsset(themeId, "layout/theme.liquid", themeLiq);
      }
    } catch {
      /* ok */
    }

    console.log("theme_synced", themeId, TUNNEL);
  }

  // 4) Verify tunnel + storefront HTML
  const tunnelRes = await fetch(TUNNEL + "/");
  console.log("tunnel_status", tunnelRes.status);

  const tryRes = await fetch(
    `${TUNNEL}/try?entry=product&shop=${SHOP}&title=test`,
  );
  const tryText = await tryRes.text();
  console.log(
    "try_status",
    tryRes.status,
    "has_enarte",
    /ENARTE|جرب|اختر صورة/i.test(tryText),
  );

  const cookieJar = path.join(os.tmpdir(), "enarte-e2e-cookies.txt");
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

  const pwHtml = curl([
    "-s",
    "-c",
    cookieJar,
    "-b",
    cookieJar,
    `https://${SHOP}/password`,
  ]);
  const tokenMatch = pwHtml.match(
    /name="authenticity_token"[^>]*value="([^"]+)"/,
  );
  if (tokenMatch) {
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
      `password=${pw}`,
      "--data-urlencode",
      "form_type=storefront_password",
      "-o",
      "NUL",
    ]);
  }

  const out = path.join(os.tmpdir(), "enarte-e2e-product.html");
  const handle = "ثريا-بابلز-قوس-led-مودرن";
  curl([
    "-s",
    "-b",
    cookieJar,
    "-c",
    cookieJar,
    "-L",
    "-H",
    "Cache-Control: no-cache",
    `https://${SHOP}/products/${encodeURIComponent(handle)}?cb=${Date.now()}`,
    "-o",
    out,
  ]);
  const html = fs.readFileSync(out, "utf8");
  const urls = [...new Set([...html.matchAll(/data-app-url="([^"]*)"/g)].map((m) => m[1]))];
  console.log("storefront_urls", urls);
  console.log("storefront_has_live", urls.every((u) => u === TUNNEL));
  console.log(
    "storefront_has_dead",
    DEAD_HOSTS.some((d) => html.includes(d)),
  );
  console.log("storefront_buttons", (html.match(/data-enarte-try-button/g) || []).length);

  if (!urls.length || !urls.every((u) => u === TUNNEL)) {
    process.exitCode = 2;
    console.log("STOREFRONT_URL_MISMATCH");
  } else {
    console.log("SYNC_OK");
  }

  fs.writeFileSync(
    path.join(os.tmpdir(), "enarte-live-tunnel.txt"),
    TUNNEL,
    "utf8",
  );
} finally {
  await prisma.$disconnect();
}
