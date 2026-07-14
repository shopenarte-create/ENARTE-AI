/**
 * Client-credentials Admin API helper.
 * Used as catalog fallback when Prisma offline sessions are unavailable
 * (e.g. ephemeral local DB down after restart).
 *
 * Only works when the app + shop belong to the same Shopify organization.
 */

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-10";

/** @type {Map<string, { token: string, expiresAt: number }>} */
const tokenCache = new Map();

function normalizeShop(shop) {
  const raw = String(shop || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!raw) return null;
  return raw.includes(".") ? raw : `${raw}.myshopify.com`;
}

async function exchangeClientCredentials(shop) {
  const clientId = String(process.env.SHOPIFY_API_KEY || "").trim();
  const clientSecret = String(process.env.SHOPIFY_API_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("shopify_client_credentials_missing");
  }

  const host = normalizeShop(shop);
  if (!host) throw new Error("shop_required");

  const cached = tokenCache.get(host);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(
    `https://${host}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const detail =
      payload.error_description ||
      payload.error ||
      `http_${response.status}`;
    throw new Error(`shopify_client_credentials_failed:${detail}`);
  }

  const expiresIn = Number(payload.expires_in) || 86_399;
  tokenCache.set(host, {
    token: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  return payload.access_token;
}

/**
 * @param {string} shop
 * @returns {Promise<{ admin: { graphql: Function }, shop: string }>}
 */
export async function getClientCredentialsAdmin(shop) {
  const host = normalizeShop(shop);
  if (!host) throw new Error("shop_required");
  const token = await exchangeClientCredentials(host);

  return {
    shop: host,
    admin: {
      async graphql(query, options = {}) {
        const response = await fetch(
          `https://${host}/admin/api/${API_VERSION}/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": token,
            },
            body: JSON.stringify({
              query,
              variables: options.variables || {},
            }),
          },
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            json?.errors?.[0]?.message ||
              `admin_graphql_http_${response.status}`,
          );
        }
        // Match Shopify app graphql Response-like shape.
        return {
          json: async () => json,
          ok: true,
          status: response.status,
        };
      },
    },
  };
}

export function clearClientCredentialsTokenCache() {
  tokenCache.clear();
}
