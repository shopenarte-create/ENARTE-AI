import fs from "fs";

const html = fs.readFileSync(".investigate-home.html", "utf8");
const i = html.indexOf("enarte_home_try_section");
console.log("SECTION_SNIP:", html.slice(Math.max(0, i - 80), i + 850).replace(/\s+/g, " "));
const j = html.indexOf("enarte-boot.js");
console.log("BOOT_TAG:", html.slice(Math.max(0, j - 180), j + 220).replace(/\s+/g, " "));
const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)]
  .map((m) => m[1])
  .filter((u) => /enarte/i.test(u));
console.log("SCRIPTS", scripts);

const bootUrl = scripts[0];
const base = bootUrl.replace(/enarte-boot[^/]*$/, "");
const cssUrl = base + "enarte-try.css";
const jsUrl = base + "enarte-try.js";
for (const url of [cssUrl, jsUrl]) {
  const res = await fetch(url, { method: "GET" });
  console.log("CDN_ASSET", { url, status: res.status, type: res.headers.get("content-type"), len: (await res.arrayBuffer()).byteLength });
}

const css = fs.readFileSync("extensions/enarte-try-in-room/assets/enarte-try.css", "utf8");
const fixedHome = css.indexOf(".enarte-try-wrap--home");
console.log("FIXED_HOME_CSS:\n", css.slice(fixedHome, fixedHome + 700));

const js = fs.readFileSync("extensions/enarte-try-in-room/assets/enarte-try.js", "utf8");
function dumpAround(label, needle) {
  let idx = 0;
  let n = 0;
  while ((idx = js.indexOf(needle, idx)) !== -1 && n < 4) {
    console.log(label, idx, js.slice(Math.max(0, idx - 120), idx + 220).replace(/\s+/g, " "));
    idx += needle.length;
    n++;
  }
}
dumpAround("placeHomeFab", "placeHome");
dumpAround("wrapHome", "enarte-try-wrap--home");
dumpAround("entryHome", 'data-enarte-entry');
dumpAround("hiddenCls", "enarte-try-wrap--hidden");
dumpAround("isHome", "enarte-try-home");

// Check if JS hides duplicate home CTAs
const initIdx = js.indexOf("function initRoot");
console.log("INITROOT:\n", js.slice(initIdx, initIdx + 1200));
