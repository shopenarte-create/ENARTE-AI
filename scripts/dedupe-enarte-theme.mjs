import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SHOP = "enarte-ai-dev.myshopify.com";
const THEME_ID = "159616794869";
const API = "2025-01";

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

  const settings = JSON.parse(
    stripComment(await getAsset("config/settings_data.json")),
  );
  const blocks = settings.current?.blocks || {};
  let enabledEmbeds = 0;
  for (const [k, v] of Object.entries(blocks)) {
    if (!String(v.type || "").includes("enarte")) continue;
    console.log("embed", k, "disabled=" + v.disabled, v.type);
    if (v.disabled === false) enabledEmbeds += 1;
  }

  // Keep a single enabled embed
  let kept = false;
  for (const [k, v] of Object.entries(blocks)) {
    if (!String(v.type || "").includes("enarte-try-embed")) continue;
    if (!kept && v.disabled === false) {
      kept = true;
      continue;
    }
    if (v.disabled === false) {
      v.disabled = true;
      console.log("disabled_duplicate_embed", k);
    }
  }

  const theme = await getAsset("layout/theme.liquid");
  console.log("theme_has_enarte_render", /enarte-try-now|enarte-try/.test(theme));
  for (const line of theme.split(/\n/)) {
    if (/enarte/i.test(line)) console.log("theme_line", line.trim());
  }

  // Prefer App Embed for all lighting products; keep product section block too
  // as user asked for Theme App Extension block in product template.
  // If theme.liquid has a snippet render, remove it to avoid triple buttons.
  let themeUpdated = theme;
  if (/render ['\"]enarte-try-now['\"]/.test(theme)) {
    themeUpdated = theme.replace(
      /\n?\s*\{%\s*render\s+['\"]enarte-try-now['\"]\s*%\}\s*/g,
      "\n",
    );
    console.log("removed_theme_snippet_render");
  }

  await putAsset(
    "config/settings_data.json",
    header + JSON.stringify(settings, null, 2) + "\n",
  );
  if (themeUpdated !== theme) {
    await putAsset("layout/theme.liquid", themeUpdated);
  }

  const product = JSON.parse(
    stripComment(await getAsset("templates/product.json")),
  );
  const section = product.sections?.enarte_try_now_section;
  console.log(
    "product_block_ok",
    Boolean(section?.blocks?.enarte_try_now_block) &&
      (product.order || []).includes("enarte_try_now_section"),
  );
  console.log(
    "product_block_type",
    section?.blocks?.enarte_try_now_block?.type || null,
  );
  console.log("enabled_embeds_before_cleanup_count_logged_above");
} finally {
  await prisma.$disconnect();
}
