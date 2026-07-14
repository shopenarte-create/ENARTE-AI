import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();
const SHOP = "enarte-ai-dev.myshopify.com";
const API = "2025-01";
const LIVE_THEME = "159616794869";

function stripComment(raw) {
  return raw.replace(/^\/\*[\s\S]*?\*\/\s*/, "");
}

function findTunnelFromToml() {
  const toml = fs.readFileSync("shopify.app.toml", "utf8");
  const m = toml.match(/application_url\s*=\s*"(https:\/\/[^"]+trycloudflare\.com)"/);
  return m?.[1] || null;
}

function findTunnelFromTerminal() {
  const term =
    process.env.ENARTE_TERM ||
    "C:/Users/NTC/.cursor/projects/c-Users-NTC-Desktop-enarte-enarte-ai/terminals/212684.txt";
  try {
    const text = fs.readFileSync(term, "utf8");
    const matches = [
      ...text.matchAll(/Using URL:\s*(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/gi),
    ];
    return matches.length ? matches[matches.length - 1][1] : null;
  } catch {
    return null;
  }
}

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
    if (!res.ok) {
      return { error: res.status, json };
    }
    return { value: json.asset.value };
  }

  const themesRes = await fetch(
    `https://${SHOP}/admin/api/${API}/themes.json`,
    { headers: { "X-Shopify-Access-Token": token } },
  );
  const themes = (await themesRes.json()).themes || [];
  console.log(
    "themes",
    themes.map((t) => ({ id: t.id, name: t.name, role: t.role })),
  );

  const tunnel = process.env.ENARTE_TUNNEL_URL || findTunnelFromTerminal() || findTunnelFromToml();
  console.log("detected_tunnel", tunnel);

  for (const theme of themes) {
    const settingsAsset = await getAsset(String(theme.id), "config/settings_data.json");
    if (settingsAsset.error) {
      console.log("theme", theme.id, "settings_error", settingsAsset.error);
      continue;
    }
    const settings = JSON.parse(stripComment(settingsAsset.value));
    const blocks = settings.current?.blocks || {};
    for (const [k, b] of Object.entries(blocks)) {
      if (!String(b?.type || "").includes("enarte")) continue;
      console.log(
        "THEME",
        theme.id,
        theme.role,
        "embed",
        k,
        "disabled=" + b.disabled,
        "app_base_url=" + (b.settings?.app_base_url || ""),
      );
    }

    const productAsset = await getAsset(String(theme.id), "templates/product.json");
    if (!productAsset.error) {
      const product = JSON.parse(stripComment(productAsset.value));
      const section = product.sections?.enarte_try_now_section;
      const block = section?.blocks?.enarte_try_now_block;
      console.log(
        "THEME",
        theme.id,
        "product_block_url=" + (block?.settings?.app_base_url || "NONE"),
        "in_order=" + (product.order || []).includes("enarte_try_now_section"),
      );
    }

    const themeLiq = await getAsset(String(theme.id), "layout/theme.liquid");
    if (!themeLiq.error) {
      const hasSnippet = /enarte-try-now|trycloudflare|linux-harvey/.test(
        themeLiq.value,
      );
      console.log("THEME", theme.id, "theme_liquid_enarte_or_oldurl", hasSnippet);
      if (hasSnippet) {
        for (const line of themeLiq.value.split("\n")) {
          if (/enarte|trycloudflare|linux-harvey/i.test(line)) {
            console.log("  line:", line.trim());
          }
        }
      }
    }
  }

  // Also check snippet asset if present on live theme
  const snippet = await getAsset(LIVE_THEME, "snippets/enarte-try-now.liquid");
  if (!snippet.error) {
    const urls = [
      ...snippet.value.matchAll(/https?:\/\/[^\s"'<>]+/g),
    ].map((m) => m[0]);
    console.log("live_snippet_urls", urls);
    console.log(
      "live_snippet_has_old",
      /linux-harvey|referenced-complete/.test(snippet.value),
    );
  } else {
    console.log("live_snippet", "missing_or_error", snippet.error);
  }
} finally {
  await prisma.$disconnect();
}
