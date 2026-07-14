const url =
  "https://enarte-ai-dev.myshopify.com/products/%D8%AB%D8%B1%D9%8A%D8%A7-%D8%A8%D8%A7%D8%A8%D9%84%D8%B2-%D9%82%D9%88%D8%B3-led-%D9%85%D9%88%D8%AF%D8%B1%D9%86";

const html = await (await fetch(url)).text();
const src = (html.match(/src="([^"]*enarte-try\.js[^"]*)"/) || [])[1];
if (!src) {
  console.log({ ok: false, reason: "no script src" });
  process.exit(1);
}
const abs = src.startsWith("http") ? src : `https:${src}`;
const js = await (await fetch(abs)).text();
console.log(
  JSON.stringify({
    abs,
    bytes: js.length,
    hasLiveCamera: js.includes("openLiveCamera"),
    hasGetUserMedia: js.includes("getUserMedia"),
    hasTakePhoto: js.includes("Take Photo"),
  }),
);
