# Sprint 8 — Prompt System & AI Constitution

**Phase:** `sprint8.prompt_system`  
**Status:** Complete  
**OpenAI calls:** disabled  
**New product features:** none  

## Goal

Build the Prompt System that will power future AI capabilities — without connecting OpenAI, without inventing ENARTE business rules, and without changing V1 customer journeys.

## Incomplete requirement note

The request ended with: *“The AI Constitution must become…”*

Interpreted and implemented as:

> **The AI Constitution must become the immutable, Knowledge-bound governing charter for any future model calls** — identity, specialization, product rules, and anti-invention constraints — while the Decision Engine remains the decision maker and OpenAI never becomes the assistant.

If you meant a different completion of that sentence, say so and we can adjust.

## Requirements checklist

| # | Requirement | Location |
|---|-------------|----------|
| 1 | Prompt Registry | `ai/prompts/registry.js` |
| 2 | Prompt Versioning | `ai/prompts/versioning.js` |
| 3 | Prompt Templates | `ai/prompts/templates.js` |
| 4 | Prompt Validation | `ai/prompts/validation.js` |
| 5 | Prompt Loader | `ai/prompts/loader.js` |
| 6 | Prompt Context Builder | `ai/prompts/context-builder.js` |
| 7 | Prompt Testing Framework | `ai/prompts/testing.js` |
| 8 | AI Constitution support | `ai/prompts/constitution.js` |

## AI Constitution

Built **only** from Knowledge Layer modules:

- `assistant_personality`
- `business_rules`

Registered as prompt `constitution.enarte@1.0.0` with:

- `knowledgeBound: true`
- `kind: constitution`
- system text stating ENARTE-only specialization, no invented products/prices, Decision Engine ownership, OpenAI is not the assistant

## Capability templates

Slots remain registered but **`contentReady: false`** for NLU / intent / entity / image / room / rewrite / JSON — so we do not author free-form capability prompts in this sprint beyond the Knowledge-derived constitution.

## Usage

```js
import {
  bootstrapPromptSystem,
  buildPromptContext,
  getPrompt,
  renderPromptTemplate,
  AI_CONSTITUTION_PROMPT_ID,
} from "./ai/index.js";

await bootstrapPromptSystem({ locale: "en" });
const constitution = getPrompt(AI_CONSTITUTION_PROMPT_ID);
const ctx = await buildPromptContext({ locale: "en", message: "…" });
```

## Tests

```bash
npm run test:prompt-system
npm run test:assistant
```

## Explicit non-goals

- No OpenAI SDK calls  
- No new customer journeys / workflows  
- No image / room / placement implementation  
- No invented ENARTE prices, products, or policies  
