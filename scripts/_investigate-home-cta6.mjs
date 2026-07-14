import fs from "fs";
const index = JSON.parse(fs.readFileSync(".investigate-index.json","utf8").replace(/\/\*[\s\S]*?\*\//,"").trim());
console.log(JSON.stringify({
  order: index.order,
  enarte_home_try_section: index.sections.enarte_home_try_section
}, null, 2));

// Confirm unlocked homepage has button text position relative to hero
const html = fs.readFileSync(".investigate-home.html","utf8");
const hero = html.indexOf("hero_jVaWmY") >= 0 || html.includes("Browse our latest products");
const tryPos = html.indexOf("data-enarte-try-button");
const productList = html.indexOf("product_list_fa6P9H");
console.log({
  tryPos,
  productList,
  tryBeforeProducts: tryPos > 0 && tryPos < productList,
  buttonCount: (html.match(/data-enarte-try-button/g)||[]).length,
});
