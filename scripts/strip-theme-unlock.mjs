import fs from "fs";

const p = ".theme-password-patch/layout/password.liquid";
let h = fs.readFileSync(p, "utf8");
const start = "<!-- enarte-dev-unlock:start -->";
const end = "<!-- enarte-dev-unlock:end -->";
const i = h.indexOf(start);
const j = h.indexOf(end);
if (i >= 0 && j > i) {
  h = h.slice(0, i) + h.slice(j + end.length);
  h = h.replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(p, h);
}
console.log(
  JSON.stringify({
    stripped: !h.includes("enarte-dev-unlock"),
    noSecret: !h.includes("input.value"),
  }),
);
