import pg from "pg";

const url =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable";

const client = new pg.Client({ connectionString: url });
await client.connect();

const tables = await client.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
);
console.log("tables", tables.rows.map((r) => r.tablename));

await client.query(`
CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT,
  "expires" TIMESTAMP(3),
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" BOOLEAN,
  "locale" TEXT,
  "collaborator" BOOLEAN,
  "emailVerified" BOOLEAN,
  "refreshToken" TEXT,
  "refreshTokenExpires" TIMESTAMP(3),
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);
`);

const after = await client.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
);
console.log("tables_after", after.rows.map((r) => r.tablename));

const count = await client.query('SELECT COUNT(*)::int AS c FROM "session"');
console.log("session_rows", count.rows[0].c);
console.log("OK");

await client.end();
