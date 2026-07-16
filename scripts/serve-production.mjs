/**
 * Production server for Shopify app proxy + direct tunnel/admin access.
 *
 * Shopify strips `/apps/enarte-ai` before forwarding, so:
 * - static assets must be available at `/assets/*`
 * - document/API requests must be rematched under basename `/apps/enarte-ai`
 *   when `path_prefix` is present (so browser URL and React Router agree)
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { createRequestHandler } from "@react-router/express";

process.env.NODE_ENV = process.env.NODE_ENV || "production";

function loadDotEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const PROXY_PREFIX = process.env.ENARTE_PROXY_BASENAME || "/apps/enarte-ai";
const BUILD_PATH = path.resolve("build/server/index.js");
const CLIENT_DIR = path.resolve("build/client");

if (!String(process.env.SHOPIFY_APP_URL || "").trim()) {
  console.error(
    "[enarte-serve] SHOPIFY_APP_URL is required (stable https origin for App Proxy).",
  );
  process.exit(1);
}

const buildModule = await import(pathToFileURL(BUILD_PATH).href);

const app = express();
app.disable("x-powered-by");
app.use(compression());

// Proxy-stripped asset path (Shopify → /assets/…)
app.use(
  "/assets",
  express.static(path.join(CLIENT_DIR, "assets"), {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(express.static(CLIENT_DIR, { maxAge: "1h" }));

// Direct access with full proxy prefix (tunnel / debugging)
app.use(
  `${PROXY_PREFIX}/assets`,
  express.static(path.join(CLIENT_DIR, "assets"), {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(PROXY_PREFIX, express.static(CLIENT_DIR, { maxAge: "1h" }));
app.use(express.static("public", { maxAge: "1h" }));

// Direct Android APK download (Expo artifact or local public/download/enarte.apk)
const LOCAL_APK = path.resolve("public/download/enarte.apk");
const REMOTE_APK =
  process.env.ANDROID_APK_URL ||
  "https://expo.dev/artifacts/eas/tTkArR-SICt8c-xtJHzhI3FFxDXF6aRyp6gypyLIjVU.apk";

app.all(["/download/enarte.apk", "/download/enarte-android.apk"], (req, res) => {
  const available = fs.existsSync(LOCAL_APK) || Boolean(REMOTE_APK);
  // HEAD from /app/install must stay same-origin (no redirect) or CORS fails.
  if (req.method === "HEAD" || req.method === "OPTIONS") {
    if (!available) return res.status(404).end();
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Accept-Ranges", "bytes");
    return res.status(200).end();
  }
  if (req.method !== "GET") return res.status(405).end();
  if (fs.existsSync(LOCAL_APK)) {
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="enarte.apk"',
    );
    return res.sendFile(LOCAL_APK);
  }
  if (!REMOTE_APK) return res.status(404).send("APK not available");
  return res.redirect(302, REMOTE_APK);
});

// ENARTE mobile web app (Expo static export) at /app
const MOBILE_WEB_DIR = path.resolve("public/app");
if (fs.existsSync(MOBILE_WEB_DIR)) {
  app.use(
    "/app",
    express.static(MOBILE_WEB_DIR, {
      maxAge: "1h",
      index: false,
      redirect: false,
    }),
  );
  app.get(/^\/app(\/.*)?$/, (req, res, next) => {
    // Don't hijack real asset files under /app/_expo etc. when missing → 404.
    if (path.extname(req.path)) return next();
    const indexHtml = path.join(MOBILE_WEB_DIR, "index.html");
    if (!fs.existsSync(indexHtml)) return next();
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(indexHtml);
  });
  console.log(`[enarte-serve] mobile web mounted at /app → ${MOBILE_WEB_DIR}`);
} else {
  console.warn("[enarte-serve] public/app missing — mobile web not mounted");
}

app.use(morgan("tiny"));

app.all("*", (req, res, next) => {
  const rawPrefix = req.query.path_prefix;
  const prefix =
    typeof rawPrefix === "string" && rawPrefix.startsWith("/")
      ? rawPrefix.replace(/\/$/, "") || PROXY_PREFIX
      : "";

  if (prefix && !String(req.originalUrl || req.url).startsWith(prefix)) {
    const current = req.url.startsWith("/") ? req.url : `/${req.url}`;
    const rewritten = `${prefix}${current}`;
    req.url = rewritten;
    // @react-router/express builds the Request from req.originalUrl, not req.url.
    Object.defineProperty(req, "originalUrl", {
      value: rewritten,
      writable: true,
      configurable: true,
    });
  }

  const requestBuild = prefix
    ? {
        ...buildModule,
        basename: prefix,
        publicPath: `${prefix}/`,
      }
    : buildModule;

  return createRequestHandler({
    build: requestBuild,
    mode: process.env.NODE_ENV,
  })(req, res, next);
});

app.listen(PORT, () => {
  console.log(`[enarte-serve] http://localhost:${PORT}`);
  console.log(`[enarte-serve] SHOPIFY_APP_URL=${process.env.SHOPIFY_APP_URL}`);
  const shop = encodeURIComponent(
    process.env.ASSISTANT_DEFAULT_SHOP || process.env.SHOP || "",
  );
  // Hit the SSR loader so fingerprint cache builds through the production bundle.
  setTimeout(() => {
    fetch(
      `http://127.0.0.1:${PORT}/search-by-image?shop=${shop}&locale=ar`,
    )
      .then((res) => {
        if (res.ok) console.log("[enarte-serve] visual search cache warming");
      })
      .catch((err) =>
        console.warn(
          "[enarte-serve] visual warm skipped:",
          err?.message || err,
        ),
      );
  }, 400);
});
