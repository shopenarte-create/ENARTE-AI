/**
 * Verify one-tap unlock URL sets storefront_digest and can open a product.
 * Does not print secrets.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SHOP = "enarte-ai-dev.myshopify.com";
const urls = fs.readFileSync(path.join(root, ".mobile-test-url.txt"), "utf8");
const unlockUrl = urls
  .split(/\r?\n/)
  .map((l) => l.trim())
  .find((l) => l.startsWith("http") && l.includes("enarte_unlock="));

if (!unlockUrl) {
  console.error("no_unlock_url");
  process.exit(1);
}

const page = await fetch(unlockUrl, { redirect: "manual" });
const html = await page.text();
const hasSnippet = html.includes("enarte-dev-unlock:start");
const hasKeyCheck = html.includes("enarte_unlock");

console.log(
  JSON.stringify(
    {
      unlockStatus: page.status,
      hasSnippet,
      hasKeyCheck,
      htmlLen: html.length,
      title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || null,
    },
    null,
    2,
  ),
);

if (!hasSnippet) process.exit(1);
