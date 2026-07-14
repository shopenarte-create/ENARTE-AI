import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SHOP = "enarte-ai-dev.myshopify.com";
const handle = "ثريا-بابلز-قوس-led-مودرن";
const cookieJar = path.join(os.tmpdir(), "enarte-sf-cookies.txt");
const outHtml = path.join(os.tmpdir(), "enarte-btn-check.html");
const imgPath = path.join(os.tmpdir(), "enarte-room-test.jpg");

// minimal jpeg
const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08,
  0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a,
  0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d,
  0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22,
  0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34,
  0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0,
  0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
  0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3f, 0x00, 0x7f, 0xbf, 0xff, 0xd9,
]);
fs.writeFileSync(imgPath, jpeg);

const pwFile = path.join(
  process.env.APPDATA,
  "shopify-cli-theme-store-password-nodejs",
  "Config",
  "config.json",
);
const pw = JSON.parse(fs.readFileSync(pwFile, "utf8"))["enarte-ai-dev"].myshopify
  .com;

function curl(args) {
  return execFileSync("curl.exe", args, { encoding: "utf8" });
}

const pwHtml = curl(["-s", "-c", cookieJar, "-b", cookieJar, `https://${SHOP}/password`]);
const token = (pwHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/) ||
  [])[1];
if (!token) throw new Error("NO_TOKEN");

curl([
  "-s",
  "-c",
  cookieJar,
  "-b",
  cookieJar,
  "-X",
  "POST",
  `https://${SHOP}/password`,
  "-H",
  "Content-Type: application/x-www-form-urlencoded",
  "--data-urlencode",
  `authenticity_token=${token}`,
  "--data-urlencode",
  `password=${pw}`,
  "--data-urlencode",
  "form_type=storefront_password",
  "-o",
  "NUL",
]);

const productUrl = `https://${SHOP}/products/${encodeURIComponent(handle)}`;
curl(["-s", "-b", cookieJar, "-c", cookieJar, "-L", productUrl, "-o", outHtml]);

const html = fs.readFileSync(outHtml, "utf8");
const urls = [...html.matchAll(/data-app-url="([^"]+)"/g)].map((m) => m[1]);
console.log("app_urls", [...new Set(urls)]);
console.log("has_old_linux_harvey", html.includes("linux-harvey"));
console.log(
  "has_new_tunnel",
  html.includes("easter-use-imperial-pencil.trycloudflare.com"),
);
console.log("buttons", (html.match(/data-enarte-try-button/g) || []).length);
console.log("img_path", imgPath);
console.log("product_url", productUrl);
