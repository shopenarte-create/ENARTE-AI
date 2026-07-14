import fs from "fs";
import os from "os";
import path from "path";

const SHOP = "enarte-ai-dev.myshopify.com";
const cfg = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "shopify-cli-theme-store-password-nodejs/Config/config.json",
);
const json = JSON.parse(fs.readFileSync(cfg, "utf8"));
const map = json.themeStorePassword || json;
const pw = map[SHOP] || map[Object.keys(map)[0]];
if (!pw) {
  console.error("no_password");
  process.exit(1);
}

const page = await fetch(`https://${SHOP}/password`);
const html = await page.text();
const inputs = [...html.matchAll(/<input[^>]+>/gi)].map((m) => m[0]);
console.log(
  JSON.stringify(
    {
      status: page.status,
      inputCount: inputs.length,
      inputs: inputs.slice(0, 20),
      hasReturnTo: /return_to|return_url/i.test(html),
      formAction: (html.match(/<form[^>]*action="([^"]*)"/i) || [])[1] || null,
      title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || null,
    },
    null,
    2,
  ),
);
