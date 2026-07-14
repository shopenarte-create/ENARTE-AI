export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://enarte-ai-production.up.railway.app"
).replace(/\/$/, "");

export const STORE_URL = (
  process.env.EXPO_PUBLIC_STORE_URL || "https://enarteshop.com"
).replace(/\/$/, "");

export const SHOP_DOMAIN =
  process.env.EXPO_PUBLIC_SHOP_DOMAIN || "jb8xus-wn.myshopify.com";

export const DEFAULT_LOCALE = "ar";
