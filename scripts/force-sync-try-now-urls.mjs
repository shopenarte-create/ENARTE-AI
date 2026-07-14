import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const SHOP = "enarte-ai-dev.myshopify.com";
const API = "2025-01";
const TUNNEL = "https://easter-use-imperial-pencil.trycloudflare.com";
const DEAD_HOSTS = [
  "linux-harvey-mixture-ranked.trycloudflare.com",
  "referenced-complete-breaks-gadgets.trycloudflare.com",
  "promotion-indicate-breaking-recorders.trycloudflare.com",
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
    const json = await res.json();
    if (!res.ok) {
      console.log("PUT_FAIL", themeId, key, res.status, JSON.stringify(json));
      throw new Error(`put ${themeId} ${key}`);
    }
  }

  async function deleteAsset(themeId, key) {
    const res = await fetch(
      `https://${SHOP}/admin/api/${API}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
      {
        method: "DELETE",
        headers: { "X-Shopify-Access-Token": token },
      },
    );
    console.log("delete", themeId, key, res.status);
  }

  const themesRes = await fetch(`https://${SHOP}/admin/api/${API}/themes.json`, {
    headers: { "X-Shopify-Access-Token": token },
  });
  const themes = (await themesRes.json()).themes || [];

  for (const theme of themes) {
    const themeId = String(theme.id);
    console.log("updating_theme", themeId, theme.role, theme.name);

    // settings_data
    const settings = JSON.parse(
      stripComment(await getAsset(themeId, "config/settings_data.json")),
    );
    const blocks = settings.current?.blocks || {};
    for (const [key, block] of Object.entries(blocks)) {
      if (!String(block?.type || "").includes("enarte")) continue;
      block.disabled = false;
      block.settings = block.settings || {};
      block.settings.app_base_url = TUNNEL;
      // scrub any dead urls in settings values
      for (const [sk, sv] of Object.entries(block.settings)) {
        if (typeof sv === "string") {
          for (const dead of DEAD_HOSTS) {
            if (sv.includes(dead)) {
              block.settings[sk] = sv.split(dead).join(
                TUNNEL.replace("https://", ""),
              );
            }
          }
        }
      }
      console.log("  embed", key, "->", block.settings.app_base_url);
    }
    await putAsset(
      themeId,
      "config/settings_data.json",
      header + JSON.stringify(settings, null, 2) + "\n",
    );

    // product.json
    try {
      const product = JSON.parse(
        stripComment(await getAsset(themeId, "templates/product.json")),
      );
      product.sections = product.sections || {};
      // ensure section exists on main theme
      if (!product.sections.enarte_try_now_section) {
        const uuidMatch = Object.values(blocks)
          .map((b) => String(b.type || ""))
          .find((t) => t.includes("enarte-try-embed"))
          ?.match(/\/([0-9a-f-]{20,})$/i);
        const uuid = uuidMatch?.[1] || "019f4cc2-6806-7505-ba0a-8cf34e6bb189";
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
      } else {
        for (const block of Object.values(
          product.sections.enarte_try_now_section.blocks || {},
        )) {
          block.settings = block.settings || {};
          block.settings.app_base_url = TUNNEL;
        }
      }
      await putAsset(
        themeId,
        "templates/product.json",
        header.trimStart() + JSON.stringify(product, null, 2) + "\n",
      );
      console.log(
        "  product_block ->",
        product.sections.enarte_try_now_section.blocks.enarte_try_now_block
          ?.settings?.app_base_url,
      );
    } catch (e) {
      console.log("  product_skip", e.message);
    }

    // Remove stale theme snippet fallback (hardcoded proxy / old urls)
    try {
      await getAsset(themeId, "snippets/enarte-try-now.liquid");
      await deleteAsset(themeId, "snippets/enarte-try-now.liquid");
    } catch {
      console.log("  no_snippet");
    }

    // Ensure theme.liquid does not render snippet
    try {
      let themeLiq = await getAsset(themeId, "layout/theme.liquid");
      if (/enarte-try-now|linux-harvey|trycloudflare/.test(themeLiq)) {
        themeLiq = themeLiq.replace(
          /\n?\s*\{%\s*render\s+['\"]enarte-try-now['\"]\s*%\}\s*/g,
          "\n",
        );
        for (const dead of DEAD_HOSTS) {
          themeLiq = themeLiq.split(dead).join(TUNNEL.replace("https://", ""));
        }
        await putAsset(themeId, "layout/theme.liquid", themeLiq);
        console.log("  theme.liquid cleaned");
      }
    } catch (e) {
      console.log("  theme.liquid skip", e.message);
    }

    // Clean theme asset JS if it hardcodes old urls
    for (const assetKey of ["assets/enarte-try.js", "assets/enarte-try.css"]) {
      try {
        let asset = await getAsset(themeId, assetKey);
        let changed = false;
        for (const dead of DEAD_HOSTS) {
          if (asset.includes(dead)) {
            asset = asset.split(dead).join(TUNNEL.replace("https://", ""));
            changed = true;
          }
        }
        if (changed) {
          await putAsset(themeId, assetKey, asset);
          console.log("  cleaned", assetKey);
        }
      } catch {
        // missing ok
      }
    }
  }

  // Fetch storefront HTML and verify
  const cookieJar = path.join(os.tmpdir(), "enarte-sf-cookies2.txt");
  const pwFile = path.join(
    process.env.APPDATA,
    "shopify-cli-theme-store-password-nodejs",
    "Config",
    "config.json",
  );
  const pw = JSON.parse(fs.readFileSync(pwFile, "utf8"))["enarte-ai-dev"].myshopify
    .com;
  const pwHtml = curl(["-s", "-c", cookieJar, "-b", cookieJar, `https://${SHOP}/password`]);
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

  const handle = "ثريا-بابلز-قوس-led-مودرن";
  const out = path.join(os.tmpdir(), "enarte-url-verify.html");
  // cache-bust
  curl([
    "-s",
    "-b",
    cookieJar,
    "-c",
    cookieJar,
    "-L",
    "-H",
    "Cache-Control: no-cache",
    `https://${SHOP}/products/${encodeURIComponent(handle)}?v=${Date.now()}`,
    "-o",
    out,
  ]);
  const html = fs.readFileSync(out, "utf8");
  const urls = [...html.matchAll(/data-app-url="([^"]*)"/g)].map((m) => m[1]);
  console.log("storefront_app_urls", [...new Set(urls)]);
  console.log(
    "storefront_has_dead",
    DEAD_HOSTS.some((d) => html.includes(d)),
  );
  console.log("storefront_has_live_tunnel", html.includes(TUNNEL.replace("https://", "")));
  console.log("storefront_buttons", (html.match(/data-enarte-try-button/g) || []).length);
} finally {
  await prisma.$disconnect();
}
