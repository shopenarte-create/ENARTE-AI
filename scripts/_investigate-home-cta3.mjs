import fs from "fs";

const bootUrl =
  "https://cdn.shopify.com/extensions/019f530f-21d6-7501-8c72-7efff46b6a6a/dev-a737ab14-2b51-4503-8687-7fe485d44d7a/assets/enarte-boot.js";
const base = bootUrl.replace(/enarte-boot[^/]*$/, "");
for (const name of ["enarte-try.css", "enarte-try.js"]) {
  const url = base + name;
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(JSON.stringify({ url, status: res.status, type: res.headers.get("content-type"), len: buf.length }));
}

const css = fs.readFileSync("extensions/enarte-try-in-room/assets/enarte-try.css", "utf8");
const fixedHome = css.indexOf(".enarte-try-wrap--home");
console.log("FIXED_HOME_CSS:\n" + css.slice(fixedHome, fixedHome + 900));

const js = fs.readFileSync("extensions/enarte-try-in-room/assets/enarte-try.js", "utf8");
function dumpAround(label, needle, nMax = 5) {
  let idx = 0;
  let n = 0;
  while ((idx = js.indexOf(needle, idx)) !== -1 && n < nMax) {
    console.log("\n" + label + "@" + idx + ":\n" + js.slice(Math.max(0, idx - 150), idx + 280).replace(/\s+/g, " "));
    idx += needle.length;
    n++;
  }
}
dumpAround("wrapHome", "enarte-try-wrap--home");
dumpAround("entryHome", "data-enarte-entry");
dumpAround("hiddenCls", "enarte-try-wrap--hidden");
dumpAround("isHomeClass", "enarte-try-home");
dumpAround("placeNear", "placeNearBuyButtons");

const initIdx = js.indexOf("function initRoot");
console.log("\nINITROOT:\n" + js.slice(initIdx, initIdx + 1500));

// placement for home roots
const placeIdx = js.indexOf("function place");
console.log("\nAll function place* names:");
let m;
const re = /function (place\w*)/g;
while ((m = re.exec(js))) console.log(m[1], m.index);

const homePlace = js.indexOf('entry === "home"') >= 0 ? js.indexOf('entry === "home"') : js.indexOf("enarte-entry");
console.log("\nENTRY_CHECK:\n" + (homePlace >= 0 ? js.slice(homePlace - 200, homePlace + 400) : "none"));

// dedupe logic
dumpAround("dedupe", "querySelectorAll(\"[data-enarte-try-root\"]");
dumpAround("roots", "data-enarte-try-root");
