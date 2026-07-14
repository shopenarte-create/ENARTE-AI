import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SHOP = "enarte-ai-dev.myshopify.com";
const THEME_ID = "159616794869";
const API = "2025-01";
const NEW_APP_URL =
  process.env.ENARTE_TUNNEL_URL ||
  "https://easter-use-imperial-pencil.trycloudflare.com";

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

try {
  const session = await prisma.session.findFirst({
    where: { shop: SHOP, isOnline: false },
  });
  if (!session?.accessToken) throw new Error("NO_SESSION");
  const token = session.accessToken;

  async function getAsset(key) {
    const res = await fetch(
      `https://${SHOP}/admin/api/${API}/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(key)}`,
      { headers: { "X-Shopify-Access-Token": token } },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(`get_asset_failed:${key}:${res.status}`);
    return json.asset.value;
  }

  async function putAsset(key, value) {
    const res = await fetch(
      `https://${SHOP}/admin/api/${API}/themes/${THEME_ID}/assets.json`,
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
      console.log("PUT_FAIL", key, res.status, JSON.stringify(json));
      throw new Error(`put_asset_failed:${key}`);
    }
  }

  const appBase = `${NEW_APP_URL.replace(/\/$/, "")}`;
  console.log("new_app_base", appBase);

  // settings_data embeds
  const settings = JSON.parse(
    stripComment(await getAsset("config/settings_data.json")),
  );
  const blocks = settings.current?.blocks || {};
  let embedUpdated = 0;
  for (const [key, block] of Object.entries(blocks)) {
    if (!String(block?.type || "").includes("enarte")) continue;
    block.settings = block.settings || {};
    const prev = block.settings.app_base_url;
    block.settings.app_base_url = appBase;
    console.log("embed", key, "disabled=" + block.disabled, "from", prev, "to", appBase);
    embedUpdated += 1;
  }
  await putAsset(
    "config/settings_data.json",
    header + JSON.stringify(settings, null, 2) + "\n",
  );

  // product.json section block
  const product = JSON.parse(
    stripComment(await getAsset("templates/product.json")),
  );
  const section = product.sections?.enarte_try_now_section;
  if (section?.blocks) {
    for (const [key, block] of Object.entries(section.blocks)) {
      block.settings = block.settings || {};
      const prev = block.settings.app_base_url;
      block.settings.app_base_url = appBase;
      console.log("product_block", key, "from", prev, "to", appBase);
    }
  }
  await putAsset(
    "templates/product.json",
    header.trimStart() + JSON.stringify(product, null, 2) + "\n",
  );

  // verify
  const vs = JSON.parse(
    stripComment(await getAsset("config/settings_data.json")),
  );
  const vp = JSON.parse(stripComment(await getAsset("templates/product.json")));
  const embedUrl = Object.values(vs.current?.blocks || {}).find((b) =>
    String(b?.type || "").includes("enarte-try-embed"),
  )?.settings?.app_base_url;
  const blockUrl =
    vp.sections?.enarte_try_now_section?.blocks?.enarte_try_now_block?.settings
      ?.app_base_url;
  console.log("verify_embed_url", embedUrl);
  console.log("verify_product_url", blockUrl);
  console.log(
    embedUrl === appBase && blockUrl === appBase ? "URLS_OK" : "URLS_FAIL",
  );
  console.log("embeds_touched", embedUpdated);
} finally {
  await prisma.$disconnect();
}
