/**
 * Push select theme files via Admin API (offline session).
 * Usage: node scripts/push-theme-files.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const THEME_ID = process.env.ENARTE_THEME_ID || "129484881969";
const SHOP = process.env.ENARTE_SHOP || "jb8xus-wn.myshopify.com";
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";
const ROOT = join(process.cwd(), ".theme-enarte-luxury");

const FILES = [
  "sections/enarte-luxury-hero.liquid",
  "sections/enarte-app-download.liquid",
  "snippets/enarte-app-download.liquid",
  "sections/footer-group.json",
  "config/settings_schema.json",
  "assets/enarte-hero-lighting.css",
  "assets/enarte-hero-lighting.js",
  "templates/index.json",
  "snippets/stylesheets.liquid",
];

function loadDotEnv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  loadDotEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing — cannot load offline session");
  }

  const prisma = new PrismaClient();
  try {
    const session = await prisma.session.findFirst({
      where: {
        shop: SHOP,
        isOnline: false,
      },
      orderBy: { id: "asc" },
    });

    if (!session?.accessToken) {
      throw new Error(`No offline session for ${SHOP}`);
    }

    const token = session.accessToken;
    console.log(`Using offline session for ${SHOP}, theme ${THEME_ID}`);
    console.log(`Files: ${FILES.length}`);

    for (const rel of FILES) {
      const abs = join(ROOT, rel);
      if (!existsSync(abs)) {
        console.error(`MISSING ${rel}`);
        continue;
      }
      const value = readFileSync(abs, "utf8");
      const url = `https://${SHOP}/admin/api/${API_VERSION}/themes/${THEME_ID}/assets.json`;
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          asset: {
            key: rel.replace(/\\/g, "/"),
            value,
          },
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`FAIL ${rel} HTTP ${res.status}: ${text.slice(0, 300)}`);
        throw new Error(`Upload failed for ${rel}`);
      }
      console.log(`OK ${rel}`);
    }

    console.log("DONE — hero lighting files uploaded");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
