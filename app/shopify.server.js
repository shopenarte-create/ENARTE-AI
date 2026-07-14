import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import prisma from "./db.server";

const useMemorySession =
  String(process.env.ENARTE_MEMORY_SESSION || "").toLowerCase() === "true" ||
  String(process.env.DATABASE_URL || "").includes("localhost:51214");

/**
 * Prefer Prisma when available. Memory mode is used when the local DB host is
 * down — offline tokens must then be hydrated from Prisma once it recovers
 * (see shopify-products getAdminContext).
 */
const sessionStorage = useMemorySession
  ? new MemorySessionStorage()
  : new PrismaSessionStorage(prisma);

if (useMemorySession) {
  console.warn(
    "[enarte] Using MemorySessionStorage (DB unavailable or ENARTE_MEMORY_SESSION=true). Public /assistant still works; admin session persistence is in-memory only.",
  );
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export { sessionStorage };
