/**
 * Quick local place smoke test.
 * Usage: node --env-file=.env scripts/smoke-place.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.SMOKE_PLACE_URL || "http://127.0.0.1:3000";

const room = await sharp({
  create: {
    width: 900,
    height: 700,
    channels: 3,
    background: { r: 220, g: 210, b: 195 },
  },
}).jpeg().toBuffer();

let product = null;
try {
  const res = await fetch("https://enarteshop.com/products.json?limit=20", {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  console.log("products.json status", res.status, "bytes", text.length);
  const json = JSON.parse(text);
  const hit = (json.products || []).find((p) => p?.images?.[0]?.src);
  if (hit) {
    product = {
      id: String(hit.id),
      title: hit.title,
      image: hit.images[0].src,
    };
  }
} catch (err) {
  console.warn("storefront products failed", err.message);
}

if (!product) {
  product = {
    id: "smoke-local",
    title: "Smoke Fixture",
    // Public JPEG — enough to exercise download + OpenAI / Sharp fallback.
    image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
  };
  console.log("using fallback CDN product image");
} else {
  console.log("product", product.title, product.image.slice(0, 80));
}

const form = new FormData();
form.append(
  "roomImage",
  new Blob([room], { type: "image/jpeg" }),
  "room.jpg",
);
form.append(
  "placements",
  JSON.stringify([
    {
      markerId: "m1",
      x: 50,
      y: 18,
      lightingType: "enarte_decide",
      product,
    },
  ]),
);

console.log("POST", `${base}/api/place?format=binary`);
const t0 = Date.now();
const res = await fetch(`${base}/api/place?format=binary`, {
  method: "POST",
  body: form,
  headers: { Accept: "image/jpeg" },
});
const ms = Date.now() - t0;
const buf = Buffer.from(await res.arrayBuffer());
console.log({
  status: res.status,
  ms,
  contentType: res.headers.get("content-type"),
  success: res.headers.get("x-enarte-success"),
  engine: res.headers.get("x-enarte-engine"),
  bytes: buf.length,
});
if (res.headers.get("x-enarte-success") === "1") {
  fs.writeFileSync(path.join(root, ".smoke-place-out.jpg"), buf);
  console.log("wrote .smoke-place-out.jpg");
} else {
  console.log("error body:", buf.toString("utf8").slice(0, 1200));
}
