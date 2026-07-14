import fs from "fs";

const h = fs.readFileSync(".runtime-home-fresh.html", "utf8");
const t = fs.readFileSync(".runtime-cdn-try-fresh.js", "utf8");

const report = {
  hasGuard: h.includes("ENARTE AI Assistant entry guard"),
  hasBrand: h.includes("enarte-brand.js"),
  hasHomeBtn: /data-enarte-entry="home"/.test(h),
  guardNavigatesToAssistant: h.includes("/apps/enarte-ai/assistant"),
  tryJsHasOpenAssistant: t.includes("openAssistantChat"),
  tryJsStillOldCameraPath:
    /function onActivate\([\s\S]{0,300}openSheet/.test(t) &&
    !t.includes("openAssistantChat"),
};

report.ok =
  report.hasGuard &&
  report.hasBrand &&
  report.hasHomeBtn &&
  report.guardNavigatesToAssistant;

fs.writeFileSync(".runtime-click-sim.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
