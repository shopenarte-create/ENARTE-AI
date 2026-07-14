/**
 * Push assistant-entry fix to the live Shopify theme + verify CDN/runtime.
 * Does not print secrets. Uses Admin API session from Prisma + storefront unlock.
 *
 * - Puts latest enarte-brand.js on the live theme (immediate storefront effect)
 * - Mirrors fixed enarte-try.js into theme assets (backup)
 * - Verifies unlocked homepage + JS contain openAssistantChat / no home-camera entry
 */
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SHOP = "enarte-ai-dev.myshopify.com";
const API = "2025-01";
const LIVE_THEME_ID = "159616794869";

const brandPath = path.join(
  root,
  ".theme-enarte-luxury",
  "assets",
  "enarte-brand.js",
);
const tryPath = path.join(
  root,
  "extensions",
  "enarte-try-in-room",
  "assets",
  "enarte-try.js",
);

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
    ? single
        .split(",")
        .map((c) => c.split(";")[0].trim())
        .join("; ")
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

async function unlockStorefront() {
  const password = loadStorePassword();
  const pwPage = await fetch(`https://${SHOP}/password`, {
    redirect: "manual",
  });
  const pwHtml = await pwPage.text();
  const token =
    pwHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/)?.[1] ||
    pwHtml.match(/authenticity_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error("NO_AUTH_TOKEN");

  const body = new URLSearchParams({
    authenticity_token: token,
    password,
    form_type: "storefront_password",
    utf8: "✓",
  });
  const unlock = await fetch(`https://${SHOP}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookiesFrom(pwPage),
    },
    body,
    redirect: "manual",
  });
  return mergeCookies(cookiesFrom(pwPage), cookiesFrom(unlock));
}

async function putAsset(token, themeId, key, value) {
  const res = await fetch(
    `https://${SHOP}/admin/api/${API}/themes/${themeId}/assets.json`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ asset: { key, value } }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`PUT ${key} failed ${res.status}`);
  }
  return json.asset?.updated_at || true;
}

const prisma = new PrismaClient();

try {
  const session = await prisma.session.findFirst({
    where: { shop: SHOP, isOnline: false },
  });
  if (!session?.accessToken) throw new Error("NO_SESSION");

  const brandJs = fs.readFileSync(brandPath, "utf8");
  const tryJs = fs.readFileSync(tryPath, "utf8");

  if (!brandJs.includes("openAssistantChat")) {
    throw new Error("brand.js missing openAssistantChat");
  }
  if (!tryJs.includes("openAssistantChat") || !tryJs.includes("isHomeEntry")) {
    throw new Error("enarte-try.js missing assistant home entry fix");
  }

  const brandUpdated = await putAsset(
    session.accessToken,
    LIVE_THEME_ID,
    "assets/enarte-brand.js",
    brandJs,
  );
  const tryUpdated = await putAsset(
    session.accessToken,
    LIVE_THEME_ID,
    "assets/enarte-try.js",
    tryJs,
  );

  const cookie = await unlockStorefront();
  const bust = Date.now();
  const homeRes = await fetch(`https://${SHOP}/?v=${bust}`, {
    headers: {
      Cookie: cookie,
      "Cache-Control": "no-cache",
    },
  });
  const homeHtml = await homeRes.text();

  const brandMatch = homeHtml.match(
    /\/\/cdn\.shopify\.com\/[^"']+enarte-brand\.js[^"']*/,
  );
  const brandUrl = brandMatch ? `https:${brandMatch[0]}` : null;
  let brandLive = "";
  if (brandUrl) {
    brandLive = await (await fetch(brandUrl + (brandUrl.includes("?") ? "&" : "?") + "v=" + bust)).text();
  }

  const cdnTryMatch = homeHtml.match(
    /https:\/\/cdn\.shopify\.com\/extensions\/[^"']+enarte-try\.js/,
  );
  let extensionTry = "";
  if (cdnTryMatch) {
    extensionTry = await (await fetch(cdnTryMatch[0] + "?v=" + bust)).text();
  }

  const report = {
    ok: true,
    themePuts: {
      enarteBrandJs: Boolean(brandUpdated),
      enarteTryJs: Boolean(tryUpdated),
    },
    home: {
      status: homeRes.status,
      hasHomeTryRoot: homeHtml.includes('data-enarte-entry="home"'),
      hasOpenHomeTry: homeHtml.includes("data-enarte-open-home-try"),
      hasPasswordWall: /storefront_password|This store is password protected/i.test(
        homeHtml,
      ),
      brandAssetUrl: brandUrl,
      extensionTryUrl: cdnTryMatch?.[0] || null,
    },
    brandJsLive: {
      hasOpenAssistantChat: brandLive.includes("openAssistantChat"),
      hasCapturePhaseIntercept: brandLive.includes("stopImmediatePropagation"),
      size: brandLive.length,
    },
    extensionTryJsLive: {
      hasOpenAssistantChat: extensionTry.includes("openAssistantChat"),
      stillOpensSheetOnHome:
        /isHomeEntry\(root\)[\s\S]{0,200}openSheet/.test(extensionTry) === false &&
        extensionTry.includes("openAssistantChat")
          ? false
          : /function onActivate[\s\S]{0,400}openSheet/.test(extensionTry) &&
            !extensionTry.includes("openAssistantChat"),
      size: extensionTry.length,
    },
    note:
      "Theme enarte-brand.js intercepts home CTAs immediately. Extension CDN enarte-try.js updates after app deploy; brand intercept is the live safety net.",
  };

  report.ok =
    report.home.hasHomeTryRoot &&
    report.brandJsLive.hasOpenAssistantChat &&
    !report.home.hasPasswordWall;

  fs.writeFileSync(
    path.join(root, ".runtime-assistant-entry-verify.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
