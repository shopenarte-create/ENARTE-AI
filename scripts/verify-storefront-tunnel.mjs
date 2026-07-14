import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SHOP = "enarte-ai-dev.myshopify.com";
const TUNNEL =
  process.env.ENARTE_TUNNEL_URL ||
  fs.readFileSync("shopify.app.toml", "utf8").match(
    /application_url = "(https:\/\/[^"]+trycloudflare\.com)"/,
  )?.[1];
const cookieJar = path.join(os.tmpdir(), "enarte-e2e-cookies.txt");

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

console.log("expect_tunnel", TUNNEL);

const pw = JSON.parse(
  fs.readFileSync(
    path.join(
      process.env.APPDATA,
      "shopify-cli-theme-store-password-nodejs",
      "Config",
      "config.json",
    ),
    "utf8",
  ),
)["enarte-ai-dev"].myshopify.com;

const pwHtml = curl(["-s", "-c", cookieJar, "-b", cookieJar, `https://${SHOP}/password`]);
const token = (pwHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/) || [])[1];
if (token) {
  curl([
    "-s","-c",cookieJar,"-b",cookieJar,"-X","POST",`https://${SHOP}/password`,
    "-H","Content-Type: application/x-www-form-urlencoded",
    "--data-urlencode",`authenticity_token=${token}`,
    "--data-urlencode",`password=${pw}`,
    "--data-urlencode","form_type=storefront_password",
    "-o","NUL",
  ]);
}

const out = path.join(os.tmpdir(), "enarte-final-check.html");
curl([
  "-s","-b",cookieJar,"-c",cookieJar,"-L","-H","Cache-Control: no-cache",
  `https://${SHOP}/products/${encodeURIComponent("ثريا-بابلز-قوس-led-مودرن")}?z=${Date.now()}`,
  "-o",out,
]);

const html = fs.readFileSync(out, "utf8");
const urls = [...new Set([...html.matchAll(/data-app-url="([^"]*)"/g)].map((m) => m[1]))];
const jsUrls = [...html.matchAll(/https:\/\/cdn\.shopify\.com\/extensions\/[^"']+enarte-try\.js/g)].map((m) => m[0]);
console.log("urls", urls);
console.log("buttons", (html.match(/data-enarte-try-button/g) || []).length);
console.log("js", jsUrls);

if (jsUrls[0]) {
  const res = await fetch(jsUrls[0] + "?cb=" + Date.now());
  const text = await res.text();
  console.log("js_status", res.status);
  console.log("js_forced_line", (text.match(/var FORCED_APP_URL = "[^"]+"/) || [])[0]);
  console.log("js_matches_tunnel", text.includes(TUNNEL.replace("https://", "")));
}

const tunnelRes = await fetch(TUNNEL + "/");
console.log("tunnel", tunnelRes.status);
const tryRes = await fetch(`${TUNNEL}/try?entry=product&shop=${SHOP}`);
console.log("try", tryRes.status, /ENARTE|اختر|جرب/i.test(await tryRes.text()));
