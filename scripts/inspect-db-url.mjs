import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const m = env.match(/^DATABASE_URL=(.*)$/m);
const raw = (m?.[1] || "").trim().replace(/^["']|["']$/g, "");
console.log("prefix", raw.split("://")[0]);

if (raw.startsWith("prisma+postgres://") || raw.startsWith("postgres://") || raw.startsWith("postgresql://")) {
  const normalized = raw
    .replace(/^prisma\+postgres:\/\//, "https://")
    .replace(/^postgres(ql)?:\/\//, "https://");
  const u = new URL(normalized);
  console.log("host", u.hostname);
  console.log("port", u.port || "(default)");
  console.log("has_api_key", u.searchParams.has("api_key"));
}
