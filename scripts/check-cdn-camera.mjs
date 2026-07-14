const url =
  "https://enarte-ai-dev.myshopify.com/products/%D8%AB%D8%B1%D9%8A%D8%A7-%D8%A8%D8%A7%D8%A8%D9%84%D8%B2-%D9%82%D9%88%D8%B3-led-%D9%85%D9%88%D8%AF%D8%B1%D9%86";
const html = await (await fetch(url)).text();
const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
const target = srcs.find((s) => s.includes("enarte-try.js"));
if (!target) {
  console.log(JSON.stringify({ ok: false, reason: "no enarte-try.js in HTML" }));
  process.exit(1);
}
const abs = target.startsWith("http") ? target : `https:${target}`;
const js = await (await fetch(abs + (abs.includes("?") ? "&" : "?") + "v=" + Date.now())).text();
console.log(
  JSON.stringify({
    abs,
    bytes: js.length,
    hasLiveCamera: js.includes("openLiveCamera"),
    hasExactFacing: js.includes("facingMode: { exact:"),
    hasRetryAttempts: js.includes("tryNext"),
    hasShutterDisable: js.includes("shutter.disabled"),
  }),
);
