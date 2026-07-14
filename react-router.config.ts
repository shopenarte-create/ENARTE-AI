import type { Config } from "@react-router/dev/config";

/** Route matching stays at `/` — Shopify app proxy strips `/apps/enarte-ai` before forwarding. */
export default {
  basename: "/",
} satisfies Config;
