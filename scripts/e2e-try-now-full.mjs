/**
 * Full Try Now API flow against live tunnel:
 * handoff → load /try → place API generate.
 * Usage: ENARTE_TUNNEL_URL=... node --env-file=.env scripts/e2e-try-now-full.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const TUNNEL = (
  process.env.ENARTE_TUNNEL_URL ||
  fs.readFileSync(path.join(root, ".preview-url.txt"), "utf8")
)
  .trim()
  .replace(/\/$/, "");

const PRODUCT = {
  id: "9749995225333",
  title: "ثريا بابلز قوس LED مودرن",
  image:
    "//enarte-ai-dev.myshopify.com/cdn/shop/files/WhatsAppImage2026-06-25at9.11.00PM_2.jpg?v=1783685828&width=1200",
  price: "119.99",
  currency: "JOD",
  url: "https://enarte-ai-dev.myshopify.com/products/ثريا-بابلز-قوس-led-مودرن",
};

async function main() {
  const roomPath = path.join(root, "backups", "phase-6", "e2e-placement.jpg");
  const roomBuf = await fs.promises.readFile(roomPath);
  console.log("tunnel", TUNNEL, "roomBytes", roomBuf.length);

  const fd = new FormData();
  fd.append("roomImage", new Blob([roomBuf], { type: "image/jpeg" }), "room.jpg");
  fd.append("productId", PRODUCT.id);
  fd.append("title", PRODUCT.title);
  fd.append("image", PRODUCT.image);
  fd.append("price", PRODUCT.price);
  fd.append("currency", PRODUCT.currency);
  fd.append("url", PRODUCT.url);

  const handoffRes = await fetch(`${TUNNEL}/api/try-handoff`, {
    method: "POST",
    body: fd,
  });
  const handoff = await handoffRes.json();
  console.log("handoff", handoffRes.status, handoff);
  if (!handoff.success) throw new Error("handoff failed");

  const getRes = await fetch(
    `${TUNNEL}/api/try-handoff?id=${encodeURIComponent(handoff.handoffId)}`,
  );
  const got = await getRes.json();
  console.log("handoff_get", getRes.status, {
    success: got.success,
    hasImage: !!got.imageDataUrl,
    mime: got.mimeType,
  });
  if (!got.success || !got.imageDataUrl) throw new Error("handoff get failed");

  const tryUrl = `${TUNNEL}/try?entry=product&productId=${PRODUCT.id}&title=${encodeURIComponent(PRODUCT.title)}&image=${encodeURIComponent(PRODUCT.image)}&price=${PRODUCT.price}&currency=${PRODUCT.currency}&shop=enarte-ai-dev.myshopify.com&handoff=${handoff.handoffId}`;
  const tryPage = await fetch(tryUrl);
  console.log("try_page", tryPage.status, tryPage.url);

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
          id: `gid://shopify/Product/${PRODUCT.id}`,
          title: PRODUCT.title,
          image: PRODUCT.image.startsWith("//")
            ? `https:${PRODUCT.image}`
            : PRODUCT.image,
          collection: "CHANDELIERS",
        },
      },
    ]),
  );

  console.log("calling /api/place (binary) ...");
  const placeStarted = Date.now();
  const placeRes = await fetch(`${TUNNEL}/api/place?format=binary`, {
    method: "POST",
    body: placeFd,
    headers: { Accept: "image/jpeg" },
  });
  const elapsedMs = Date.now() - placeStarted;
  const metaHeader = placeRes.headers.get("X-Enarte-Meta");
  let placeMeta = null;
  if (metaHeader) {
    placeMeta = JSON.parse(Buffer.from(metaHeader, "base64url").toString("utf8"));
  }
  const imageBuf = Buffer.from(await placeRes.arrayBuffer());
  console.log("place", placeRes.status, {
    success: placeRes.headers.get("X-Enarte-Success") === "1",
    engineId: placeRes.headers.get("X-Enarte-Engine") || placeMeta?.engineId,
    hasImage: imageBuf.length > 1000,
    imageBytes: imageBuf.length,
    elapsedMs,
    timings: placeMeta?.timings || null,
    markerCoordinates: placeMeta?.markerCoordinates || null,
  });

  if (placeRes.headers.get("X-Enarte-Success") !== "1" || imageBuf.length < 1000) {
    console.error("PLACE_FAIL", placeMeta || (await placeRes.text().catch(() => "")));
    process.exit(1);
  }

  const outDir = path.join(root, "backups", "phase-6-ai");
  await fs.promises.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "try-now-e2e-result.png");
  await fs.promises.writeFile(out, imageBuf);
  console.log("saved", out);

  console.log(
    JSON.stringify({
      ok: true,
      tunnel: TUNNEL,
      handoffId: handoff.handoffId,
      tryStatus: tryPage.status,
      placeStatus: placeRes.status,
      engineId: placeRes.headers.get("X-Enarte-Engine") || placeMeta?.engineId,
      elapsedMs,
      imageBytes: imageBuf.length,
      timings: placeMeta?.timings || null,
      usedEmergencyFallback: !!placeMeta?.meta?.usedEmergencyFallback,
    }),
  );
}

main().catch((e) => {
  console.error("E2E_FULL_FAIL", e);
  process.exit(1);
});
