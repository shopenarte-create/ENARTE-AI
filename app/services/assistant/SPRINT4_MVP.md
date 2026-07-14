# Sprint 4 — First Functional ENARTE AI Assistant (MVP)

## Working assistant

**Manual test URL:** `/assistant` (optional `?shop=...&locale=en|ar`)

```bash
npm run dev
# open /assistant
```

**API path (already wired):**

```
Chat UI
  → POST /api/assistant/sessions
  → POST /api/assistant/messages
      → Decision Engine
      → Intent Router (when needed)
      → Workflow
      → Knowledge Manager / readers
      → formatTurnForChat
      → Response + Smart Actions
```

### Welcome Smart Actions

| Button | Workflow |
|--------|----------|
| Search Product | `product_search` |
| Search by Image | `image_search` (ask photo — no auto-camera) |
| Recommend Lighting for My Room | `room_analysis` (ask room photo — no auto-camera) |
| Chandeliers | `chandelier` |
| Fans / Outdoor | `fan` / `outdoor_lighting` |
| Installation & Maintenance | `installation` (+ maintenance knowledge) |
| Delivery | `delivery` |
| Talk to the Assistant | `general_chat` |
| Suggestions & Feedback | `suggestions_feedback` |

**Entry rule:** The assistant always starts with chat (welcome + Smart Actions). The camera never opens on start. Upload/capture appear only after **Recommend Lighting for My Room** or **Search by Image**, and only when the customer taps Upload or Capture.

### Working workflows

| Workflow | Status | Knowledge source |
|----------|--------|------------------|
| Product Search | Active | ENARTE Shopify catalog via `catalog.search` |
| Chandelier Journey | Active | Personality clarify + catalog / sourcing |
| Delivery | Active | `delivery` module |
| Installation & Maintenance | Active | `services` module (+ service rules) |
| Suggestions & Feedback | Active | Personality feedback prompt/ack |
| Image / Room / Placement | Disabled | Personality “not enabled” copy |

OpenAI: **disabled** (`ASSISTANT_FEATURE_LLM=false`).

---

## Architecture report

```
┌─────────────────────────────────────────────────────────────┐
│  /assistant  (AssistantChatApp)                             │
│  Welcome · Smart Actions · Free text Composer               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Chat API (ux/chat-api.js)                                  │
│  sessions · messages · Decision Engine commit               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Decision Engine (brain/)                                   │
│  intent signals · multi-turn slots · smart button sets      │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
     Intent Router (config)          Workflow Runner
                │                             │
                └──────────────┬──────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Workflows (independent)                                    │
│  chandelier · product_search · delivery · installation      │
│  maintenance · suggestions_feedback · general_chat · …      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Manager ← published modules                      │
│  personality · business_rules · services · delivery         │
└─────────────────────────────────────────────────────────────┘
```

**Rules still in force:** no invented ENARTE policies in workflows; Knowledge Layer is the source of business truth; catalog search never uses the public internet.

---

## Remaining gaps before AI integration

1. **FAQ module** — still empty; feedback collects text but does not answer FAQs.
2. **OpenAI / LLM** — not wired for chat; needed later for richer NLU (not product invention).
3. **Image search** — disabled; needs vision capability + Knowledge image rules.
4. **Room analysis** — disabled; needs vision + recommendation pipeline bridge.
5. **Virtual placement** — disabled; existing placement service not connected to assistant.
6. **Checkout** — placeholder graph only; no Shopify checkout session yet.
7. **Product recommendations** — placeholder.
8. **Custom chandeliers** — placeholder (services knowledge exists; no request-queue UX beyond custom message in format-response).
9. **Admin notify / sourcing ops** — sourcing queues in memory; no admin inbox persistence.
10. **Session durability** — chat sessions are in-memory (`Map`); need DB-backed `AssistantConversation` for production.
11. **Other-city delivery times** — configurable later; only Amman 6–8h is published.
12. **Garage outdoor filter** — business rule exists; not enforced in catalog ranking yet.
13. **Localization polish** — bilingual knowledge exists; UI chrome still mixed scaffolding in places.
14. **Auth / storefront embed** — `/assistant` works standalone; Shopify customer auth not required for MVP smoke.

---

## How to verify (checklist)

- [ ] Open `/assistant?locale=en`
- [ ] See welcome + Smart Actions (no Image / Room buttons)
- [ ] Tap **Delivery** → Amman 6–8 hours + other cities note
- [ ] Tap **Installation & Maintenance** → services + `+962782404023`
- [ ] Tap **Chandeliers** → “Which room…?” → reply room → product cards or sourcing
- [ ] Tap **Suggestions & Feedback** → prompt → send text → thank-you
- [ ] Free text: “I want a chandelier” / “Tell me about delivery”
- [ ] Confirm no OpenAI calls (`ASSISTANT_FEATURE_LLM=false`)
