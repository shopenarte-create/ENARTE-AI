import { PrismaClient } from "@prisma/client";

const SHOP = "enarte-ai-dev.myshopify.com";
const API = "2025-01";
const TUNNEL = "https://august-jacob-sydney-resulting.trycloudflare.com";
const UUIDS = [
  "019f4e74-0428-7994-b85e-bba18ed5ad5b", // current CDN preview
  "019f4cc2-6806-7505-ba0a-8cf34e6bb189", // previous preview
  "1238ccbc-57e9-cf7b-ced1-ac72e8ec3e9a27fe316a", // released
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
    if (!res.ok) throw new Error(`get ${key} ${res.status}`);
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
      console.log("PUT_FAIL", key, res.status, JSON.stringify(json).slice(0, 500));
      throw new Error(`put ${key}`);
    }
    return json;
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
    const settings = JSON.parse(
      stripComment(await getAsset(themeId, "config/settings_data.json")),
    );
    settings.current = settings.current || {};
    settings.current.blocks = settings.current.blocks || {};

    // Remove failed live key if present empty
    // Enable ALL known UUID embeds with tunnel URL (Shopify keeps valid ones)
    for (const uuid of UUIDS) {
      const key = `enarte_embed_${uuid.slice(0, 8)}`;
      settings.current.blocks[key] = {
        type: `shopify://apps/enarte-ai/blocks/enarte-try-embed/${uuid}`,
        disabled: false,
        settings: {
          button_label: "✨ جربها الآن",
          hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
          show_mode: "lighting",
          app_base_url: TUNNEL,
        },
      };
    }

    // Also update any existing enarte blocks
    for (const [k, b] of Object.entries(settings.current.blocks)) {
      if (!String(b?.type || "").includes("enarte")) continue;
      b.disabled = false;
      b.settings = b.settings || {};
      b.settings.app_base_url = TUNNEL;
      b.settings.button_label = b.settings.button_label || "✨ جربها الآن";
      b.settings.show_mode = b.settings.show_mode || "lighting";
    }

    // Drop the broken key from previous script if any
    delete settings.current.blocks.enarte_try_embed_live;

    await putAsset(
      themeId,
      "config/settings_data.json",
      header + JSON.stringify(settings, null, 2) + "\n",
    );

    // Verify what Shopify kept
    const vs = JSON.parse(
      stripComment(await getAsset(themeId, "config/settings_data.json")),
    );
    console.log("THEME", themeId, theme.role);
    for (const [k, b] of Object.entries(vs.current.blocks || {})) {
      if (String(b?.type || "").includes("enarte")) {
        console.log(
          " ",
          k,
          "disabled=" + b.disabled,
          b.settings?.app_base_url,
          String(b.type).slice(-45),
        );
      }
    }

    // Product blocks for each uuid - use first that works; write all in one section? 
    // Section can only have one try-now block type typically - use newest first
    const product = JSON.parse(
      stripComment(await getAsset(themeId, "templates/product.json")),
    );
    product.sections = product.sections || {};
    const blocks = {};
    const order = [];
    for (const uuid of UUIDS) {
      const id = `try_${uuid.slice(0, 8)}`;
      blocks[id] = {
        type: `shopify://apps/enarte-ai/blocks/try-now/${uuid}`,
        settings: {
          button_label: "✨ جربها الآن",
          hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
          show_mode: "lighting",
          app_base_url: TUNNEL,
        },
      };
      order.push(id);
    }
    product.sections.enarte_try_now_section = {
      type: "apps",
      blocks,
      block_order: order,
      settings: { include_margins: true },
    };
    const pOrder = Array.isArray(product.order)
      ? [...product.order]
      : Object.keys(product.sections);
    if (!pOrder.includes("enarte_try_now_section")) {
      const mainIdx = pOrder.indexOf("main");
      if (mainIdx >= 0) pOrder.splice(mainIdx + 1, 0, "enarte_try_now_section");
      else pOrder.push("enarte_try_now_section");
    }
    product.order = pOrder;
    await putAsset(
      themeId,
      "templates/product.json",
      header.trimStart() + JSON.stringify(product, null, 2) + "\n",
    );

    const vp = JSON.parse(
      stripComment(await getAsset(themeId, "templates/product.json")),
    );
    const kept = Object.keys(vp.sections?.enarte_try_now_section?.blocks || {});
    console.log(" product_blocks_kept", kept);
    for (const id of kept) {
      const b = vp.sections.enarte_try_now_section.blocks[id];
      console.log("  ", id, b.settings?.app_base_url, String(b.type).slice(-45));
    }
  }
  console.log("RECOVERY_OK", TUNNEL);
} finally {
  await prisma.$disconnect();
}
