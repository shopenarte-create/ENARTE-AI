import fs from "fs";

const path = ".env";
let env = fs.readFileSync(path, "utf8");
const newUrl =
  "postgres://postgres:postgres@localhost:51218/template1?pgbouncer=true&connection_limit=1&sslmode=disable";

if (/^DATABASE_URL=/m.test(env)) {
  env = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${newUrl}"`);
} else {
  env += `\nDATABASE_URL="${newUrl}"\n`;
}

fs.writeFileSync(path, env);
console.log("DATABASE_URL set with pgbouncer=true connection_limit=1");
