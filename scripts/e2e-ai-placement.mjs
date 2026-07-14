/**
 * One-shot E2E: placement plan + gpt-image-1 render.
 * Usage: node scripts/e2e-ai-placement.mjs
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function main() {
  const { composeRoomPlacement } = await import(
    "../app/services/placement/compose.server.js"
  );

  const roomPath = path.join(root, "backups", "phase-6", "e2e-placement.jpg");
  const roomImageBuffer = await fs.readFile(roomPath);

  // Public product reference (Shopify CDN-style PNG/JPG works for fetch)
  const productImageUrl =
    process.env.E2E_PRODUCT_IMAGE_URL ||
    "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";

  const result = await composeRoomPlacement({
    roomImageBuffer,
    placements: [
      {
        markerId: "e2e-marker-1",
        x: 50,
        y: 18,
        lightingType: "chandelier",
        product: {
          id: "gid://shopify/Product/e2e-test",
          title: "E2E Test Chandelier",
          image: productImageUrl,
          collection: "CHANDELIERS",
        },
      },
    ],
  });

  const outDir = path.join(root, "backups", "phase-6-ai");
  await fs.mkdir(outDir, { recursive: true });
  const outImage = path.join(outDir, "e2e-ai-placement-result.png");
  await fs.writeFile(outImage, result.image);

  const summary = {
    success: true,
    rendererId: result.rendererId || result.engineId,
    planId: result.planId,
    mimeType: result.mimeType,
    metaKeys: Object.keys(result.meta || {}),
    rendererIdMeta: result.meta?.rendererId,
    productIds: result.meta?.productIds,
    markerCoordinates: result.meta?.markerCoordinates,
    renderTimestamp: result.meta?.renderTimestamp,
    generationPromptVersion: result.meta?.generationPromptVersion,
    usedEmergencyFallback: result.meta?.usedEmergencyFallback,
    outImage,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (result.meta?.usedEmergencyFallback) {
    console.error("WARNING: Sharp emergency fallback was used — primary AI render failed.");
    process.exitCode = 2;
  }
  if (result.engineId !== "openai-gpt-image-1") {
    console.error("FAIL: expected openai-gpt-image-1, got", result.engineId);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("E2E failed:", error);
  process.exit(1);
});
