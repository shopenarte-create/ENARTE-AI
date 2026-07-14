/**
 * One-click Theme Editor links for ENARTE product-page button.
 */
const API_KEY = "fcbe2a40342d41df221ad481f548d23b";
const SHOP = "enarte-ai-dev.myshopify.com";

const embedUrl =
  `https://${SHOP}/admin/themes/current/editor?context=apps&activateAppId=${API_KEY}/enarte-try-embed`;

const productBlockUrl =
  `https://${SHOP}/admin/themes/current/editor?template=product&addAppBlockId=${API_KEY}/try-now&target=newAppsSection`;

const productBlockIntoExistingSectionUrl =
  `https://${SHOP}/admin/themes/current/editor?template=product&addAppBlockId=${API_KEY}/try-now&target=sectionId:enarte_try_now_section`;

console.log("\n=== REQUIRED (1 click) — enable App Embed on all product pages ===\n");
console.log(embedUrl);
console.log("\nIn Theme Editor:");
console.log('1. Toggle ON  "ENARTE جربها الآن"');
console.log("2. Set App base URL to your current app tunnel (or keep /apps/enarte-ai proxy)");
console.log("3. Click Save");
console.log("\n=== OPTIONAL — also add App Block into product template ===\n");
console.log(productBlockUrl);
console.log("\nThen click Save.\n");
