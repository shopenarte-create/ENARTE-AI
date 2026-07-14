import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src =
  process.argv[2] ||
  "C:/Users/NTC/.cursor/projects/c-Users-NTC-Desktop-enarte-enarte-ai/assets/c__Users_NTC_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_WhatsApp_Image_2026-07-14_at_7.05.24_PM-e0cbb929-2290-4fe3-9964-9bf762faed9a.png";
const outDir = path.join(root, ".theme-enarte-luxury", "assets");
await fs.promises.mkdir(outDir, { recursive: true });

const meta = await sharp(src).metadata();
console.log("source", meta.width, meta.height, src);

const bandTop = Math.round(meta.height * 0.455);
const bandHeight = Math.round(meta.height * 0.095);
const bandLeft = Math.round(meta.width * 0.052);
const bandWidth = Math.round(meta.width * 0.896);
const bandPath = path.join(outDir, "_enarte-features-band.png");

await sharp(src)
  .extract({ left: bandLeft, top: bandTop, width: bandWidth, height: bandHeight })
  .png()
  .toFile(bandPath);

const gap = Math.max(4, Math.round(bandWidth * 0.012));
const cardW = Math.floor((bandWidth - gap * 2) / 3);
const names = ["room", "ai", "search"];

for (let i = 0; i < names.length; i += 1) {
  const name = names[i];
  const left = i * (cardW + gap);
  const fullPath = path.join(outDir, `enarte-feature-card-${name}.jpg`);
  await sharp(bandPath)
    .extract({ left, top: 0, width: cardW, height: bandHeight })
    .resize({ width: 1200, withoutEnlargement: false })
    .jpeg({ quality: 95 })
    .toFile(fullPath);
  console.log("wrote", name, fullPath);
}
