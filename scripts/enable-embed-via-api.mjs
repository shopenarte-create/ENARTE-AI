import { PrismaClient } from "../generated/prisma/client.ts";

const prisma = new PrismaClient();
const UUID = "1238ccbc-57e9-cf7b-ced1-ac72e8ec3e9a27fe316a";
const THEME_ID = "159616794869";
const API = "2025-01";
const EMBED_TYPE = `shopify://apps/enarte-ai/blocks/enarte-try-embed/${UUID}`;

function stripComment(raw) {
  return raw.replace(/^\/\*[\s\S]*?\*\/\s*/, "");
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

function getMutableSettings(parsed) {
  // Horizon / OS2.0: current is usually the settings object.
  if (parsed.current && typeof parsed.current === "object") {
    return { target: parsed.current, via: "current" };
  }
  // Some themes store the active preset name as a string.
  if (typeof parsed.current === "string" && parsed.presets?.[parsed.current]) {
    return { target: parsed.presets[parsed.current], via: `presets.${parsed.current}` };
  }
  if (parsed.presets?.Default) {
    return { target: parsed.presets.Default, via: "presets.Default" };
  }
  throw new Error("Could not locate mutable theme settings object");
}

try {
  const session = await prisma.session.findFirst({
    where: { shop: "enarte-ai-dev.myshopify.com", isOnline: false },
  });
  if (!session) throw new Error("NO_SESSION");

  const shop = session.shop;
  const token = session.accessToken;

  async function getAsset(key) {
    const res = await fetch(
      `https://${shop}/admin/api/${API}/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(key)}`,
      { headers: { "X-Shopify-Access-Token": token } },
    );
    const json = await res.json();
    if (!res.ok) {
      console.log("GET_ASSET", res.status, JSON.stringify(json));
      throw new Error("get_asset_failed");
    }
    return json.asset.value;
  }

  async function putAsset(key, value) {
    const res = await fetch(
      `https://${shop}/admin/api/${API}/themes/${THEME_ID}/assets.json`,
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
      console.log("PUT_ASSET", res.status, JSON.stringify(json));
      throw new Error("put_asset_failed");
    }
    return json;
  }

  const raw = await getAsset("config/settings_data.json");
  const settings = JSON.parse(stripComment(raw));
  const { target, via } = getMutableSettings(settings);
  target.blocks = target.blocks || {};

  console.log("settings_via", via);
  console.log(
    "existing_blocks",
    Object.keys(target.blocks).filter((k) =>
      String(target.blocks[k]?.type || "").includes("enarte"),
    ),
  );

  target.blocks.enarte_try_embed = {
    type: EMBED_TYPE,
    disabled: false,
    settings: {
      button_label: "✨ جربها الآن",
      hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
      show_mode: "lighting",
      app_base_url: "https://enarte-ai-dev.myshopify.com/apps/enarte-ai",
    },
  };

  await putAsset(
    "config/settings_data.json",
    header + JSON.stringify(settings, null, 2) + "\n",
  );

  const verifyRaw = await getAsset("config/settings_data.json");
  const verify = JSON.parse(stripComment(verifyRaw));
  const { target: verifyTarget } = getMutableSettings(verify);
  const block = verifyTarget.blocks?.enarte_try_embed;
  console.log("verify_block", JSON.stringify(block));
  const ok =
    block &&
    block.disabled === false &&
    String(block.type).includes("enarte-try-embed");
  console.log(ok ? "SUCCESS" : "FAILED");
  if (!ok) process.exit(1);
} finally {
  await prisma.$disconnect();
}
