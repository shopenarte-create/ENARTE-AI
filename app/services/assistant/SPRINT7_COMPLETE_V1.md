# Sprint 7 — Complete ENARTE AI Assistant V1

**Phase:** `sprint7.complete_v1`  
**Status:** Complete — production-ready V1 **before** OpenAI integration  

## Goal

Ship a stable Version 1 where the Decision Engine owns every decision, Knowledge Manager owns business truth, and the AI Adapter is present as an **interface only** (no OpenAI calls, no prompts, no vision).

## Hard exclusions (unchanged)

- Do **not** connect OpenAI  
- Do **not** author prompt bodies  
- Do **not** implement image analysis / room analysis / virtual placement  

## Requirements checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | All assistant workflows | Done (V1 journeys active; vision/placement disabled) |
| 2 | All customer journeys | Done |
| 3 | Session management | Done |
| 4 | Conversation memory | Done (`memory.read` / `memory.write` + runner probe) |
| 5 | Smart Action Buttons | Done (+ Similar Products after cards) |
| 6 | Response templates | Done (Knowledge personality) |
| 7 | Product cards | Done |
| 8 | Recommendation flow | Done (`product_recommendations` + `catalog.recommend`) |
| 9 | Product sourcing | Done |
| 10–14 | Delivery / install / maintenance / site inspection / feedback | Done |
| 15–18 | API / validation / errors / logging | Done |
| 19–20 | Unit + integration tests | Done (`test:complete-v1` + suite) |
| 21–23 | Performance / dedupe / refactor | Done (catalog cache, shared CORS, category journeys) |
| 24 | Documentation | Done (this file) |
| 25 | Every workflow uses DE + KM + AI Adapter interface | Done |

## Contract: Decision Engine · Knowledge · AI Adapter

```
Chat API
  → decide()                         # Decision Engine owns routing
  → handleTurn() → executeWorkflow()
       → probeAiSignal()             # AI Adapter interface ONLY (degraded)
       → workflow.run()
            → Knowledge readers / knowledge.read
            → catalog.search / catalog.recommend
```

AI probe results are attached to `ctx.metadata.aiSignal` with `usedForDecision: false`.

## New / completed in Sprint 7

- Active `product_recommendations` (catalog-only, no vision)
- Active `catalog.recommend`, `memory.read`, `memory.write`, `notify.admin`
- Active `checkout` handoff + `admin_notifications` + `custom_chandeliers`
- Workflow runner AI Adapter probe
- Catalog TTL cache + in-flight dedupe
- Chandelier journey consolidated onto `_category-journey`
- Shared `utils/http.js` CORS helper
- Knowledge copy: `recommendationsIntro`, `checkoutHandoff`, `adminNotifyAck`

## Tests

```bash
npm run test:complete-v1
npm run test:assistant
```

## Ready for next phase

OpenAI may be wired **only** inside `ai/providers/openai.js`, behind `ai.adapter`, for NLU signals — never as the assistant, never inventing ENARTE products or policies.
