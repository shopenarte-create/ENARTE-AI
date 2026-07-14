/**
 * Reproduce POST /api/place?format=binary failures (3 sequential calls).
 * Usage: node --env-file=.env scripts/repro-place-failures.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function readTunnel() {
  const fromEnv = (process.env.ENARTE_TUNNEL_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const p = path.join(ROOT, ".preview-url.txt");
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim().replace(/\/$/, "");
  return "https://saints-between-manufacturers-venice.trycloudflare.com";
}

function checkOpenAIKey() {
  const v = process.env.OPENAI_API_KEY || "";
  const present = Boolean(v && v.trim());
  console.log(`OPENAI_API_KEY present=${present} length=${present ? v.length : 0}`);
  return present;
}

async function createRoomJpeg() {
  const buf = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 210, g: 200, b: 185 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
  const out = path.join(ROOT, ".repro-room.jpg");
  fs.writeFileSync(out, buf);
  console.log(`room JPEG: ${buf.length} bytes @ 800x600 -> ${out}`);
  return buf;
}

async function fetchProductFromStorefront() {
  const url = "https://enarteshop.com/products.json?limit=50";
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "enarte-repro/1.0" },
  });
  if (!res.ok) throw new Error(`storefront products.json HTTP ${res.status}`);
  const json = await res.json();
  const products = json.products || [];
  const withImage = products.find((p) => p?.images?.[0]?.src);
  if (!withImage) throw new Error("no product with image on enarteshop.com");
  return {
    id: String(withImage.id),
    title: withImage.title,
    image: withImage.images[0].src,
    collection: (withImage.product_type || "").toLowerCase() || "lighting",
    source: "storefront",
  };
}

async function fetchProductFromAdmin() {
  const shop = "jb8xus-wn.myshopify.com";
  const key = process.env.SHOPIFY_API_KEY;
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!key || !secret) throw new Error("missing SHOPIFY_API_KEY/SECRET");
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: key,
      client_secret: secret,
      grant_type: "client_credentials",
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(`client_credentials failed ${tokenRes.status}: ${JSON.stringify(tokenJson).slice(0, 200)}`);
  }
  const prodRes = await fetch(
    `https://${shop}/admin/api/2024-10/products.json?limit=10&fields=id,title,image,images,product_type`,
    { headers: { "X-Shopify-Access-Token": tokenJson.access_token } },
  );
  const prodJson = await prodRes.json();
  if (!prodRes.ok) throw new Error(`admin products HTTP ${prodRes.status}`);
  const p = (prodJson.products || []).find((x) => x.image?.src || x.images?.[0]?.src);
  if (!p) throw new Error("no admin product with image");
  return {
    id: String(p.id),
    title: p.title,
    image: p.image?.src || p.images[0].src,
    collection: (p.product_type || "").toLowerCase() || "lighting",
    source: "admin",
  };
}

async function resolveProduct() {
  try {
    const p = await fetchProductFromStorefront();
    console.log(`product source=${p.source} id=${p.id} title=${p.title}`);
    console.log(`product image=${p.image}`);
    return p;
  } catch (e) {
    console.warn("storefront fetch failed:", e.message);
    const p = await fetchProductFromAdmin();
    console.log(`product source=${p.source} id=${p.id} title=${p.title}`);
    console.log(`product image=${p.image}`);
    return p;
  }
}

async function callPlace(baseUrl, roomBuf, product, callIndex) {
  const placements = [
    {
      markerId: "m1",
      x: 0.5,
      y: 0.28,
      lightingType: "enarte_decide",
      product: {
        id: product.id,
        title: product.title,
        image: product.image,
        collection: product.collection,
      },
    },
  ];

  const form = new FormData();
  form.append(
    "roomImage",
    new Blob([roomBuf], { type: "image/jpeg" }),
    "room.jpg",
  );
  form.append("placements", JSON.stringify(placements));

  const url = `${baseUrl.replace(/\/$/, "")}/api/place?format=binary`;
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      body: form,
      headers: { Accept: "image/jpeg" },
    });
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(`\n=== call ${callIndex} FAILED network (${ms}ms) base=${baseUrl} ===`);
    console.log("error:", err.message);
    return { ok: false, network: true, error: err.message, ms };
  }
  const ms = Date.now() - t0;
  const successHdr = res.headers.get("X-Enarte-Success");
  const ct = res.headers.get("Content-Type") || "";
  const ab = await res.arrayBuffer();
  const body = Buffer.from(ab);

  console.log(`\n=== call ${callIndex} base=${baseUrl} ===`);
  console.log(`HTTP ${res.status} timeMs=${ms}`);
  console.log(`X-Enarte-Success=${successHdr}`);
  console.log(`Content-Type=${ct}`);

  const looksJson =
    ct.includes("json") ||
    (body.length > 0 && body[0] === 0x7b) ||
    res.status >= 400;

  if (!res.ok || successHdr === "0" || looksJson) {
    const text = body.toString("utf8");
    console.log(`body first 200 chars: ${text.slice(0, 200)}`);
    console.log("--- FULL ERROR BODY ---");
    console.log(text);
    console.log("--- END ERROR BODY ---");
    return { ok: false, status: res.status, ms, successHdr, ct, body: text };
  }

  console.log(`image bytes=${body.length}`);
  const outPath = path.join(ROOT, `.repro-place-out-${callIndex}.jpg`);
  fs.writeFileSync(outPath, body);
  console.log(`saved ${outPath}`);
  return { ok: true, status: res.status, ms, successHdr, ct, bytes: body.length };
}

async function main() {
  console.log("=== OPENAI key check ===");
  checkOpenAIKey();

  const tunnel = readTunnel();
  const proxy = "https://enarteshop.com/apps/enarte-ai";
  console.log(`tunnel=${tunnel}`);
  console.log(`proxy=${proxy}`);

  const roomBuf = await createRoomJpeg();
  const product = await resolveProduct();

  const bases = [tunnel];
  // Local Vite from shopify app dev (tunnel often returns CF 1033)
  try {
    const localProbe = await fetch("http://localhost:63242/", { method: "GET" });
    if (localProbe.ok) bases.push("http://localhost:63242");
  } catch { /* ignore */ }
  // Probe proxy briefly
  try {
    const probe = await fetch(proxy + "/", { method: "GET", redirect: "manual" });
    console.log(`proxy probe status=${probe.status}`);
    bases.push(proxy); // try even on 5xx
  } catch (e) {
    console.log(`proxy probe failed: ${e.message} (skipping proxy)`);
  }

  const allResults = [];
  for (const base of bases) {
    console.log(`\n######## sequential place x3 against ${base} ########`);
    for (let i = 1; i <= 3; i++) {
      const r = await callPlace(base, roomBuf, product, `${bases.indexOf(base) + 1}.${i}`);
      allResults.push({ base, ...r });
    }
  }

  console.log("\n=== SUMMARY ===");
  for (const r of allResults) {
    console.log(
      JSON.stringify({
        base: r.base,
        ok: r.ok,
        status: r.status,
        ms: r.ms,
        successHdr: r.successHdr,
        bytes: r.bytes,
        network: r.network,
        errPreview: r.body ? r.body.slice(0, 120) : r.error,
      }),
    );
  }

  const failed = allResults.filter((r) => !r.ok);
  console.log(`failed_count=${failed.length}/${allResults.length}`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});


