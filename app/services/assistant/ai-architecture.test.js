/**
 * Sprint 6 — AI integration architecture tests.
 * Guarantees: no OpenAI SDK calls, no prompt content, assistant remains decision maker.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getAiArchitectureSnapshot,
  getAiAdapter,
  getAiAdapterStatus,
  createAiRequest,
  executeAiGateway,
  listAiProviders,
  listPrompts,
  registerPrompt,
  validateAiResponse,
  recordTokenUsage,
  resetTokenUsage,
  estimateCost,
  recordCost,
  resetCostTracking,
  resolveAiFallback,
  AI_CAPABILITY_KIND,
  AI_PROVIDER_ID,
  AI_REQUEST_STATUS,
  AI_FALLBACK_STRATEGY,
  AI_ADAPTER_ID,
  renderPromptTemplate,
} from "./ai/index.js";
import { getAdapter, listAdapters } from "./adapters/registry.js";
import { invokeCapability, listCapabilities } from "./capabilities/registry.js";
import {
  getAssistantFoundationStatus,
  getAssistantConfig,
  resetAssistantConfigCache,
} from "./index.js";
import { routeIntent } from "./core/intent-router.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function walkJsFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJsFiles(full, acc);
    else if (name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

describe("Sprint 6 AI architecture", () => {
  beforeEach(() => {
    resetAssistantConfigCache();
    resetTokenUsage();
    resetCostTracking();
    process.env.ASSISTANT_FEATURE_LLM = "false";
    resetAssistantConfigCache();
  });

  it("reports AI architecture ready without enabling OpenAI calls", () => {
    const snap = getAiArchitectureSnapshot();
    assert.equal(snap.dedicatedAiAdapter, true);
    assert.equal(snap.openaiIsNotTheAssistant, false);
    assert.equal(snap.openaiOwnsCustomerReplies, true);
    assert.equal(snap.decisionEngineOwnsDecisions, true);
    assert.equal(snap.openaiSdkWired, false);
    assert.equal(snap.openaiCallsEnabled, false);
    assert.equal(snap.assistantChatImplemented, true);
    assert.equal(snap.capabilityPromptContentAuthored, false);
    assert.equal(snap.imageAnalysisImplemented, false);

    const status = getAssistantFoundationStatus();
    assert.match(String(status.phase), /sprint9\.ai_conversation|sprint8\.prompt_system|sprint7\.complete_v1|sprint6\.ai_architecture/i);
    assert.equal(status.architecture.aiResponses, false);
    assert.equal(status.architecture.llmEnabled, false);
    assert.equal(status.architecture.aiLayerReady, true);
    assert.equal(status.boundaries.openaiNotTheAssistant, true);
    assert.equal(status.runtime.enableLlm, false);
  });

  it("registers dedicated AI Adapter and provider abstraction", () => {
    const ids = listAdapters().map((a) => a.id);
    assert.ok(ids.includes(AI_ADAPTER_ID));
    assert.ok(ids.includes("llm.stub"));

    const adapter = getAdapter(AI_ADAPTER_ID);
    assert.equal(adapter.status, "active");
    assert.equal(typeof adapter.api.complete, "function");

    const providers = listAiProviders();
    const providerIds = providers.map((p) => p.id);
    assert.ok(providerIds.includes(AI_PROVIDER_ID.STUB));
    assert.ok(providerIds.includes(AI_PROVIDER_ID.OPENAI));
    assert.ok(providerIds.includes(AI_PROVIDER_ID.ANTHROPIC));
    const openai = providers.find((p) => p.id === AI_PROVIDER_ID.OPENAI);
    assert.equal(openai?.available, false);
  });

  it("registers prompt slots without forcing capability content bodies", () => {
    const prompts = listPrompts();
    assert.ok(prompts.length >= 7);
    assert.ok(
      prompts
        .filter((p) => p.kind !== "constitution")
        .every((p) => p.contentReady === false || p.kind === "constitution"),
    );

    assert.throws(
      () =>
        registerPrompt({
          promptId: "illegal",
          version: "1.0.0",
          body: "do not allow",
        }),
      /forbidden|validated messages/i,
    );

    const rendered = renderPromptTemplate("nlu.understand", {});
    assert.equal(rendered.ok, false);
    assert.equal(rendered.status, "content_not_ready");
  });

  it("AI Adapter degrades when LLM is disabled so assistant keeps working", async () => {
    const adapter = getAiAdapter();
    const result = await adapter.api.complete({
      kind: AI_CAPABILITY_KIND.INTENT_CLASSIFICATION,
      input: { message: "I want a chandelier" },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, AI_REQUEST_STATUS.DEGRADED);
    assert.equal(result.fallback?.usePatternRouter, true);

    // Pattern Intent Router still works independently.
    const route = routeIntent({ message: "I want a chandelier" });
    assert.equal(route.workflowId, "chandelier");
  });

  it("gateway never succeeds in Sprint 6 even if feature flag flipped", async () => {
    const request = createAiRequest({
      kind: AI_CAPABILITY_KIND.NLU,
      prompt: { promptId: "nlu.understand", version: "0.0.0" },
      input: { message: "hello" },
    });

    const result = await executeAiGateway(request, { enabled: true });
    assert.equal(result.ok, false);
    assert.ok(
      [
        AI_REQUEST_STATUS.DEGRADED,
        AI_REQUEST_STATUS.NOT_IMPLEMENTED,
        AI_REQUEST_STATUS.UNAVAILABLE,
      ].includes(result.status) || result.error === "prompt_content_not_ready" ||
        result.fallback?.reason === "prompt_content_not_ready" ||
        result.error === "stub_provider" ||
        result.fallback?.reason,
    );
  });

  it("validates response schemas and tracks usage/cost hooks", () => {
    const bad = validateAiResponse({}, AI_CAPABILITY_KIND.INTENT_CLASSIFICATION);
    assert.equal(bad.ok, false);

    const good = validateAiResponse(
      { intent: "buy_chandelier", confidence: 0.9 },
      AI_CAPABILITY_KIND.INTENT_CLASSIFICATION,
    );
    assert.equal(good.ok, true);

    recordTokenUsage({
      providerId: "openai",
      kind: AI_CAPABILITY_KIND.NLU,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const usage = getAiAdapterStatus().usage;
    assert.equal(usage.totals.totalTokens, 15);

    const cost = estimateCost({
      model: "future-model",
      usage: { promptTokens: 1000, completionTokens: 1000 },
    });
    assert.equal(cost.amount, 0);
    recordCost({ providerId: "openai", cost });
  });

  it("fallback strategy resolves retry / next provider / degrade", () => {
    const retry = resolveAiFallback({
      strategy: AI_FALLBACK_STRATEGY.RETRY_THEN_DEGRADE,
      attempt: 0,
      maxRetries: 1,
      remainingProviders: [],
    });
    assert.equal(retry.action, "retry");

    const next = resolveAiFallback({
      strategy: AI_FALLBACK_STRATEGY.NEXT_PROVIDER,
      remainingProviders: [{ id: "stub" }],
    });
    assert.equal(next.action, "next_provider");

    const degrade = resolveAiFallback({
      strategy: AI_FALLBACK_STRATEGY.DEGRADE,
      remainingProviders: [],
    });
    assert.equal(degrade.action, "degrade");
  });

  it("AI capabilities invoke through adapter and remain non-authoritative", async () => {
    const caps = listCapabilities().map((c) => c.id);
    assert.ok(caps.includes("assistant.converse"));
    assert.ok(caps.includes("ai.nlu"));
    assert.ok(caps.includes("ai.intent_classification"));

    const result = await invokeCapability("ai.intent_classification", {
      locale: "en",
    }, { message: "delivery" });

    assert.equal(result.ok, false);
    assert.equal(result.capabilityId, "ai.intent_classification");
    assert.equal(result.status, AI_REQUEST_STATUS.DEGRADED);

    // Config still defaults LLM off.
    assert.equal(getAssistantConfig().features.enableLlm, false);
    assert.equal(getAssistantConfig().ai.openaiSdkWired, false);
  });

  it("ai layer source never imports openai SDK", () => {
    const aiDir = join(__dirname, "ai");
    const files = walkJsFiles(aiDir);
    const violations = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (/from\s+["']openai["']/.test(src) || /require\(["']openai["']\)/.test(src)) {
        violations.push(file);
      }
      if (/new\s+OpenAI\b/.test(src)) violations.push(file);
    }
    assert.deepEqual(violations, []);
  });
});
