/**
 * One-off live homepage CTA investigation. Does not print secrets.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SHOP = "enarte-ai-dev.myshopify.com";
const LIVE_THEME_ID = "159616794869";
const EXT_UID = "1238ccbc-57e9-cf7b-ced1-ac72e8ec3e9a27fe316a";

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function loadStorePassword() {
  const file = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
    "shopify-cli-theme-store-password-nodejs/Config/config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const nested = raw?.["enarte-ai-dev"]?.myshopify?.com;
  if (typeof nested === "string" && nested.length) return nested;
  throw new Error("STORE_PASSWORD_NOT_FOUND");
}

function cookiesFrom(res) {
  const raw = res.headers.getSetCookie?.() || [];
  if (raw.length) return raw.map((c) => c.split(";")[0]).join("; ");
  const single = res.headers.get("set-cookie");
  return single
    ? single.split(",").map((c) => c.split(";")[0].trim()).join("; ")
    : "";
}

function mergeCookies(...parts) {
  const map = new Map();
  for (const part of parts) {
    for (const piece of String(part || "").split(";")) {
      const trimmed = piece.trim();
      if (!trimmed || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function snippetsAround(html, needle, radius = 200) {
  const out = [];
  let idx = 0;
  const lower = html.toLowerCase();
  const n = needle.toLowerCase();
  while ((idx = lower.indexOf(n, idx)) !== -1) {
    const start = Math.max(0, idx - radius);
    const end = Math.min(html.length, idx + needle.length + radius);
    out.push({ index: idx, snippet: html.slice(start, end).replace(/\s+/g, " ") });
    idx += needle.length;
    if (out.length >= 8) break;
  }
  return out;
}

function findEnarteBlocks(settings) {
  const results = [];
  const walk = (obj, trail) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => walk(v, `${trail}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      const key = `${trail}.${k}`;
      const type = typeof v === "object" && v ? v.type : null;
      const typeStr = String(type || "");
      const looksEnarte =
        /enarte/i.test(k) ||
        /enarte/i.test(typeStr) ||
        /home-try|try-now|enarte-try/i.test(typeStr) ||
        (typeof v === "object" && v && /enarte|home-try|try-now/i.test(JSON.stringify(v).slice(0, 500)));
      if (looksEnarte && typeof v === "object" && v && ("type" in v || "disabled" in v || "settings" in v)) {
        results.push({
          path: key,
          type: v.type ?? null,
          disabled: v.disabled ?? false,
          block_order: v.block_order ?? null,
          keys: Object.keys(v),
        });
      }
      walk(v, key);
    }
  };
  walk(settings, "root");
  return results;
}

const password = loadStorePassword();
const env = loadEnv();

// 1) Unlock
const page = await fetch(`https://${SHOP}/password`);
const pageHtml = await page.text();
const token = (pageHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/) || [])[1];
const jar1 = cookiesFrom(page);
const unlock = await fetch(`https://${SHOP}/password`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: jar1,
    Origin: `https://${SHOP}`,
    Referer: `https://${SHOP}/password`,
  },
  body: new URLSearchParams({
    authenticity_token: token,
    password,
    form_type: "storefront_password",
    utf8: "✓",
  }),
  redirect: "manual",
});
const jar = mergeCookies(jar1, cookiesFrom(unlock));
const cookieNames = jar.split("; ").map((c) => c.split("=")[0]).filter(Boolean);

// 2) Homepage HTML
const home = await fetch(`https://${SHOP}/`, {
  headers: { Cookie: jar, "Cache-Control": "no-cache", Pragma: "no-cache" },
  redirect: "follow",
});
const html = await home.text();
fs.writeFileSync(path.join(root, ".investigate-home.html"), html, "utf8");

const needles = ["enarte", "data-enarte", "جربها", "home-try", "shopify-block", "apps/enarte"];
const search = {};
for (const n of needles) {
  const hits = snippetsAround(html, n);
  search[n] = { count: (html.toLowerCase().split(n.toLowerCase()).length - 1), hits };
}

// Also count script tags of interest
const bootMatches = [...html.matchAll(/[^"'>\s]*enarte-boot\.js[^"'<\s]*/gi)].map((m) => m[0]);
const tryJsMatches = [...html.matchAll(/[^"'>\s]*enarte-try\.js[^"'<\s]*/gi)].map((m) => m[0]);
const tryCssMatches = [...html.matchAll(/[^"'>\s]*enarte-try\.css[^"'<\s]*/gi)].map((m) => m[0]);
const uuidInHtml = [...html.matchAll(/1238ccbc-[a-f0-9-]+/gi)].map((m) => m[0]);
const anyAppBlockUids = [...html.matchAll(/shopify:\/\/apps\/[^"'\s]+/gi)].map((m) => m[0]);

const isPasswordWall =
  html.includes("Are you the store owner") ||
  (html.includes('name="password"') && html.length < 25000 && /password/i.test(home.url));

// 3) Admin API theme assets
const tokenRes = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: env.SHOPIFY_API_KEY,
    client_secret: env.SHOPIFY_API_SECRET,
    grant_type: "client_credentials",
  }),
});
const tokenJson = await tokenRes.json();
if (!tokenJson.access_token) {
  console.log(JSON.stringify({ error: "no_admin_token", status: tokenRes.status, body: tokenJson }, null, 2));
  process.exit(1);
}
const adminToken = tokenJson.access_token;

async function getAsset(key) {
  const url = `https://${SHOP}/admin/api/2025-01/themes/${LIVE_THEME_ID}/assets.json?asset[key]=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": adminToken, "Content-Type": "application/json" },
  });
  const json = await res.json();
  return { status: res.status, value: json.asset?.value ?? null, error: json.errors || null };
}

const settingsAsset = await getAsset("config/settings_data.json");
const indexAsset = await getAsset("templates/index.json");

let settingsParsed = null;
let enarteBlocks = [];
let settingsUuids = [];
if (settingsAsset.value) {
  // settings_data often has /* comment */ prefix
  const cleaned = settingsAsset.value.replace(/\/\*[\s\S]*?\*\//, "").trim();
  settingsParsed = JSON.parse(cleaned);
  enarteBlocks = findEnarteBlocks(settingsParsed);
  const allStr = JSON.stringify(settingsParsed);
  settingsUuids = [...allStr.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{16,}/gi)].map((m) => m[0]);
  // Also extract shopify://apps/... block types
  const appTypes = [...allStr.matchAll(/shopify:\/\/apps\/[^"\\]+/g)].map((m) => m[0]);
  enarteBlocks = enarteBlocks.concat(
    [...new Set(appTypes)]
      .filter((t) => /enarte|try/i.test(t))
      .map((t) => ({ path: "type-string", type: t, disabled: null })),
  );
}

let indexParsed = null;
let indexOrder = null;
let enarteHomeSection = null;
if (indexAsset.value) {
  const cleaned = indexAsset.value.replace(/\/\*[\s\S]*?\*\//, "").trim();
  indexParsed = JSON.parse(cleaned);
  indexOrder = indexParsed.order || Object.keys(indexParsed.sections || {});
  const sections = indexParsed.sections || {};
  for (const [id, sec] of Object.entries(sections)) {
    const s = JSON.stringify(sec);
    if (/enarte|home.?try|try.?now/i.test(id + s)) {
      enarteHomeSection = { id, section: sec, orderIndex: Array.isArray(indexOrder) ? indexOrder.indexOf(id) : null };
    }
  }
  // specifically named
  if (sections.enarte_home_try_section) {
    enarteHomeSection = {
      id: "enarte_home_try_section",
      section: sections.enarte_home_try_section,
      orderIndex: Array.isArray(indexOrder) ? indexOrder.indexOf("enarte_home_try_section") : null,
      fullOrder: indexOrder,
    };
  }
}

// Deep scan settings for blocks with type containing the uid or enarte
function collectBlocksWithType(obj, trail, acc = []) {
  if (!obj || typeof obj !== "object") return acc;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectBlocksWithType(v, `${trail}[${i}]`, acc));
    return acc;
  }
  if (typeof obj.type === "string" && (/enarte|home-try|try-now|1238ccbc/i.test(obj.type) || /enarte|home-try|try/i.test(trail))) {
    acc.push({
      path: trail,
      type: obj.type,
      disabled: obj.disabled === true,
      settings: obj.settings ?? null,
      block_order: obj.block_order ?? undefined,
    });
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "type" || k === "settings") continue;
    collectBlocksWithType(v, `${trail}.${k}`, acc);
  }
  return acc;
}
const typedBlocks = settingsParsed ? collectBlocksWithType(settingsParsed, "settings") : [];

// Also search current.blocks in settings for app embeds
const currentBlocks = settingsParsed?.current?.blocks || settingsParsed?.current?.sections || null;
let embedBlocks = [];
if (settingsParsed?.current?.blocks) {
  for (const [id, block] of Object.entries(settingsParsed.current.blocks)) {
    const t = String(block?.type || "");
    if (/enarte|try|1238ccbc/i.test(id + t + JSON.stringify(block))) {
      embedBlocks.push({ id, type: block.type, disabled: block.disabled === true, settings: block.settings });
    }
  }
}

// 4) CDN asset checks
async function headOrGet(url) {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow" });
    }
    return { url, status: res.status, finalUrl: res.url, contentType: res.headers.get("content-type") };
  } catch (e) {
    return { url, error: String(e.message || e) };
  }
}

const assetUrls = [...new Set([...bootMatches, ...tryJsMatches, ...tryCssMatches])];
// Also try constructing from known uid
const cdnGuesses = [
  `https://cdn.shopify.com/extensions/${EXT_UID}/assets/enarte-boot.js`,
  `https://cdn.shopify.com/extensions/${EXT_UID}/assets/enarte-try.js`,
  `https://cdn.shopify.com/extensions/${EXT_UID}/assets/enarte-try.css`,
];
const assetChecks = [];
for (const u of [...assetUrls, ...cdnGuesses]) {
  const abs = u.startsWith("http") ? u : u.startsWith("//") ? `https:${u}` : null;
  if (!abs) {
    assetChecks.push({ url: u, note: "relative_or_partial" });
    continue;
  }
  assetChecks.push(await headOrGet(abs));
}

// UUID comparison
const uuidHitsInSettings = [...new Set(settingsUuids)].filter((u) => /1238ccbc|enarte/i.test(u) || u.includes("1238ccbc"));
const allUuidNearExt = [...new Set(settingsUuids)].filter((u) => u.startsWith("1238ccbc") || u.includes("ac72e8ec"));

const report = {
  unlock: {
    status: unlock.status,
    location: unlock.headers.get("location"),
    hasDigest: cookieNames.includes("storefront_digest"),
    cookieNames,
  },
  homepage: {
    status: home.status,
    finalUrl: home.url,
    htmlLength: html.length,
    isPasswordWall,
    title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || null,
    search,
    bootMatches,
    tryJsMatches,
    tryCssMatches,
    uuidInHtml: [...new Set(uuidInHtml)],
    anyAppBlockUids: [...new Set(anyAppBlockUids)].slice(0, 30),
  },
  extension: {
    tomlUid: EXT_UID,
    uuidInSettingsMatchingToml: allUuidNearExt.includes(EXT_UID) || settingsAsset.value?.includes(EXT_UID) || false,
    settingsContainsTomlUid: !!(settingsAsset.value && settingsAsset.value.includes(EXT_UID)),
    indexContainsTomlUid: !!(indexAsset.value && indexAsset.value.includes(EXT_UID)),
    htmlContainsTomlUid: html.includes(EXT_UID),
  },
  themeAssets: {
    settingsStatus: settingsAsset.status,
    indexStatus: indexAsset.status,
    typedBlocks,
    embedBlocks,
    enarteBlocksSummary: enarteBlocks,
    enarteHomeSection,
    indexOrder,
  },
  cdn: assetChecks,
};

fs.writeFileSync(path.join(root, ".investigate-cta-report.json"), JSON.stringify(report, null, 2), "utf8");
if (settingsAsset.value) {
  // Write filtered dump of enarte-related raw slices
  const lines = [];
  const raw = settingsAsset.value;
  const re = /enarte|home-try|try-now|1238ccbc/gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(raw))) {
    const start = Math.max(0, m.index - 120);
    const end = Math.min(raw.length, m.index + 180);
    const snip = raw.slice(start, end).replace(/\s+/g, " ");
    if (!seen.has(snip)) {
      seen.add(snip);
      lines.push(snip);
    }
    if (lines.length >= 40) break;
  }
  fs.writeFileSync(path.join(root, ".investigate-settings-enarte-snips.txt"), lines.join("\n---\n"), "utf8");
}
if (indexAsset.value) {
  fs.writeFileSync(path.join(root, ".investigate-index.json"), indexAsset.value, "utf8");
}
console.log(JSON.stringify(report, null, 2));
