import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const count = await prisma.session.count();
  console.log("session_count", count);
  console.log("SESSION_TABLE_OK");
} catch (error) {
  console.error("SESSION_TABLE_ERROR", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
