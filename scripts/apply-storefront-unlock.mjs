/**
 * Patch Horizon password layout for one-tap mobile unlock, then push live theme.
 *
 * Usage:
 *   node scripts/apply-storefront-unlock.mjs
 *   node scripts/apply-storefront-unlock.mjs --push
 *
 * Does not print the storefront password.
 */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SHOP = "enarte-ai-dev.myshopify.com";
const LIVE_THEME_ID = "159616794869";
const THEME_PATH = path.join(root, ".theme-password-patch");
const KEY_FILE = path.join(root, ".enarte-unlock-key");
const URL_FILE = path.join(root, ".mobile-test-url.txt");
const DEFAULT_PRODUCT =
  "/products/%D8%AB%D8%B1%D9%8A%D8%A7-%D8%A8%D8%A7%D8%A8%D9%84%D8%B2-%D9%82%D9%88%D8%B3-led-%D9%85%D9%88%D8%AF%D8%B1%D9%86";

const MARKER_START = "<!-- enarte-dev-unlock:start -->";
const MARKER_END = "<!-- enarte-dev-unlock:end -->";

function loadStorePassword() {
  const file = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
    "shopify-cli-theme-store-password-nodejs/Config/config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const nested = raw?.["enarte-ai-dev"]?.myshopify?.com;
  if (typeof nested === "string" && nested.length > 0) return nested;
  if (process.env.STOREFRONT_PASSWORD) return process.env.STOREFRONT_PASSWORD;
  throw new Error("STORE_PASSWORD_NOT_FOUND");
}

function loadOrCreateUnlockKey() {
  if (process.env.ENARTE_UNLOCK_KEY) return process.env.ENARTE_UNLOCK_KEY;
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, "utf8").trim();
  }
  const key = crypto.randomBytes(18).toString("base64url");
  fs.writeFileSync(KEY_FILE, key + "\n", "utf8");
  return key;
}

function buildUnlockSnippet(unlockKey, password) {
  // Password is only rendered into HTML when the unlock key query matches.
  // Never ship the password on the public password page for all visitors.
  const keyLiquid = unlockKey.replace(/'/g, "\\'");
  const pwLiquid = password.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `${MARKER_START}
{% if request.query.enarte_unlock == '${keyLiquid}' %}
<script>
(function () {
  try {
    var next = {{ request.query.next | default: '/' | json }};
    if (!next || next.charAt(0) !== "/") next = "/";
    try { sessionStorage.setItem("enarte_sf_next", next); } catch (e) {}

    var input = document.querySelector('#Password, input[name="password"]');
    var form = input && input.closest("form");
    if (!input || !form) return;
    input.value = '${pwLiquid}';
    form.requestSubmit ? form.requestSubmit() : form.submit();
  } catch (err) {
    console.warn("enarte unlock failed", err);
  }
})();
</script>
{% endif %}
${MARKER_END}`;
}

function patchPasswordLayout(unlockKey, password) {
  const layoutPath = path.join(THEME_PATH, "layout", "password.liquid");
  if (!fs.existsSync(layoutPath)) {
    throw new Error(`Missing ${layoutPath} — pull theme first`);
  }
  let html = fs.readFileSync(layoutPath, "utf8");
  const snippet = buildUnlockSnippet(unlockKey, password);
  const blockRe = new RegExp(
    `${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`,
    "g",
  );
  html = html.replace(blockRe, "");
  if (!html.includes("</body>")) {
    throw new Error("password.liquid missing </body>");
  }
  html = html.replace("</body>", `${snippet}\n  </body>`);
  fs.writeFileSync(layoutPath, html, "utf8");
}

function writeUrls(unlockKey) {
  const unlockBase = `https://${SHOP}/password?enarte_unlock=${encodeURIComponent(unlockKey)}`;
  const productUnlock = `${unlockBase}&next=${DEFAULT_PRODUCT}`;
  const directProduct = `https://${SHOP}${decodeURIComponent(DEFAULT_PRODUCT)}`;
  const tunnel = fs.existsSync(path.join(root, ".preview-url.txt"))
    ? fs.readFileSync(path.join(root, ".preview-url.txt"), "utf8").trim()
    : "";
  const appShortcut = tunnel
    ? `${tunnel.replace(/\/$/, "")}/dev/mobile-test?next=${DEFAULT_PRODUCT}`
    : "";

  const text = [
    "# Open this on your phone (one tap unlocks storefront + opens product)",
    productUnlock,
    "",
    "# Same unlock, then home",
    unlockBase,
    "",
    "# After unlock cookie exists, direct product URL works",
    directProduct,
    "",
    appShortcut ? `# App shortcut (requires tunnel)` : "",
    appShortcut,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  fs.writeFileSync(URL_FILE, text, "utf8");
  return { productUnlock, unlockBase, appShortcut };
}

function pushTheme() {
  const result = spawnSync(
    "npx",
    [
      "shopify",
      "theme",
      "push",
      "--store",
      SHOP,
      "--theme",
      LIVE_THEME_ID,
      "--path",
      THEME_PATH,
      "--only",
      "layout/password.liquid",
      "--allow-live",
    ],
    { cwd: root, encoding: "utf8", shell: true },
  );
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) {
    throw new Error(`theme push failed (${result.status})`);
  }
}

const shouldPush = process.argv.includes("--push");
const password = loadStorePassword();
const unlockKey = loadOrCreateUnlockKey();
patchPasswordLayout(unlockKey, password);
const urls = writeUrls(unlockKey);

console.log("password_layout_patched", true);
console.log("unlock_key_saved", KEY_FILE);
console.log("mobile_urls_saved", URL_FILE);
console.log("product_unlock_url", urls.productUnlock);
if (urls.appShortcut) console.log("app_shortcut", urls.appShortcut);

if (shouldPush) {
  console.log("pushing_live_password_layout...");
  pushTheme();
  console.log("push_done", true);
} else {
  console.log("next", "Re-run with --push to publish to the live Horizon theme");
}
