# ENARTE AI Assistant — Version 1 (Pre-AI)

**Phase:** `sprint5.v1`  
**Status:** Complete  
**OpenAI:** disabled  
**Image / Room / Virtual placement:** disabled  

## Goal

Stable, fully functional assistant **without AI**, driven by the Knowledge Layer + ENARTE Shopify catalog.

## Objectives checklist

| # | Objective | Status |
|---|-----------|--------|
| 1 | Customer journeys (search, chandelier, fan, outdoor, delivery, installation, maintenance, site inspection, sourcing, feedback) | Done |
| 2 | Conversation state (workflow, previous action, selections, clarification, session memory) | Done |
| 3 | Smart Action Buttons | Done |
| 4 | Response Templates | Done |
| 5 | Product Cards | Done |
| 6 | Product Ranking | Done |
| 7 | Similar Product Flow | Done |
| 8 | Product Not Found Flow | Done |
| 9 | Product Sourcing Request Flow | Done |
| 10 | Conversation History | Done |
| 11 | Session Persistence | Done |
| 12 | Assistant HTTP API | Done |
| 13 | Workflow Registration | Done |
| 14 | Error Handling | Done |
| 15 | Logging | Done |
| 16 | Validation | Done |
| 17 | Manual Testing checklist | Done |
| 18 | Refactor duplicated code | Done |
| 19 | Optimize performance (hot-path Maps + best-effort Prisma) | Done |
| 20 | Technical documentation | Done |

## Customer journeys

| Journey | Workflow | Behavior |
|---------|----------|----------|
| Product Search | `product_search` | Ranked ENARTE cards / similar / sourcing |
| Chandelier | `chandelier` | 1 room question → search |
| Fan | `fan` | 1 room question → search |
| Outdoor Lighting | `outdoor_lighting` | 1 space question → search |
| Delivery | `delivery` | Knowledge (Amman 6–8h) |
| Installation | `installation` | Knowledge + contact |
| Maintenance | `maintenance` | Knowledge + no DIY repair |
| Site Inspection | `site_inspection` | Knowledge offering |
| Product Sourcing | `product_sourcing` | Queue + Knowledge copy + event |
| Suggestions & Feedback | `suggestions_feedback` | Prompt → ack |

## Architecture

```
/assistant UI
  → HTTP API (sessions / messages / actions / status)
  → Decision Engine + Conversation State
  → Intent Router
  → Workflows
  → Knowledge Manager + Catalog Adapter
  → Prisma persistence (best-effort) + in-memory cache
  → formatTurnForChat (templates + product cards)
```

## Conversation state

Tracked per session (`brain/state.js` + conversation metadata):

- `phase`, `currentWorkflow`, `previousAction`
- `clarification` (active / count / lastQuestion)
- `selectedProduct`, `selectedRoom`
- `context` slots (`awaitingCategorySlot`, `awaitingFeedback`, …)
- transcript / history via chat store (+ Prisma messages when DB available)

## Smart Action Buttons (welcome)

Search Product · Chandeliers · Fans · Outdoor · Installation & Maintenance · Site Inspection · Delivery · Talk to Assistant · Suggestions & Feedback  

Hidden: Image Search, Room Recommend (disabled for V1).

Product cards expose **Select** (persists `selectedProduct` on the session) and **View** (catalog URL).

## Product flows

1. **Ranking** — `catalog/search-rank.js` (top-N, exact / ranked / similar / none)  
2. **Similar** — similar mode + Knowledge intro  
3. **Not found** — delegates to `product_sourcing`  
4. **Sourcing** — request queued, Knowledge message, `AssistantEvent` when DB up  
5. **Garage outdoor boost** — outdoor/weather tags preferred when query includes garage  

## HTTP API

| Endpoint | Methods |
|----------|---------|
| `/api/assistant/sessions` | POST create, GET `?id=` (history) |
| `/api/assistant/messages` | POST message / actionId / selectedProduct |
| `/api/assistant/actions` | GET welcome actions |
| `/api/assistant/status` | GET architecture |

Validation: shop / locale / sessionId / message payload (`utils/validation.js`).  
Logging: structured `[assistant]` JSON lines (`utils/logging.js`).

## Session persistence

- In-memory Maps for hot path (dev / tests).  
- Prisma adapter `persistence.prisma`: conversations, messages, events, brain metadata.  
- Degrades gracefully if DB / Prisma models are unavailable (`hasModel` guards).

## Hard rules (V1)

- Do **not** invent ENARTE business rules — Knowledge Layer is the single source of truth.  
- Do **not** call OpenAI for assistant chat.  
- Do **not** implement Image Search, Room Analysis, or Virtual Placement.

## Manual test checklist

```bash
npm run dev
# open /assistant?locale=en
```

- [ ] Welcome + smart actions  
- [ ] Delivery → Amman 6–8 hours  
- [ ] Site Inspection → contact + suitable spaces  
- [ ] Chandeliers / Fans / Outdoor → one clarify → products or sourcing  
- [ ] Select a product card → session keeps `selectedProduct`  
- [ ] Feedback → prompt → thank you  
- [ ] Free text: “I want a fan”, “Tell me about delivery”  
- [ ] Reload session via `GET /api/assistant/sessions?id=…` (with DB)  
- [ ] Confirm no OpenAI / no image / no room analysis / no placement  

## Automated tests

```bash
npm run test:assistant
```

Includes knowledge, product-search, integration, chat-ux, brain, chandelier-journey, mvp, **v1**.

## Remaining (post-V1 / AI phase)

- Wire OpenAI for NLU only (never invent products/prices)  
- Image search, room analysis, virtual placement  
- Checkout + Shopify cart session  
- FAQ knowledge module  
- Durable admin notify inbox UI  
- Auth / multi-tenant hardening  

## Key files (Sprint 5)

- `workflows/fan.js`, `outdoor-lighting.js`, `site-inspection.js`, `_category-journey.js`  
- `adapters/prisma-persistence.js`  
- `utils/locale.js`, `knowledge-ctx.js`, `logging.js`, `validation.js`  
- `ux/chat-api.js` (history + persistence)  
- `components/assistant/*` (cards + select)  
- `SPRINT5_V1.md` (this file)
