/**
 * Enable ENARTE Try embeds on PRODUCTION shop (jb8xus-wn / MAIN theme):
 * - App embed: home-try-embed
 * - Index template section: home-try
 * Also refreshes product embed app_base_url to the current tunnel.
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const prisma = new PrismaClient();
const SHOP = "jb8xus-wn.myshopify.com";
const THEME_ID = "129303969841";
const API = "2025-01";
const DEV_UUID = "019f4cc2-6806-7505-ba0a-8cf34e6bb189";

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
  return String(raw || "").replace(/^\/\*[\s\S]*?\*\/\s*/, "");
}

function getMutableSettings(parsed) {
  if (parsed.current && typeof parsed.current === "object") {
    return { target: parsed.current, via: "current" };
  }
  if (typeof parsed.current === "string" && parsed.presets?.[parsed.current]) {
    return {
      target: parsed.presets[parsed.current],
      via: `presets.${parsed.current}`,
    };
  }
  if (parsed.presets?.Default) {
    return { target: parsed.presets.Default, via: "presets.Default" };
  }
  throw new Error("Could not locate mutable theme settings object");
}

function pickUuid(existingBlocks = {}) {
  for (const block of Object.values(existingBlocks)) {
    const type = String(block?.type || "");
    const match = type.match(
      /shopify:\/\/apps\/enarte-ai\/blocks\/[^/]+\/([0-9a-f-]+)/i,
    );
    if (match?.[1]) return match[1];
  }
  return DEV_UUID;
}

function readTunnelUrl() {
  if (process.env.ENARTE_TUNNEL_URL) {
    return process.env.ENARTE_TUNNEL_URL.replace(/\/$/, "");
  }
  const previewPath = path.join(process.cwd(), ".preview-url.txt");
  if (fs.existsSync(previewPath)) {
    return fs.readFileSync(previewPath, "utf8").trim().replace(/\/$/, "");
  }
  return "https://saints-between-manufacturers-venice.trycloudflare.com";
}

async function getAccessToken() {
  const key = process.env.SHOPIFY_API_KEY;
  const secret = process.env.SHOPIFY_API_SECRET;
  if (key && secret) {
    const res = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: key,
        client_secret: secret,
        grant_type: "client_credentials",
      }),
    });
    const json = await res.json();
    if (res.ok && json.access_token) {
      try {
        await prisma.session.updateMany({
          where: { shop: SHOP, isOnline: false },
          data: { accessToken: json.access_token },
        });
      } catch {
        /* best-effort */
      }
      return json.access_token;
    }
    console.warn("client_credentials_failed", res.status);
  }
  const session = await prisma.session.findFirst({
    where: { shop: SHOP, isOnline: false },
  });
  if (!session?.accessToken) throw new Error("NO_SESSION");
  return session.accessToken;
}

try {
  const token = await getAccessToken();
  const tunnel = readTunnelUrl();
  console.log("tunnel", tunnel);

  async function getAsset(key) {
    const res = await fetch(
      `https://${SHOP}/admin/api/${API}/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(key)}`,
      { headers: { "X-Shopify-Access-Token": token } },
    );
    const json = await res.json();
    if (!res.ok) {
      console.log("GET_ASSET_FAIL", key, res.status, JSON.stringify(json));
      throw new Error(`get_asset_failed:${key}`);
    }
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
      console.log("PUT_ASSET_FAIL", key, res.status, JSON.stringify(json));
      throw new Error(`put_asset_failed:${key}`);
    }
    return json;
  }

  const settingsRaw = await getAsset("config/settings_data.json");
  const settings = JSON.parse(stripComment(settingsRaw));
  const { target, via } = getMutableSettings(settings);
  target.blocks = target.blocks || {};
  const uuid = pickUuid(target.blocks);
  console.log("settings_via", via, "uuid", uuid);

  target.blocks.enarte_try_embed = {
    type: `shopify://apps/enarte-ai/blocks/enarte-try-embed/${uuid}`,
    disabled: false,
    settings: {
      button_label: "✨ جربها الآن",
      hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
      show_mode: "lighting",
      app_base_url: tunnel,
    },
  };

  target.blocks.enarte_home_try_embed = {
    type: `shopify://apps/enarte-ai/blocks/home-try-embed/${uuid}`,
    disabled: false,
    settings: {
      button_label: "✨ جربها في غرفتك",
      hint_text: "التقط صورة غرفتك وسنقترح أفضل 3 إنارات مناسبة",
      app_base_url: tunnel,
    },
  };

  // Disable unknown duplicate home embeds, keep our canonical keys.
  for (const [key, block] of Object.entries(target.blocks)) {
    const type = String(block?.type || "");
    if (
      type.includes("home-try-embed") &&
      key !== "enarte_home_try_embed"
    ) {
      block.disabled = true;
    }
  }

  await putAsset(
    "config/settings_data.json",
    header + JSON.stringify(settings, null, 2) + "\n",
  );
  console.log("embeds_updated");

  // Index template: visible in-page section near top of homepage.
  const indexRaw = await getAsset("templates/index.json");
  const index = JSON.parse(stripComment(indexRaw));
  index.sections = index.sections || {};

  index.sections.enarte_home_try_section = {
    type: "apps",
    blocks: {
      enarte_home_try_block: {
        type: `shopify://apps/enarte-ai/blocks/home-try/${uuid}`,
        settings: {
          button_label: "✨ جربها في غرفتك",
          hint_text: "التقط صورة غرفتك وسنقترح أفضل 3 إنارات مناسبة",
          app_base_url: tunnel,
        },
      },
    },
    block_order: ["enarte_home_try_block"],
    settings: {
      include_margins: true,
    },
  };

  const order = Array.isArray(index.order)
    ? [...index.order]
    : Object.keys(index.sections);
  if (!order.includes("enarte_home_try_section")) {
    order.unshift("enarte_home_try_section");
  } else {
    const idx = order.indexOf("enarte_home_try_section");
    if (idx > 0) {
      order.splice(idx, 1);
      order.unshift("enarte_home_try_section");
    }
  }
  index.order = order;

  await putAsset(
    "templates/index.json",
    header.trimStart() + JSON.stringify(index, null, 2) + "\n",
  );
  console.log("index_updated");

  const verifySettings = JSON.parse(
    stripComment(await getAsset("config/settings_data.json")),
  );
  const { target: vs } = getMutableSettings(verifySettings);
  const homeEmbed = vs.blocks?.enarte_home_try_embed;
  const productEmbed = vs.blocks?.enarte_try_embed;
  console.log(
    "verify_product_embed",
    productEmbed?.disabled === false &&
      String(productEmbed?.type || "").includes("enarte-try-embed") &&
      String(productEmbed?.settings?.app_base_url || "").length > 0
      ? "OK"
      : "FAIL",
    JSON.stringify({
      disabled: productEmbed?.disabled,
      show_mode: productEmbed?.settings?.show_mode,
      app_base_url: productEmbed?.settings?.app_base_url,
      type: productEmbed?.type,
    }),
  );

  console.log(
    "verify_home_embed",
    homeEmbed?.disabled === false &&
      String(homeEmbed?.type || "").includes("home-try-embed")
      ? "OK"
      : "FAIL",
    JSON.stringify(homeEmbed),
  );

  const verifyIndex = JSON.parse(
    stripComment(await getAsset("templates/index.json")),
  );
  const section = verifyIndex.sections?.enarte_home_try_section;
  const block = section?.blocks?.enarte_home_try_block;
  const inOrder = (verifyIndex.order || []).includes("enarte_home_try_section");
  console.log(
    "verify_index_block",
    block && String(block.type || "").includes("home-try") && inOrder
      ? "OK"
      : "FAIL",
    JSON.stringify({
      type: block?.type,
      inOrder,
      orderIndex: (verifyIndex.order || []).indexOf("enarte_home_try_section"),
    }),
  );
} finally {
  await prisma.$disconnect();
}
