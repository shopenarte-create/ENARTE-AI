import fs from "fs";

const uuid = "1238ccbc-57e9-cf7b-ced1-ac72e8ec3e9a27fe316a";
const appHandle = "enarte-ai";

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

const settingsPath = "tmp-theme/config/settings_data.json";
const settings = JSON.parse(stripComment(fs.readFileSync(settingsPath, "utf8")));
settings.current = settings.current || {};
settings.current.blocks = settings.current.blocks || {};
settings.current.blocks.enarte_try_embed_auto = {
  type: `shopify://apps/${appHandle}/blocks/enarte-try-embed/${uuid}`,
  disabled: false,
  settings: {
    button_label: "✨ جربها الآن",
    hint_text:
      "التقط صورة غرفتك أو اختر من المعرض لتركيب هذه الإنارة فوراً",
    show_mode: "lighting",
    app_base_url: "https://enarte-ai-dev.myshopify.com/apps/enarte-ai",
  },
};
fs.writeFileSync(settingsPath, header + JSON.stringify(settings, null, 2) + "\n");
console.log("embed:", settings.current.blocks.enarte_try_embed_auto.type);

const productPath = "tmp-theme/templates/product.json";
const product = JSON.parse(stripComment(fs.readFileSync(productPath, "utf8")));
product.sections = product.sections || {};
product.sections.enarte_try_now_section = {
  type: "apps",
  blocks: {
    enarte_try_now_block: {
      type: `shopify://apps/${appHandle}/blocks/try-now/${uuid}`,
      settings: {
        button_label: "✨ جربها الآن",
        hint_text:
          "التقط صورة غرفتك أو اختر من المعرض لتركيب هذه الإنارة فوراً",
        show_mode: "lighting",
        app_base_url: "https://enarte-ai-dev.myshopify.com/apps/enarte-ai",
      },
    },
  },
  block_order: ["enarte_try_now_block"],
  settings: {
    include_margins: true,
  },
};

const order = Array.isArray(product.order)
  ? [...product.order]
  : Object.keys(product.sections);
if (!order.includes("enarte_try_now_section")) {
  const mainIdx = order.indexOf("main");
  if (mainIdx >= 0) {
    order.splice(mainIdx + 1, 0, "enarte_try_now_section");
  } else {
    order.unshift("enarte_try_now_section");
  }
}
product.order = order;

fs.writeFileSync(
  productPath,
  header.trimStart() + JSON.stringify(product, null, 2) + "\n",
);
console.log(
  "product block:",
  product.sections.enarte_try_now_section.blocks.enarte_try_now_block.type,
);
console.log("order:", product.order);
