# Sprint 9 — AI Conversation (OpenAI behind Decision Engine)

**Phase:** `sprint9.ai_conversation`  
**Status:** In progress (conversation path live; vision / FAQ / NLU signals still open)  
**Prior:** Sprint 8 Prompt System + AI Constitution  

## Goal

Ship free-text ENARTE assistant conversations via OpenAI Responses API **with tool calling**, without letting the model own business truth or invent products/prices.

## Architecture rules (unchanged)

| Rule | Owner |
|------|--------|
| Routing / UX decisions | Decision Engine |
| Business truth | Knowledge Manager |
| Catalog truth | Shopify Catalog Adapter |
| Model calls | AI Adapter → OpenAI provider (gated) |
| OpenAI is never “the assistant” | Tools + Knowledge only for facts |

## Delivered on disk

| Piece | Location |
|-------|----------|
| Free-text gate | `ai/conversation.js` |
| DE route → `ai_assisted_chat` | `brain/decision-engine.js` |
| Workflow | `workflows/ai-assisted-chat.js` |
| Capability | `assistant.converse` |
| Provider | `ai/providers/openai.js` |
| Responses client + tool loop | `openai-responses.server.js` |
| Tools | `ai/tools/definitions.js`, `ai/tools/runner.js` |
| Constitution | `ai/prompts/constitution.js` |
| Degraded fallback | `general_chat` when LLM unavailable |

Enable with `OPENAI_API_KEY` (auto) or `ASSISTANT_FEATURE_LLM=true`. Explicit `ASSISTANT_FEATURE_LLM=false` keeps deterministic V1 paths.

## Honesty fix (this sprint continuation)

Image / room welcome actions still **ask for a photo** (entry UX), but when a photo arrives and vision is not wired:

- Reply with Knowledge `imageSearchDisabled` / `roomAnalysisDisabled` (never claim analysis ran)
- Offer recovery smart actions (`AFTER_IMAGE_NO_MATCH`: describe / search / talk / feedback)

`ASSISTANT_FEATURE_IMAGE_TOOLS` remains off by default until a real vision pipeline exists.

## Critical repair (disk recovery)

`workflows/_catalog-independent-consult.js` was empty on disk (never committed) and broke module load. Restored:

- `mergeConversationSlots` / `hasSearchableIntent` / `nextFollowUpSlot`
- `buildSearchArtifactsFromSlots` / `buildCatalogIndependentConsult`

Also restored missing `setConversationState` export used by AI chat, and fixed outdoor/chandelier slot picking so canned smart-action openers no longer skip the room clarify.

## Still open

1. **FAQ** knowledge module (await ENARTE content — no invention)
2. **Vision** — `vision.analyze_room` / `vision.search_image` + `VISION` adapter
3. **Virtual placement** — still MVP-disabled
4. **NLU / intent signal kinds** — prompt slots `contentReady: false`; OpenAI implements `assistant_chat` only
5. **Checkout cart session** / admin inbox UI
6. **Durable multi-instance session memory** beyond Prisma best-effort

## Tests

```bash
npm run test:assistant
npm run test:ai
```

## Explicit non-goals (still)

- Invented ENARTE FAQ, prices, policies
- Creative LLM answers that bypass Knowledge / catalog tools
- Vision implementation without explicit approval + Knowledge image rules
