import fs from "fs";

const h = fs.readFileSync(".runtime-prod-password.html", "utf8");
const forms = [...h.matchAll(/<form[\s\S]*?<\/form>/gi)].map((m) =>
  m[0].slice(0, 800),
);
const csrf =
  h.match(/name=["']authenticity_token["'][^>]*value=["']([^"']+)/i)?.[1] ||
  h.match(/value=["']([^"']+)["'][^>]*name=["']authenticity_token["']/i)?.[1] ||
  null;
console.log(
  JSON.stringify(
    {
      len: h.length,
      hasAuthenticity: /authenticity_token/i.test(h),
      hasPasswordInput: /name=["']password["']/i.test(h),
      csrfFound: Boolean(csrf),
      formCount: forms.length,
      formSnippets: forms.slice(0, 2),
      inputTags: [...h.matchAll(/<(input|button)[^>]*>/gi)]
        .map((x) => x[0])
        .slice(0, 30),
    },
    null,
    2,
  ),
);
