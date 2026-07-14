import { PrismaClient } from "@prisma/client";

function withFastConnectTimeout(url) {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  if (/[?&]connect_timeout=/i.test(raw)) return raw;
  return raw.includes("?")
    ? `${raw}&connect_timeout=2`
    : `${raw}?connect_timeout=2`;
}

const datasourceUrl = withFastConnectTimeout(process.env.DATABASE_URL);

const prismaOptions = datasourceUrl
  ? { datasources: { db: { url: datasourceUrl } } }
  : undefined;

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient(prismaOptions);
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient(prismaOptions);

export default prisma;
