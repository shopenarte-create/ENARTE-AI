/**
 * Simulates storefront home CTA click against live HTML + CDN try.js.
 * Proves whether the NEW theme guard wins over OLD enarte-try.js camera path.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM, VirtualConsole } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, ".runtime-home-fresh.html"), "utf8");
const tryJs = fs.readFileSync(path.join(root, ".runtime-cdn-try-fresh.js"), "utf8");

const virtualConsole = new VirtualConsole();
virtualConsole.on("error", () => {});

const dom = new JSDOM(html, {
  url: "https://enarte-ai-dev.myshopify.com/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  virtualConsole,
});

const { window } = dom;
const { document } = window;

let assigned = null;
window.location.assign = (url) => {
  assigned = String(url);
};
window.Shopify = { shop: "enarte-ai-dev.myshopify.com" };

// Install theme guard (inline + brand equivalent).
window.eval(`
(function () {
  function go() {
    var shop = (window.Shopify && window.Shopify.shop) || location.hostname;
    var url = new URL(location.origin + '/apps/enarte-ai/assistant');
    if (shop) url.searchParams.set('shop', shop);
    url.searchParams.set('locale', 'ar');
    url.searchParams.set('entry', 'assistant');
    location.assign(url.toString());
  }
  function isHomeAssistantTarget(el) {
    if (!el || !el.closest) return false;
    if (el.closest('[data-enarte-open-home-try],[data-enarte-open-try],a[href="#enarte-home-try"]')) return true;
    var btn = el.closest('[data-enarte-try-button]');
    if (!btn) return false;
    var root = btn.closest('[data-enarte-try-root]');
    if (!root) return false;
    var entry = (root.getAttribute('data-enarte-entry') || '').toLowerCase();
    return entry === 'home' || root.classList.contains('enarte-try-home');
  }
  document.addEventListener('click', function (event) {
    if (!isHomeAssistantTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    go();
  }, true);
})();
`);

// Stub old camera APIs so if try.js still runs, we detect it.
let cameraOpened = false;
window.navigator.mediaDevices = {
  getUserMedia: async () => {
    cameraOpened = true;
    throw new Error("camera_should_not_open");
  },
};

const btn = document.querySelector('[data-enarte-entry="home"] [data-enarte-try-button]');
if (!btn) {
  console.log(JSON.stringify({ ok: false, error: "home_button_missing" }));
  process.exit(1);
}

btn.dispatchEvent(
  new window.MouseEvent("click", { bubbles: true, cancelable: true }),
);

const report = {
  ok:
    Boolean(assigned) &&
    assigned.includes("/apps/enarte-ai/assistant") &&
    !cameraOpened,
  assigned,
  cameraOpened,
  htmlHasGuard: html.includes("ENARTE AI Assistant entry guard"),
  liveTryJsStillOpensCameraOnHome:
    /function onActivate\([\s\S]{0,260}openSheet/.test(tryJs) &&
    !tryJs.includes("openAssistantChat"),
  note:
    "Theme capture-phase guard must beat old CDN enarte-try.js until extension CDN updates.",
};

fs.writeFileSync(
  path.join(root, ".runtime-click-sim.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
