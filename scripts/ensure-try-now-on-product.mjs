import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SHOP = "enarte-ai-dev.myshopify.com";
const THEME_ID = "159616794869";
const API = "2025-01";
// Dev preview UUID (app embed currently enabled with this)
const DEV_UUID = "019f4cc2-6806-7505-ba0a-8cf34e6bb189";
// Released extension UUID (fallback)
const RELEASED_UUID = "1238ccbc-57e9-cf7b-ced1-ac72e8ec3e9a27fe316a";

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

  // --- settings_data: ensure app embed enabled ---
  const settingsRaw = await getAsset("config/settings_data.json");
  const settings = JSON.parse(stripComment(settingsRaw));
  const { target, via } = getMutableSettings(settings);
  target.blocks = target.blocks || {};

  const enarteKeys = Object.keys(target.blocks).filter((k) =>
    String(target.blocks[k]?.type || "").includes("enarte"),
  );
  console.log("settings_via", via);
  console.log("existing_enarte_embeds", enarteKeys);
  for (const key of enarteKeys) {
    console.log("  ", key, JSON.stringify(target.blocks[key]));
  }

  const uuid = pickUuid(target.blocks);
  console.log("using_uuid", uuid);

  // Keep one enabled embed; disable duplicates
  for (const key of enarteKeys) {
    if (key !== "enarte_try_embed") {
      target.blocks[key].disabled = true;
    }
  }

  target.blocks.enarte_try_embed = {
    type: `shopify://apps/enarte-ai/blocks/enarte-try-embed/${uuid}`,
    disabled: false,
    settings: {
      button_label: "✨ جربها الآن",
      hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
      show_mode: "lighting",
      app_base_url:
        process.env.ENARTE_TUNNEL_URL ||
        "https://easter-use-imperial-pencil.trycloudflare.com",
    },
  };

  await putAsset(
    "config/settings_data.json",
    header + JSON.stringify(settings, null, 2) + "\n",
  );
  console.log("embed_updated");

  // --- product.json: insert Theme App Extension section block ---
  const productRaw = await getAsset("templates/product.json");
  const product = JSON.parse(stripComment(productRaw));
  product.sections = product.sections || {};

  const beforeKeys = Object.keys(product.sections).filter(
    (k) =>
      k.includes("enarte") ||
      JSON.stringify(product.sections[k]).includes("enarte"),
  );
  console.log("product_enarte_sections_before", beforeKeys);

  product.sections.enarte_try_now_section = {
    type: "apps",
    blocks: {
      enarte_try_now_block: {
        type: `shopify://apps/enarte-ai/blocks/try-now/${uuid}`,
        settings: {
          button_label: "✨ جربها الآن",
          hint_text: "التقط صورة غرفتك لتركيب هذه الإنارة",
          show_mode: "lighting",
          app_base_url:
        process.env.ENARTE_TUNNEL_URL ||
        "https://easter-use-imperial-pencil.trycloudflare.com",
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
      order.push("enarte_try_now_section");
    }
  }
  product.order = order;

  await putAsset(
    "templates/product.json",
    header.trimStart() + JSON.stringify(product, null, 2) + "\n",
  );
  console.log("product_template_updated");

  // --- verify ---
  const verifySettings = JSON.parse(
    stripComment(await getAsset("config/settings_data.json")),
  );
  const { target: vs } = getMutableSettings(verifySettings);
  const embed = vs.blocks?.enarte_try_embed;
  console.log(
    "verify_embed",
    embed?.disabled === false &&
      String(embed?.type || "").includes("enarte-try-embed")
      ? "OK"
      : "FAIL",
    JSON.stringify(embed),
  );

  const verifyProduct = JSON.parse(
    stripComment(await getAsset("templates/product.json")),
  );
  const section = verifyProduct.sections?.enarte_try_now_section;
  const block = section?.blocks?.enarte_try_now_block;
  const inOrder = (verifyProduct.order || []).includes("enarte_try_now_section");
  console.log(
    "verify_product_block",
    block &&
      String(block.type || "").includes("try-now") &&
      inOrder
      ? "OK"
      : "FAIL",
    JSON.stringify({
      type: block?.type,
      inOrder,
      orderIndex: (verifyProduct.order || []).indexOf("enarte_try_now_section"),
    }),
  );

  // Find a chandelier product URL
  const productsRes = await fetch(
    `https://${SHOP}/admin/api/${API}/products.json?limit=50&fields=id,title,handle,product_type,tags`,
    { headers: { "X-Shopify-Access-Token": token } },
  );
  const productsJson = await productsRes.json();
  const products = productsJson.products || [];
  const lighting = products.find((p) => {
    const blob = `${p.title} ${p.product_type} ${p.tags} ${p.handle}`.toLowerCase();
    return (
      blob.includes("ثريا") ||
      blob.includes("chandelier") ||
      blob.includes("led") ||
      blob.includes("إنارة") ||
      blob.includes("انارة")
    );
  });
  if (lighting) {
    console.log(
      "sample_product",
      JSON.stringify({
        id: lighting.id,
        title: lighting.title,
        handle: lighting.handle,
        url: `https://${SHOP}/products/${lighting.handle}`,
      }),
    );
  } else {
    console.log("sample_product", "NONE_FOUND");
  }

  // Also keep released UUID noted
  console.log("released_uuid_fallback", RELEASED_UUID);
} finally {
  await prisma.$disconnect();
}
