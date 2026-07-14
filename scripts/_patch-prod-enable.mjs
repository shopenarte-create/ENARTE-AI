import fs from "fs";
let s = fs.readFileSync("scripts/enable-production-try.mjs", "utf8");
s = s.replace("enarte-ai-dev.myshopify.com", "jb8xus-wn.myshopify.com");
s = s.replace("159616794869", "129303969841");
s = s.replace(
  "Enable ENARTE homepage Try CTA on the live Horizon theme:",
  "Enable ENARTE Try embeds on PRODUCTION shop (jb8xus-wn / MAIN theme):"
);
s = s.replace(
  /if \(!order\.includes\("enarte_home_try_section"\)\) \{[\s\S]*?index\.order = order;/,
  `if (!order.includes("enarte_home_try_section")) {
    order.unshift("enarte_home_try_section");
  } else {
    const idx = order.indexOf("enarte_home_try_section");
    if (idx > 0) {
      order.splice(idx, 1);
      order.unshift("enarte_home_try_section");
    }
  }
  index.order = order;`
);
if (!s.includes("verify_product_embed")) {
  s = s.replace(
    /console\.log\(\r?\n    "verify_home_embed",/,
    `const productEmbed = vs.blocks?.enarte_try_embed;
  console.log(
    "verify_product_embed",
    productEmbed?.disabled === false &&
      String(productEmbed?.type || "").includes("enarte-try-embed") &&
      String(productEmbed?.settings?.app_base_url || "").length > 0
      ? "OK"
      : "FAIL",
    JSON.stringify({
      disabled: productEmbed?.disabled,
      show_mode: productEmbed?.settings?.show_mode,
      app_base_url: productEmbed?.settings?.app_base_url,
      type: productEmbed?.type,
    }),
  );

  console.log(
    "verify_home_embed",`
  );
}
fs.writeFileSync("scripts/enable-production-try.mjs", s);
console.log(JSON.stringify({
  shop: /jb8xus-wn\.myshopify\.com/.test(s),
  theme: s.includes("129303969841"),
  verify: s.includes("verify_product_embed"),
  noHero: !s.includes("Place early"),
  bytes: Buffer.byteLength(s),
}));