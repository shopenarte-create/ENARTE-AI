import { PrismaClient } from "@prisma/client";

const SHOP = "enarte-ai-dev.myshopify.com";
const API = "2025-01";
const TUNNEL =
  process.env.ENARTE_TUNNEL_URL ||
  "https://proceeds-physical-institution-perform.trycloudflare.com";
const UUID = "019f4cc2-6806-7505-ba0a-8cf34e6bb189";

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
    return (await res.json()).asset.value;
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

  for (const themeId of ["159616794869", "159760974069"]) {
    const settings = JSON.parse(
      stripComment(await getAsset(themeId, "config/settings_data.json")),
    );
    const blocks = settings.current.blocks || {};
    for (const key of Object.keys(blocks)) {
      if (String(blocks[key]?.type || "").includes("enarte")) delete blocks[key];
    }
    blocks.enarte_try_embed = {
      type: `shopify://apps/enarte-ai/blocks/enarte-try-embed/${UUID}`,
      disabled: false,
      settings: {
        button_label: "✨ جربها الآن",
        hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
        show_mode: "lighting",
        app_base_url: TUNNEL,
      },
    };
    settings.current.blocks = blocks;
    await putAsset(
      themeId,
      "config/settings_data.json",
      header + JSON.stringify(settings, null, 2) + "\n",
    );

    const product = JSON.parse(
      stripComment(await getAsset(themeId, "templates/product.json")),
    );
    product.sections = product.sections || {};
    product.sections.enarte_try_now_section = {
      type: "apps",
      blocks: {
        enarte_try_now_block: {
          type: `shopify://apps/enarte-ai/blocks/try-now/${UUID}`,
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
      const i = order.indexOf("main");
      if (i >= 0) order.splice(i + 1, 0, "enarte_try_now_section");
      else order.push("enarte_try_now_section");
    }
    product.order = order;
    await putAsset(
      themeId,
      "templates/product.json",
      header.trimStart() + JSON.stringify(product, null, 2) + "\n",
    );

    const emb = JSON.parse(
      stripComment(await getAsset(themeId, "config/settings_data.json")),
    ).current.blocks.enarte_try_embed;
    console.log(themeId, "disabled=" + emb.disabled, "url=" + emb.settings.app_base_url);
  }
  console.log("ENABLED_OK", TUNNEL);
} finally {
  await prisma.$disconnect();
}
