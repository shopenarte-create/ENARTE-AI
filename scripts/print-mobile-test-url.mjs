/**
 * Print phone-ready unlock URLs (does not print the storefront password).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SHOP = "enarte-ai-dev.myshopify.com";
const PRODUCT =
  "/products/%D8%AB%D8%B1%D9%8A%D8%A7-%D8%A8%D8%A7%D8%A8%D9%84%D8%B2-%D9%82%D9%88%D8%B3-led-%D9%85%D9%88%D8%AF%D8%B1%D9%86";

const tunnel = fs.existsSync(path.join(root, ".preview-url.txt"))
  ? fs.readFileSync(path.join(root, ".preview-url.txt"), "utf8").trim().replace(/\/$/, "")
  : "";

const lines = [
  "# MOBILE TEST — open once on your phone (auto-unlocks storefront password)",
  "",
  "# 1) Homepage — recommend 3 products",
  tunnel
    ? `${tunnel}/dev/mobile-test?next=/`
    : "(tunnel offline — start shopify app dev, then re-run this script)",
  "",
  "# 2) Product page — Try it now / camera / gallery",
  tunnel ? `${tunnel}/dev/mobile-test?next=${PRODUCT}` : "(tunnel offline)",
  "",
  "# After unlock cookie exists on that phone browser:",
  `https://${SHOP}/`,
  `https://${SHOP}${PRODUCT}`,
  "",
  "# Keep running: npx prisma dev  +  npx shopify app dev",
  "",
];

const out = path.join(root, ".mobile-test-url.txt");
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log(lines.join("\n"));
console.log("saved", out);
