import fs from "fs";
import { execFileSync } from "child_process";

function curl(args) {
  return execFileSync("curl.exe", args, {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
}

const tunnel =
  "https://hearts-org-combinations-players.trycloudflare.com";
curl([
  "-s",
  `${tunnel}/apps/enarte-ai/assistant?shop=jb8xus-wn.myshopify.com&locale=ar&path_prefix=%2Fapps%2Fenarte-ai`,
  "-o",
  ".runtime-prod-build.html",
]);
const h = fs.readFileSync(".runtime-prod-build.html", "utf8");
const hrefs = [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const srcs = [...h.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
const assetish = [...hrefs, ...srcs].filter((u) =>
  /assets|entry|module|node_modules|@vite/i.test(u),
);
console.log(
  JSON.stringify(
    {
      len: h.length,
      hasShell: /ea-shell|ea-panel/.test(h),
      hasNodeModules: /node_modules/.test(h),
      hasVite: /@vite|\.tsx/.test(h),
      assets: assetish.slice(0, 15),
      ping: curl(["-s", `${tunnel}/api/try-handoff?id=ping`]).slice(0, 80),
    },
    null,
    2,
  ),
);
