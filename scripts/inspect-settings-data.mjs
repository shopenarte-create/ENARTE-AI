import { PrismaClient } from "../generated/prisma/client.ts";

const prisma = new PrismaClient();
const THEME_ID = "159616794869";
const API = "2025-01";

function stripComment(raw) {
  return raw.replace(/^\/\*[\s\S]*?\*\/\s*/, "");
}

try {
  const session = await prisma.session.findFirst({
    where: { shop: "enarte-ai-dev.myshopify.com", isOnline: false },
  });
  if (!session) throw new Error("NO_SESSION");

  const res = await fetch(
    `https://${session.shop}/admin/api/${API}/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent("config/settings_data.json")}`,
    { headers: { "X-Shopify-Access-Token": session.accessToken } },
  );
  const json = await res.json();
  console.log("status", res.status);
  if (!res.ok) {
    console.log(JSON.stringify(json));
    process.exit(1);
  }
  const raw = json.asset.value;
  const parsed = JSON.parse(stripComment(raw));
  console.log("top_keys", Object.keys(parsed));
  console.log("current_type", typeof parsed.current);
  if (typeof parsed.current === "string") {
    console.log("current_string", parsed.current);
    console.log("presets_keys", Object.keys(parsed.presets || {}));
    const preset = parsed.presets?.[parsed.current];
    if (preset) {
      console.log("preset_keys", Object.keys(preset));
      console.log("preset_blocks", JSON.stringify(preset.blocks || null)?.slice(0, 2000));
    }
  } else {
    console.log("current_keys", Object.keys(parsed.current || {}));
    console.log(
      "blocks",
      JSON.stringify(parsed.current?.blocks || {}, null, 2).slice(0, 2500),
    );
  }
} finally {
  await prisma.$disconnect();
}
