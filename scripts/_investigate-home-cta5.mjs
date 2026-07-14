import fs from "fs";

const html = fs.readFileSync(".investigate-home.html", "utf8");
const secStart = html.indexOf("enarte_home_try_section");
const heroStart = html.lastIndexOf("shopify-section", secStart);
// find hero section id near before
const before = html.slice(Math.max(0, secStart - 2500), secStart + 200);
console.log("BEFORE_SECTION:\n", before.replace(/\s+/g, " ").slice(-1200));

// count data-enarte-try-root
const roots = [...html.matchAll(/data-enarte-try-root/g)];
console.log("rootCount", roots.length);

// Check if section has any inline style display none
const secChunk = html.slice(secStart - 50, secStart + 1000);
console.log("hasDisplayNone", /display\s*:\s*none/i.test(secChunk));
console.log("hasHiddenAttr", /hidden|aria-hidden/i.test(secChunk));

// Live CDN css home rules
const boot =
  "https://cdn.shopify.com/extensions/019f530f-21d6-7501-8c72-7efff46b6a6a/dev-a737ab14-2b51-4503-8687-7fe485d44d7a/assets/enarte-try.css";
const css = await (await fetch(boot)).text();
const idx = css.indexOf(".enarte-try-home");
console.log("LIVE_CSS_HOME:\n", css.slice(idx - 80, idx + 650));
const idx2 = css.indexOf(".shopify-section .enarte-try-home");
console.log("LIVE_CSS_SECTION_OVERRIDE:\n", css.slice(idx2, idx2 + 450));

// settings UUID vs toml
console.log(
  JSON.stringify(
    {
      tomlUid: "1238ccbc-57e9-cf7b-ced1-ac72e8ec3e9a27fe316a",
      settingsBlockAppId: "019f4cc2-6806-7505-ba0a-8cf34e6bb189",
      cdnExtensionPathId: "019f530f-21d6-7501-8c72-7efff46b6a6a",
      tomlMatchesSettings: false,
      liveRendersDespiteMismatch: true,
    },
    null,
    2,
  ),
);

// password wall without cookie?
const bare = await fetch("https://enarte-ai-dev.myshopify.com/", { redirect: "follow" });
const bareHtml = await bare.text();
console.log(
  JSON.stringify({
    bareStatus: bare.status,
    bareUrl: bare.url,
    bareLen: bareHtml.length,
    bareHasTry: bareHtml.includes("data-enarte-try-button"),
    bareHasPassword: bareHtml.includes('name="password"') || bareHtml.includes("storefront_password"),
    bareTitle: (bareHtml.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim(),
  }),
);
