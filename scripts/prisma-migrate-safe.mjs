import { spawnSync } from "node:child_process";

function run(args) {
  const result = spawnSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

const deployCode = run(["migrate", "deploy"]);
if (deployCode === 0) process.exit(0);

console.warn(
  "[prisma-migrate-safe] migrate deploy failed; attempting to clear failed migration then retry...",
);

const resolveCode = run([
  "migrate",
  "resolve",
  "--rolled-back",
  "20260713180000_assistant_foundation",
]);

if (resolveCode !== 0) {
  console.error("[prisma-migrate-safe] could not resolve failed migration");
  process.exit(resolveCode);
}

const retryCode = run(["migrate", "deploy"]);
process.exit(retryCode);
