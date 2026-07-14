import fs from "fs";

const header = `/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
`;

function stripComment(raw) {
  return raw.replace(/^\/\*[\s\S]*?\*\//, "").trim();
}

const productPath = "tmp-theme-fix/templates/product.json";
const product = JSON.parse(stripComment(fs.readFileSync(productPath, "utf8")));

if (product.sections?.enarte_try_now_section) {
  delete product.sections.enarte_try_now_section;
  console.log("Removed enarte_try_now_section");
}

if (Array.isArray(product.order)) {
  product.order = product.order.filter((id) => id !== "enarte_try_now_section");
  console.log("Restored order:", product.order);
}

// Ensure no invalid empty apps sections remain
for (const [id, section] of Object.entries(product.sections || {})) {
  if (
    section?.type === "apps" &&
    (!section.blocks || Object.keys(section.blocks).length === 0)
  ) {
    delete product.sections[id];
    if (Array.isArray(product.order)) {
      product.order = product.order.filter((x) => x !== id);
    }
    console.log("Removed empty apps section:", id);
  }
}

fs.writeFileSync(
  productPath,
  header + JSON.stringify(product, null, 2) + "\n",
);
console.log("Wrote", productPath);
