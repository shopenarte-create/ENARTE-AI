import fs from "fs";
const js = fs.readFileSync("extensions/enarte-try-in-room/assets/enarte-try.js", "utf8");
const a = js.indexOf("function pickPrimaryRoot");
console.log(js.slice(a, a + 900));
console.log("\n==== BOOTSTRAP ====\n");
const b = js.indexOf("scrubStickyClones();");
console.log(js.slice(b, b + 1100));
