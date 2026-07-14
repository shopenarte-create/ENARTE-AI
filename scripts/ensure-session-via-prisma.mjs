import { PrismaClient } from "../generated/prisma/client.ts";

const url = process.env.DATABASE_URL;
console.log("using_url_port", (url || "").match(/localhost:(\d+)/)?.[1] || "unknown");

const prisma = new PrismaClient({
  datasources: { db: { url } },
});

try {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  console.log("tables", rows);

  // Ensure session table exists with the exact Shopify-expected shape
  await prisma.$executeRawUnsafe(`
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
    )
  `);

  const count = await prisma.session.count();
  console.log("session_count", count);
  console.log("OK");
} catch (error) {
  console.error("FAIL", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
