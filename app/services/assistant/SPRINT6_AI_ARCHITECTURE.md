# Sprint 6 — OpenAI Integration Architecture (No Implementation)

**Phase:** `sprint6.ai_architecture`  
**Status:** Architecture complete — **no OpenAI calls, no prompt content, no image analysis**

## Goal

Prepare a production-grade AI layer **without** changing assistant ownership.

| Rule | Meaning |
|------|---------|
| OpenAI is not the assistant | Decision Engine + Intent Router + Workflows own decisions |
| AI is a capability tool | NLU / classify / extract / rewrite / JSON signals only |
| Dedicated AI Adapter | Every AI request goes through `ai.adapter` |
| Graceful degradation | Assistant works when AI is off or unavailable |
| Knowledge remains truth | AI must never invent ENARTE business rules |

## Architecture

```
Customer → Chat UX / HTTP
        → Decision Engine (owner)
        → Intent Router (pattern baseline; future AI signals optional)
        → Workflows
        → Knowledge + Catalog

Optional AI signals (future):
  Capability (ai.* / llm.complete)
    → AI Adapter (ai.adapter)     ← ONLY entry
      → Gateway (timeout / retry / fallback / validate / telemetry)
        → Provider registry (openai | stub | future…)
          → Provider shell (OpenAI NOT wired in Sprint 6)
```

## What was built

| Requirement | Location |
|-------------|----------|
| AI Adapter | `ai/adapter.js` (`ai.adapter`) |
| Provider abstraction | `ai/providers/*` |
| Future multi-provider | stub, openai (disabled), anthropic/azure planned |
| Prompt versioning | `ai/prompts/versioning.js` |
| Prompt registry | `ai/prompts/registry.js` |
| Prompt templates (slots only) | `ai/prompts/templates.js` |
| Response validation | `ai/validation/*` |
| Token usage tracking | `ai/telemetry/usage-tracker.js` |
| Cost tracking | `ai/telemetry/cost-tracker.js` |
| Timeout / retry / fallback | `ai/gateway.js`, `ai/fallback.js` |
| Capability wiring | `capabilities/registry.js` → `llm.complete`, `ai.*` |
| Config knobs | `config/index.js` → `ai.*` |

## Capability kinds (signals only)

- `nlu`
- `intent_classification`
- `entity_extraction`
- `image_understanding` *(architecture only — not implemented)*
- `room_analysis` *(architecture only — not implemented)*
- `response_rewriting`
- `structured_json`

## Explicitly NOT done (by design)

- ❌ Call OpenAI / any model SDK
- ❌ Author prompt text
- ❌ Implement image understanding / room analysis
- ❌ Let AI invent products, prices, delivery, or policies
- ❌ Replace Decision Engine with LLM chat

## Degradation behavior

When `ASSISTANT_FEATURE_LLM=false` (default) or providers are unavailable:

1. AI Adapter / gateway returns `status: degraded`
2. `fallback.usePatternRouter = true`
3. Intent Router patterns + Knowledge Layer continue serving the customer

## Config (architecture knobs)

| Env | Default | Notes |
|-----|---------|-------|
| `ASSISTANT_FEATURE_LLM` | `false` | Must stay false until invoke is wired |
| `ASSISTANT_LLM_ADAPTER` | `ai.adapter` | Dedicated adapter id |
| `ASSISTANT_AI_PROVIDER` | `openai` | Preferred provider id (shell only) |
| `ASSISTANT_AI_FALLBACK_PROVIDERS` | `stub` | Provider chain |
| `ASSISTANT_AI_TIMEOUT_MS` | `8000` | Gateway timeout |
| `ASSISTANT_AI_MAX_RETRIES` | `1` | Retry budget |
| `ASSISTANT_AI_FALLBACK_STRATEGY` | `retry_then_degrade` | Fallback policy |

## Tests

```bash
npm run test:ai
npm run test:assistant
```

## Next sprint (not this one)

1. Author versioned prompt packs (still no business invention)
2. Wire OpenAI SDK **inside** `providers/openai.js` only
3. Optionally enrich Intent Router with AI intent candidates (Decision Engine still decides)
4. Later: image / room capabilities behind the same adapter
