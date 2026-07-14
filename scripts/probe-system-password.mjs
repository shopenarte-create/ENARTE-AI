/**
 * Probe system password page unlock (dev stores often ignore theme password.liquid).
 * Does not print the storefront password.
 */
import fs from "fs";
import path from "path";
import os from "os";

const SHOP = "enarte-ai-dev.myshopify.com";

function loadStorePassword() {
  const file = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
    "shopify-cli-theme-store-password-nodejs/Config/config.json",
  );
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const nested = raw?.["enarte-ai-dev"]?.myshopify?.com;
  if (typeof nested === "string" && nested.length) return nested;
  throw new Error("no password");
}

function cookies(res) {
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

const password = loadStorePassword();
const page = await fetch(`https://${SHOP}/password`);
const html = await page.text();
const jar = cookies(page);
const token = (html.match(/name="authenticity_token"[^>]*value="([^"]+)"/) ||
  [])[1];

const attempts = [
  { label: "token+password", body: { authenticity_token: token, password } },
  {
    label: "token+password+form_type",
    body: {
      authenticity_token: token,
      password,
      form_type: "storefront_password",
      utf8: "✓",
    },
  },
  {
    label: "password+form_type_only",
    body: { password, form_type: "storefront_password", utf8: "✓" },
  },
];

for (const attempt of attempts) {
  const res = await fetch(`https://${SHOP}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar,
      Origin: `https://${SHOP}`,
      Referer: `https://${SHOP}/password`,
    },
    body: new URLSearchParams(attempt.body),
    redirect: "manual",
  });
  const set = cookies(res);
  console.log(
    JSON.stringify({
      label: attempt.label,
      status: res.status,
      location: res.headers.get("location"),
      hasDigest: set.includes("storefront_digest"),
      setCookiePreview: set
        .split("; ")
        .map((c) => c.split("=")[0])
        .join(","),
    }),
  );
}
