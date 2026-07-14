import fs from "fs";
import path from "path";
import os from "os";

const files = process.argv.slice(2);
if (files.length === 0) {
  files.push(path.join(os.tmpdir(), "enarte-product.html"));
}

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const title = (html.match(/<title>(.*?)<\/title>/i) || [])[1] || "";
  console.log(
    JSON.stringify({
      file: path.basename(file),
      len: html.length,
      roots: (html.match(/data-enarte-try-root/g) || []).length,
      buttons: (html.match(/data-enarte-try-button/g) || []).length,
      label: (html.match(/جربها الآن/g) || []).length,
      embed: (html.match(/enarte-try-embed/g) || []).length,
      title: title.slice(0, 100),
      password: /name="password"/.test(html) && html.length < 20000,
    }),
  );
}
