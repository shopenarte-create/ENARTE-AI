/**
 * E2E Try flow through Shopify app proxy (production storefront path).
 * Usage: node --env-file=.env scripts/e2e-proxy-storefront.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PROXY_BASE =
  process.env.ENARTE_PROXY_BASE || "https://enarteshop.com/apps/enarte-ai";
const SHOP = process.env.ENARTE_SHOP || "jb8xus-wn.myshopify.com";

const PRODUCT = {
  id: "9749995225333",
  title: "ثريا بابلز قوس LED مودرن",
  image:
    "//enarteshop.com/cdn/shop/files/WhatsAppImage2026-06-25at9.11.00PM_2.jpg?v=1783685828&width=1200",
  price: "119.99",
  currency: "JOD",
  url: "https://enarteshop.com/products/ثريا-بابلز-قوس-led-مودرن",
};

async function main() {
  const roomPath = path.join(root, "backups", "phase-6", "e2e-placement.jpg");
  if (!fs.existsSync(roomPath)) {
    throw new Error(`Missing room image: ${roomPath}`);
  }
  const roomBuf = await fs.promises.readFile(roomPath);
  console.log("proxy", PROXY_BASE, "roomBytes", roomBuf.length);

  const pingRes = await fetch(`${PROXY_BASE}/api/try-handoff?id=ping`);
  const ping = await pingRes.json();
  console.log("ping", pingRes.status, ping);
  if (!ping?.pong) throw new Error("proxy ping failed");

  const fd = new FormData();
  fd.append("roomImage", new Blob([roomBuf], { type: "image/jpeg" }), "room.jpg");
  fd.append("productId", PRODUCT.id);
  fd.append("title", PRODUCT.title);
  fd.append("image", PRODUCT.image);
  fd.append("price", PRODUCT.price);
  fd.append("currency", PRODUCT.currency);
  fd.append("url", PRODUCT.url);

  const handoffRes = await fetch(`${PROXY_BASE}/api/try-handoff`, {
    method: "POST",
    body: fd,
  });
  const handoff = await handoffRes.json();
  console.log("handoff", handoffRes.status, {
    success: handoff.success,
    id: handoff.handoffId,
  });
  if (!handoff.success) throw new Error("handoff failed");

  const tryUrl = `${PROXY_BASE}/try?entry=product&productId=${PRODUCT.id}&title=${encodeURIComponent(PRODUCT.title)}&image=${encodeURIComponent(PRODUCT.image)}&price=${PRODUCT.price}&currency=${PRODUCT.currency}&shop=${SHOP}&handoff=${handoff.handoffId}`;
  const tryPage = await fetch(tryUrl);
  const tryHtml = await tryPage.text();
  console.log("try_page", tryPage.status, "bytes", tryHtml.length);

  const wrongAnalyze = await fetch("https://enarteshop.com/api/analyze", {
    method: "POST",
    body: new FormData(),
  }).catch((e) => ({ status: 0, ok: false, error: e.message }));
  console.log(
    "wrong_path_analyze",
    wrongAnalyze.status || "ERR",
    wrongAnalyze.ok === false ? "expected_fail" : "unexpected_ok",
  );

  const analyzeForm = new FormData();
  analyzeForm.append("image", new Blob([roomBuf], { type: "image/jpeg" }), "room.jpg");
  const analyzeRes = await fetch(`${PROXY_BASE}/api/analyze`, {
    method: "POST",
    body: analyzeForm,
  });
  const analyzeText = await analyzeRes.text();
  let analyzeData;
  try {
    analyzeData = JSON.parse(analyzeText);
  } catch {
    throw new Error(`analyze non-json: ${analyzeText.slice(0, 200)}`);
  }
  console.log("analyze", analyzeRes.status, {
    success: analyzeData.success,
    preview: String(analyzeData.result || analyzeData.error || "").slice(0, 120),
  });
  if (!analyzeData.success) throw new Error("analyze failed");

  const productsForm = new FormData();
  productsForm.append("analysis", analyzeData.result || "");
  productsForm.append("shop", SHOP);
  const productsRes = await fetch(`${PROXY_BASE}/api/products`, {
    method: "POST",
    body: productsForm,
  });
  const productsData = await productsRes.json();
  console.log("products", productsRes.status, {
    success: productsData.success,
    count: productsData.products?.length ?? 0,
  });
  if (!productsData.success || !productsData.products?.length) {
    throw new Error("products failed");
  }

  const pick = productsData.products[0];
  const placeFd = new FormData();
  placeFd.append(
    "roomImage",
    new Blob([roomBuf], { type: "image/jpeg" }),
    "room.jpg",
  );
  placeFd.append(
    "placements",
    JSON.stringify([
      {
        markerId: "m1",
        x: 50,
        y: 18,
        lightingType: "chandelier",
        product: {
          id: pick.id,
          title: pick.title,
          image: pick.image,
          price: pick.price,
          currency: pick.currency,
          url: pick.url,
        },
      },
    ]),
  );

  const placeRes = await fetch(`${PROXY_BASE}/api/place?format=binary`, {
    method: "POST",
    body: placeFd,
  });
  console.log("place", placeRes.status, {
    contentType: placeRes.headers.get("content-type"),
    bytes: placeRes.headers.get("content-length") || "(chunked)",
  });
  if (!placeRes.ok) {
    const errText = await placeRes.text();
    throw new Error(`place failed: ${errText.slice(0, 300)}`);
  }

  const outPath = path.join(root, ".e2e-proxy-place.jpg");
  const placeBuf = Buffer.from(await placeRes.arrayBuffer());
  await fs.promises.writeFile(outPath, placeBuf);
  console.log("place_saved", outPath, placeBuf.length);
  console.log("E2E_PROXY_OK");
}

main().catch((err) => {
  console.error("E2E_PROXY_FAIL", err.message);
  process.exitCode = 1;
});
