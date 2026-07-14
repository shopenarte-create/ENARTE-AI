# ENARTE AI Assistant — Knowledge Layer

Schemas, validation, Knowledge Manager, and ENARTE-supplied published documents under `documents/`.

## Architecture freeze (Sprint 6+)

**Do not invent ENARTE business content.**  
Populate modules only when ENARTE supplies knowledge documents.  
`assistant_personality`, `business_rules`, `services`, and `delivery` are published (Modules 1–4). FAQ remains an empty placeholder until supplied.  
See [`../ARCHITECTURE_FREEZE.md`](../ARCHITECTURE_FREEZE.md).

Workflows and the Decision Engine must read business truth through the Knowledge Manager only.

## Goals

- Keep all business knowledge **out of workflows**
- Expose a **single API** (Knowledge Manager / `ctx.knowledge`)
- Make backends **replaceable** (memory → JSON → database → CMS → Shopify → AI)
- Support **versioning**, **localization hooks**, and **hot reload**

## Architecture

```
Workflows / capabilities
        │
        ▼
KnowledgeClient  (ctx.knowledge)
  get | query | bundle | validate | reload
        │
        ▼
Knowledge Manager
  loadAll · validate · cache · hot reload
        │
        ▼
Knowledge Engine (provider resolution)
        │
        ▼
Providers
  provider.memory   ← published docs + placeholders (active)
  provider.null     ← empty fallback
  provider.json     ← stub (future)
  provider.database ← stub (future)
  provider.shopify  ← stub (future)
  provider.cms      ← stub (future)
  provider.ai       ← stub (future)
```

**Rule:** Workflows must **never** import `placeholders/`, `providers/`, or raw schema files. They only use `ctx.knowledge` or `invokeCapability("knowledge.read", ...)`.

## Sprint 1 modules

| Module id | Responsibility |
|-----------|----------------|
| `assistant_personality` | **Published** — identity, mission, tone, product/sourcing/image/room rules |
| `business_rules` | **Published** — delivery, services contact, garage, catalog, sourcing, UX policies |
| `services` | **Published** — installation, maintenance, site inspection, custom lighting |
| `delivery` | **Published** — Amman 6–8h, other cities configurable, future delivery hooks |
| `faq` | FAQ items / categories shape |

Other module ids (`products`, `installation`, `maintenance`, `sourcing`) remain registered empty for later sprints.

## Document envelope

Every module document includes:

- `moduleId`, `version` (semver-like)
- `locale`, `locales[]` (future localization)
- `status` (`placeholder` | `draft` | `published` | `archived`)
- `meta.schemaVersion`, timestamps
- `meta.sources` flags (`json`, `database`, `cms`, `shopify`, `ai`)
- `meta.sync` hooks for database / CMS / Shopify (disabled until wired)
- `content` — module-specific schema (empty placeholders in Sprint 1)

## Knowledge Manager API

```js
import {
  getKnowledgeManager,
  createKnowledgeClient,
  ensureKnowledgeReady,
} from "../services/assistant/knowledge/index.js";

await ensureKnowledgeReady();

const km = getKnowledgeManager();
await km.loadAll();                    // load + validate Sprint 1 set
const delivery = await km.get("delivery");
const check = km.validate("delivery"); // structural validation
await km.reload("delivery");           // hot reload one module
await km.reload();                     // reload all Sprint 1 modules

// Workflow-facing client (preferred)
const knowledge = createKnowledgeClient({ shop, locale: "ar" });
await knowledge.get("faq");
await knowledge.bundle(); // Sprint 1 modules
```

### Caching

- Process-local cache keyed by `moduleId + locale + shop + key`
- `reload()` / `clearCache()` invalidate for hot reload
- Future CMS/Shopify webhooks can call `reload(moduleId)`

## Extension points

### Add a new knowledge module

1. Add id to `constants.js` (`KNOWLEDGE_MODULE_ID`)
2. Add content factory + required keys in `schemas/content.js`
3. Add validation branch in `schemas/validators.js` if needed
4. Register module in `modules/catalog.js`
5. If Sprint-scoped, add placeholder via `placeholders/index.js` + memory provider `supports`
6. Workflows request it with `ctx.knowledge.get("your_module")` — no workflow code changes to providers

### Swap a backend provider

1. Implement `defineKnowledgeProvider({ id, kind, fetch })`
2. `registerKnowledgeProvider(provider)`
3. Set module `preferredProviders` order (e.g. `database` before `memory`)
4. Workflows unchanged

### Localization (future)

- Store per-locale documents or localized fields under `content`
- Pass `locale` into `knowledge.get(id, { locale })`
- Envelope already carries `locale` + `locales[]`

### Shopify / CMS / DB sync (future)

- Enable `meta.sync.shopify|cms|database.enabled`
- Provider `fetch` loads remote data into the same document envelope
- Manager validates, caches, and serves identically

## What Sprint 1 does **not** include

- ENARTE prices, policies, phone numbers, delivery zones, FAQ answers
- Shopify API calls
- OpenAI / LLM calls
- Workflow business logic

## Tests

```bash
npm run test:knowledge
```

Covers Knowledge Manager load/cache/reload and document validation.
