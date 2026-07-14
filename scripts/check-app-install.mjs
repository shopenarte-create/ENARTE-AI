import { PrismaClient } from "../generated/prisma/client.ts";

const prisma = new PrismaClient();

try {
  const sessions = await prisma.session.findMany({
    where: { shop: "enarte-ai-dev.myshopify.com" },
  });

  console.log("session_count", sessions.length);
  console.log("scopes", [...new Set(sessions.map((s) => s.scope))]);
  console.log(
    "online_flags",
    sessions.map((s) => s.isOnline),
  );

  const offline = sessions.find((s) => !s.isOnline) || sessions[0];
  if (!offline) {
    console.log("NO_SESSION");
    process.exit(1);
  }

  const res = await fetch(
    `https://${offline.shop}/admin/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": offline.accessToken,
      },
      body: JSON.stringify({
        query: `{
          currentAppInstallation {
            id
            app { title handle apiKey }
            launchUrl
          }
          shop { name myshopifyDomain }
        }`,
      }),
    },
  );

  const json = await res.json();
  console.log("http", res.status);
  console.log(JSON.stringify(json, null, 2));
} finally {
  await prisma.$disconnect();
}
