const SHOP = "enarte-ai-dev.myshopify.com";
const key = "xOz5rOgP8_KlNoZJ-ELw2Bxw";
const withKey = `https://${SHOP}/password?enarte_unlock=${key}`;
const withoutKey = `https://${SHOP}/password`;

async function check(url, label) {
  const res = await fetch(url, {
    headers: { "Cache-Control": "no-cache" },
    redirect: "manual",
  });
  const html = await res.text();
  console.log(
    JSON.stringify({
      label,
      status: res.status,
      location: res.headers.get("location"),
      hasMarker: html.includes("enarte-dev-unlock:start"),
      hasIf: html.includes("request.query.enarte_unlock"),
      hasPasswordAssign: /input\.value\s*=/.test(html),
      hasScriptSubmit: html.includes("requestSubmit"),
      snippet: html.includes("enarte-dev-unlock")
        ? html.slice(
            html.indexOf("enarte-dev-unlock:start"),
            html.indexOf("enarte-dev-unlock:start") + 280,
          )
        : null,
    }),
  );
}

await check(withoutKey, "no_key");
await check(withKey, "with_key");
