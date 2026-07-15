import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function railway(args, input) {
  const r = spawnSync("npx", ["--yes", "@railway/cli", ...args], {
    input,
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
  if (r.status !== 0) {
    console.error("FAIL", args.join(" "), (r.stderr || r.stdout || "").slice(0, 600));
    process.exitCode = 1;
    return null;
  }
  return (r.stdout || "").trim();
}

const env = parseEnv(readFileSync(".env", "utf8"));
const keys = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "OPENAI_API_KEY",
  "SCOPES",
  "OPENAI_IMAGE_MODEL",
];

for (const key of keys) {
  const val = env[key];
  if (!val) {
    console.log("SKIP_MISSING", key);
    continue;
  }
  const out = railway(
    ["variable", "set", key, "--stdin", "--service", "ENARTE-AI", "--skip-deploys", "--json"],
    val,
  );
  console.log(out ? `SET ${key}` : `ERR ${key}`);
}

if (!env.SCOPES) {
  railway([
    "variable",
    "set",
    "SCOPES=write_products,read_products,read_themes,write_themes,write_draft_orders,read_draft_orders",
    "--service",
    "ENARTE-AI",
    "--skip-deploys",
    "--json",
  ]);
  console.log("SET SCOPES_DEFAULT");
}

railway([
  "variable",
  "set",
  "DATABASE_URL=${{Postgres.DATABASE_URL}}",
  "--service",
  "ENARTE-AI",
  "--skip-deploys",
  "--json",
]);
console.log("SET DATABASE_URL_REF");

railway([
  "variable",
  "set",
  "NODE_ENV=production",
  "--service",
  "ENARTE-AI",
  "--skip-deploys",
  "--json",
]);
railway([
  "variable",
  "set",
  "PORT=3000",
  "--service",
  "ENARTE-AI",
  "--skip-deploys",
  "--json",
]);
console.log("SET NODE_ENV PORT");
