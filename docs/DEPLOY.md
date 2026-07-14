# ENARTE AI — Production hosting

Goal: replace temporary Cloudflare tunnels with a **stable 24/7 URL**.

## Recommended platforms

| Platform | Best for | Config in repo |
|----------|----------|----------------|
| **Railway** | Fastest setup + Postgres add-on | `railway.json` |
| **Render** | Simple Docker + managed Postgres | `render.yaml` |
| **Fly.io** | EU latency control | `fly.toml` |

All use the same `Dockerfile`.

## Required environment variables

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...          # required (sessions + durable handoffs)
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SCOPES=write_products,read_products,read_themes,write_themes
SHOPIFY_APP_URL=https://YOUR-STABLE-HOST   # no trailing slash
OPENAI_API_KEY=...
```

Optional:

```bash
OPENAI_IMAGE_MODEL=gpt-image-1
STOREFRONT_PASSWORD=...   # only for private/dev storefronts in tests
```

## Deploy steps (Railway example)

1. Create a Railway project + **Postgres** plugin.
2. Connect this GitHub repo (or deploy from CLI).
3. Set the env vars above. Set `SHOPIFY_APP_URL` to the Railway public domain.
4. Deploy. First boot runs `prisma migrate deploy`.
5. In Shopify Partner Dashboard → App setup:
   - Application URL = `https://YOUR-STABLE-HOST`
   - Allowed redirection URLs:
     - `https://YOUR-STABLE-HOST/auth/callback`
     - `https://YOUR-STABLE-HOST/auth/shopify/callback`
     - `https://YOUR-STABLE-HOST/api/auth/callback`
   - App proxy URL = `https://YOUR-STABLE-HOST` (subpath `enarte-ai`, prefix `apps`)
6. Update theme app embed / Home Try / Product Try **App base URL** setting to the same stable host.
7. Run `shopify app deploy` so the theme extension ships with the production URL default (optional but recommended).
8. Soft-reload the storefront and confirm:
   - Homepage “جربها في غرفتك” opens camera/gallery sheet
   - Product “جربها الآن” opens placement flow
   - No “Preparation failed” / connection errors

## Fly.io quick start

```bash
fly launch --no-deploy
fly postgres create
fly postgres attach <db-app-name>
fly secrets set SHOPIFY_API_KEY=... SHOPIFY_API_SECRET=... SHOPIFY_APP_URL=https://enarte-ai.fly.dev OPENAI_API_KEY=... SCOPES=...
fly deploy
```

## Why tunnels break preparation

Storefront JS posts room photos to `APP_BASE_URL/api/try-handoff`.
Cloudflare quick tunnels change on every restart → handoff/fetch fails → customers see preparation / third-party proxy errors.

**Production requirement:** one permanent HTTPS origin + Postgres-backed handoffs (already implemented).

## Current live fix (2026-07-14)

Released app version **enarte-ai-29** with App Proxy pointed at a live tunnel while permanent hosting is finalized:

- Proxy target: `https://clearing-rest-specifications-articles.trycloudflare.com`
- Subpath: `apps/enarte-ai`
- Verified on production storefront:
  - `GET /apps/enarte-ai/api/try-handoff?id=ping` → `{"success":true,"pong":true}` (HTTP 200)
  - `/apps/enarte-ai/assistant` opens ENARTE AI chat (desktop + mobile)
  - No “third-party application” error

**Keep these processes running on the host machine** until Railway/Fly is deployed:

```bash
# terminal A
SHOPIFY_APP_URL=https://YOUR-TUNNEL npm run start

# terminal B
tools/cloudflared.exe tunnel --url http://127.0.0.1:3000 --no-autoupdate
```

If the tunnel URL changes, update `shopify.app.toml` (`application_url`, `redirect_urls`, `[app_proxy].url`) and run:

```bash
npx shopify app deploy --allow-updates --message "Update App Proxy URL"
```

Also set `automatically_update_urls_on_dev = false` so local `shopify app dev` cannot overwrite the production proxy URL.

## Health check

`GET /api/try-handoff?id=ping` → `{ "success": true, "pong": true }`
