# Architecture Freeze — Sprint 6+

**Status:** FROZEN  
**Effective:** 2026-07-13 (Sprint 6)  
**Current phase:** `sprint9.ai_conversation` (see `SPRINT9_AI_CONVERSATION.md`)

## Mandate

From this point forward:

1. **Do not invent ENARTE business rules.**
2. **Do not implement additional workflows** unless explicitly requested after knowledge is supplied.
3. **Do not create generic assistant responses** presented as ENARTE policy, pricing, delivery, installation, or product truth.
4. **Every business rule, customer-facing business response, and domain behavior must come from the Knowledge Layer** once ENARTE provides modules.
5. **OpenAI may assist conversation only via tools + Knowledge + Catalog** — it must never invent products, prices, availability, or policies, and must never replace the Decision Engine.

The assistant must become a **true ENARTE specialist**, not a generic AI.

## What is frozen (keep as-is)

| Layer | Location |
|-------|----------|
| Intent Router | `config/intent-catalog.js`, `core/intent-router.js` |
| Workflow Engine | `core/*`, `workflows/*` |
| Knowledge Engine + Manager | `knowledge/*` |
| Shopify Catalog Adapter | `adapters/shopify-catalog.js` |
| Product Search | `workflows/product-search.js` |
| Decision Engine + State | `brain/*` |
| Chat UX / HTTP / UI | `ux/*`, `routes/api.assistant.*`, `routes/assistant.jsx`, `components/assistant/*` |

## Allowed until knowledge arrives

- Bug fixes that preserve architecture
- Wiring **provided** knowledge modules into existing Knowledge Manager / placeholders
- Replacing temporary UX scaffolding strings **only** with content from supplied knowledge documents

## Not allowed without explicit approval + knowledge

- New domain workflows
- Hardcoded ENARTE prices, regions, SLAs, policies, contact details
- Invented FAQ answers or sales scripts
- LLM “creative” business answers about ENARTE

## Knowledge intake process

ENARTE will provide business knowledge **module by module**.

For each module received:

1. Validate against Sprint 1 schemas (`knowledge/schemas/*`)
2. Load via Knowledge Manager / provider (not into workflows)
3. Point UX / Decision Engine / workflows at `ctx.knowledge.get(moduleId)` only
4. Do not duplicate content inside workflow files

### Expected modules (to be filled by ENARTE)

- `assistant_personality`
- `business_rules`
- `services`
- `delivery`
- `faq`
- (later) products, installation, maintenance, sourcing, etc.

## Temporary scaffolding note

Some canned strings still exist in:

- `ux/format-response.js` (`UX_COPY`) — session chrome / placeholders only
- `config/intent-catalog.js` (`ENGINE_REPLY_TEMPLATES`) — routing clarify / OOD scaffolds

These are **not** final ENARTE business knowledge. They must be replaced or overridden by Knowledge Layer content when ENARTE supplies `assistant_personality` and related modules.

## Phase marker

`ASSISTANT_PHASE = sprint9.ai_conversation`

- Prompt System + AI Constitution: `ai/prompts/*` (`SPRINT8_PROMPT_SYSTEM.md`)
- Free-text OpenAI conversation (tool-gated): `SPRINT9_AI_CONVERSATION.md`
- AI architecture: `SPRINT6_AI_ARCHITECTURE.md`
- Pre-AI Complete V1: `SPRINT7_COMPLETE_V1.md`

Vision / image / room analysis remain **not implemented**. Welcome photo flows must use Knowledge disabled copy until a vision pipeline ships.
