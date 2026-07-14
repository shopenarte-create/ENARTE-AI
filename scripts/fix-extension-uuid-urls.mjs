import { PrismaClient } from "@prisma/client";
import fs from "fs";

const SHOP = "enarte-ai-dev.myshopify.com";
const API = "2025-01";
const TUNNEL =
  process.env.ENARTE_TUNNEL_URL ||
  "https://august-jacob-sydney-resulting.trycloudflare.com";

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

const prisma = new PrismaClient();
try {
  const session = await prisma.session.findFirst({
    where: { shop: SHOP, isOnline: false },
  });
  const token = session.accessToken;

  async function getAsset(themeId, key) {
    const res = await fetch(
      `https://${SHOP}/admin/api/${API}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
      { headers: { "X-Shopify-Access-Token": token } },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(`${key} ${res.status}`);
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
    if (!res.ok) throw new Error(`put ${key} ${res.status}`);
  }

  const themes = (
    await (
      await fetch(`https://${SHOP}/admin/api/${API}/themes.json`, {
        headers: { "X-Shopify-Access-Token": token },
      })
    ).json()
  ).themes;

  // Known extension UUIDs (released + previous + current preview from CDN)
  const uuids = [
    "1238ccbc-57e9-cf7b-ced1-ac72e8ec3e9a27fe316a",
    "019f4cc2-6806-7505-ba0a-8cf34e6bb189",
    "019f4e74-0428-7994-b85e-bba18ed5ad5b",
  ];

  for (const theme of themes) {
    const themeId = String(theme.id);
    const settings = JSON.parse(
      stripComment(await getAsset(themeId, "config/settings_data.json")),
    );
    settings.current = settings.current || {};
    settings.current.blocks = settings.current.blocks || {};

    console.log("THEME", themeId, theme.role, "blocks_before");
    for (const [k, b] of Object.entries(settings.current.blocks)) {
      if (String(b?.type || "").includes("enarte")) {
        console.log(" ", k, b.disabled, b.type, b.settings?.app_base_url);
      }
    }

    // Disable all existing enarte embeds, then add one enabled per UUID? 
    // Better: update ALL enarte blocks to TUNNEL, keep enabled ones enabled,
    // and ensure at least one enabled embed for the latest UUID.
    let latestUuid = uuids[uuids.length - 1];
    for (const [k, b] of Object.entries(settings.current.blocks)) {
      const type = String(b?.type || "");
      if (!type.includes("enarte")) continue;
      b.settings = b.settings || {};
      b.settings.app_base_url = TUNNEL;
      // Prefer enabling the newest uuid embed; disable older duplicates
      const isLatest = type.includes(latestUuid);
      if (type.includes("enarte-try-embed")) {
        b.disabled = !isLatest && type.includes("enarte-try-embed")
          ? true
          : b.disabled;
        if (isLatest) b.disabled = false;
      }
    }

    // Ensure latest embed exists and is enabled
    settings.current.blocks.enarte_try_embed_live = {
      type: `shopify://apps/enarte-ai/blocks/enarte-try-embed/${latestUuid}`,
      disabled: false,
      settings: {
        button_label: "✨ جربها الآن",
        hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
        show_mode: "lighting",
        app_base_url: TUNNEL,
      },
    };

    // Also keep previous uuid enabled? No - one is enough. Disable others.
    for (const [k, b] of Object.entries(settings.current.blocks)) {
      const type = String(b?.type || "");
      if (!type.includes("enarte-try-embed")) continue;
      if (k === "enarte_try_embed_live") {
        b.disabled = false;
        b.settings.app_base_url = TUNNEL;
        continue;
      }
      b.disabled = true;
      b.settings = b.settings || {};
      b.settings.app_base_url = TUNNEL;
    }

    await putAsset(
      themeId,
      "config/settings_data.json",
      header + JSON.stringify(settings, null, 2) + "\n",
    );

    // product block with latest uuid
    const product = JSON.parse(
      stripComment(await getAsset(themeId, "templates/product.json")),
    );
    product.sections = product.sections || {};
    product.sections.enarte_try_now_section = {
      type: "apps",
      blocks: {
        enarte_try_now_block: {
          type: `shopify://apps/enarte-ai/blocks/try-now/${latestUuid}`,
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

    // verify
    const vs = JSON.parse(
      stripComment(await getAsset(themeId, "config/settings_data.json")),
    );
    console.log("THEME", themeId, "blocks_after");
    for (const [k, b] of Object.entries(vs.current.blocks || {})) {
      if (String(b?.type || "").includes("enarte")) {
        console.log(" ", k, "disabled="+b.disabled, b.settings?.app_base_url, b.type.slice(-40));
      }
    }
  }

  // Probe app proxy destination
  const cookieJar = `${process.env.TEMP}\\enarte-proxy-cookies.txt`;
  const { execFileSync } = await import("child_process");
  const pw = JSON.parse(
    fs.readFileSync(
      `${process.env.APPDATA}/shopify-cli-theme-store-password-nodejs/Config/config.json`,
      "utf8",
    ),
  )["enarte-ai-dev"].myshopify.com;
  execFileSync(
    "curl.exe",
    ["-s", "-c", cookieJar, "-b", cookieJar, `https://${SHOP}/password`, "-o", "NUL"],
    { stdio: "ignore" },
  );
  // get token properly
  const pwHtml = execFileSync(
    "curl.exe",
    ["-s", "-c", cookieJar, "-b", cookieJar, `https://${SHOP}/password`],
    { encoding: "utf8" },
  );
  const tokenMatch = pwHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
  if (tokenMatch) {
    execFileSync(
      "curl.exe",
      [
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
      ],
      { stdio: "ignore" },
    );
  }

  // Follow app proxy and report final URL host
  const headers = execFileSync(
    "curl.exe",
    [
      "-s",
      "-D",
      "-",
      "-o",
      "NUL",
      "-b",
      cookieJar,
      "-c",
      cookieJar,
      "-L",
      "--max-redirs",
      "5",
      `https://${SHOP}/apps/enarte-ai/try?entry=product&shop=${SHOP}`,
    ],
    { encoding: "utf8" },
  );
  const locs = [...headers.matchAll(/^location:\s*(.+)$/gim)].map((m) =>
    m[1].trim(),
  );
  console.log("proxy_locations", locs);
  console.log(
    "proxy_hits_live_tunnel",
    locs.some((l) => l.includes("august-jacob-sydney-resulting")) ||
      headers.includes("august-jacob"),
  );

  // Direct product HTML check again
  const out = `${process.env.TEMP}\\enarte-after-uuid.html`;
  execFileSync(
    "curl.exe",
    [
      "-s",
      "-b",
      cookieJar,
      "-c",
      cookieJar,
      "-L",
      "-H",
      "Cache-Control: no-cache",
      `https://${SHOP}/products/${encodeURIComponent("ثريا-بابلز-قوس-led-مودرن")}?u=${Date.now()}`,
      "-o",
      out,
    ],
    { stdio: "ignore" },
  );
  const html = fs.readFileSync(out, "utf8");
  const urls = [
    ...new Set([...html.matchAll(/data-app-url="([^"]*)"/g)].map((m) => m[1])),
  ];
  console.log("html_urls", urls);
  console.log("html_has_tunnel", urls.includes(TUNNEL));
  console.log("DONE");
} finally {
  await prisma.$disconnect();
}
