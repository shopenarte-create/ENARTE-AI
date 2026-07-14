/**
 * Patch pulled theme assets to the live tunnel URL, then caller pushes.
 * Usage: ENARTE_TUNNEL_URL=... node scripts/patch-theme-tunnel.mjs <theme-dir>
 */
import fs from "fs";
import path from "path";

const TUNNEL = (process.env.ENARTE_TUNNEL_URL || "").replace(/\/$/, "");
const themeDir = process.argv[2];
if (!TUNNEL) throw new Error("ENARTE_TUNNEL_URL required");
if (!themeDir) throw new Error("theme dir required");

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

function strip(raw) {
  return raw.replace(/^\/\*[\s\S]*?\*\/\s*/, "");
}

const settingsPath = path.join(themeDir, "config", "settings_data.json");
const productPath = path.join(themeDir, "templates", "product.json");

const settings = JSON.parse(strip(fs.readFileSync(settingsPath, "utf8")));
settings.current = settings.current || {};
const blocks = settings.current.blocks || {};
const uuid =
  Object.values(blocks)
    .map((b) => String(b.type || ""))
    .find((t) => t.includes("enarte"))
    ?.match(/\/([0-9a-f-]{20,})$/i)?.[1] ||
  "019f4cc2-6806-7505-ba0a-8cf34e6bb189";

const trySettings = {
  button_label: "✨ جربها الآن",
  hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
  show_mode: "lighting",
  app_base_url: TUNNEL,
};

let n = 0;
for (const key of Object.keys(blocks)) {
  if (!String(blocks[key]?.type || "").includes("enarte")) continue;
  // Keep a single clean embed; drop duplicates later if needed.
  blocks[key].disabled = false;
  blocks[key].settings = { ...(blocks[key].settings || {}), ...trySettings };
  n += 1;
}
if (n === 0) {
  blocks.enarte_try_embed = {
    type: `shopify://apps/enarte-ai/blocks/enarte-try-embed/${uuid}`,
    disabled: false,
    settings: trySettings,
  };
  n = 1;
}
settings.current.blocks = blocks;
fs.writeFileSync(settingsPath, header + JSON.stringify(settings, null, 2) + "\n");

const product = JSON.parse(strip(fs.readFileSync(productPath, "utf8")));
product.sections = product.sections || {};

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
  const i = order.indexOf("main");
  if (i >= 0) order.splice(i + 1, 0, "enarte_try_now_section");
  else order.push("enarte_try_now_section");
}
product.order = order;
fs.writeFileSync(
  productPath,
  header.trimStart() + JSON.stringify(product, null, 2) + "\n",
);

console.log(
  JSON.stringify({
    themeDir,
    tunnel: TUNNEL,
    enarteBlocks: n,
    uuid,
    productUrl:
      product.sections.enarte_try_now_section.blocks.enarte_try_now_block
        .settings.app_base_url,
  }),
);
