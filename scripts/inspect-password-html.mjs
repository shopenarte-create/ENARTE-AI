const res = await fetch("https://enarte-ai-dev.myshopify.com/password", {
  redirect: "follow",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36",
    "Cache-Control": "no-cache",
  },
});
const html = await res.text();
console.log(
  JSON.stringify(
    {
      status: res.status,
      finalUrl: res.url,
      len: html.length,
      hasHorizonDialog: html.includes("password-dialog"),
      hasOwnerLogin: html.includes("Are you the store owner"),
      hasEnarte: html.includes("enarte-dev-unlock"),
      hasFormInput: html.includes("form-input"),
      hasEnter: html.includes(">Enter<"),
      sample: html.replace(/\s+/g, " ").slice(0, 400),
      bodyStart: html.slice(html.indexOf("<body"), html.indexOf("<body") + 300),
    },
    null,
    2,
  ),
);
