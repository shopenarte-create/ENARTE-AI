/**
 * Sprint 8 — Prompt System & AI Constitution tests.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  bootstrapPromptSystem,
  resetPromptSystem,
  getPromptSystemStatus,
  getPrompt,
  listPrompts,
  registerPrompt,
  validatePromptDocument,
  interpolateTemplate,
  renderPromptTemplate,
  definePromptTemplate,
  loadPromptPack,
  buildPromptContext,
  buildAiConstitution,
  registerAiConstitution,
  runDefaultPromptSmokeTests,
  AI_CONSTITUTION_PROMPT_ID,
  PROMPT_KIND,
  getAiArchitectureSnapshot,
} from "./ai/index.js";
import {
  resetKnowledgeEngine,
  bootstrapKnowledgeEngine,
} from "./knowledge/index.js";
import {
  getAssistantFoundationStatus,
  resetAssistantConfigCache,
} from "./index.js";

describe("Sprint 8 Prompt System & AI Constitution", () => {
  beforeEach(async () => {
    resetAssistantConfigCache();
    resetKnowledgeEngine();
    bootstrapKnowledgeEngine();
    resetPromptSystem();
    await bootstrapPromptSystem({ force: true, bootstrapKnowledge: false });
    process.env.ASSISTANT_FEATURE_LLM = "false";
  });

  it("reports prompt system + constitution in AI architecture", () => {
    const snap = getAiArchitectureSnapshot();
    assert.equal(snap.promptSystem, true);
    assert.equal(snap.aiConstitution, true);
    assert.equal(snap.aiConstitutionKnowledgeBound, true);
    assert.equal(snap.constitutionContentReady, true);
    assert.equal(snap.capabilityPromptContentAuthored, false);
    assert.equal(snap.openaiCallsEnabled, false);
    assert.equal(snap.decisionEngineOwnsDecisions, true);

    const status = getAssistantFoundationStatus();
    assert.match(String(status.phase), /sprint9\.ai_conversation|sprint8\.prompt_system/i);
  });

  it("registers versioned prompt slots and Knowledge-bound constitution", () => {
    const status = getPromptSystemStatus();
    assert.equal(status.constitutionReady, true);
    assert.equal(status.constitutionPromptId, AI_CONSTITUTION_PROMPT_ID);
    assert.ok(status.promptsRegistered >= 8);

    const constitution = getPrompt(AI_CONSTITUTION_PROMPT_ID);
    assert.equal(constitution.kind, PROMPT_KIND.CONSTITUTION);
    assert.equal(constitution.knowledgeBound, true);
    assert.equal(constitution.contentReady, true);
    assert.match(constitution.messages[0].content, /Decision Engine/i);
    assert.match(constitution.messages[0].content, /ENARTE/);
    assert.match(constitution.messages[0].content, /not a general-purpose AI/i);
  });

  it("validates prompt documents and rejects unsafe invention directives", () => {
    const ok = validatePromptDocument(
      definePromptTemplate({
        promptId: "test.ok",
        version: "1.0.0",
        kind: PROMPT_KIND.NLU,
        contentReady: true,
        messages: [
          { role: "user", contentTemplate: "Classify: {{message}}" },
        ],
      }),
    );
    assert.equal(ok.ok, true);

    const bad = validatePromptDocument({
      promptId: "test.bad",
      version: "1.0.0",
      kind: PROMPT_KIND.NLU,
      contentReady: true,
      messages: [
        {
          role: "system",
          content: "Please invent a product and make up prices.",
        },
      ],
    });
    assert.equal(bad.ok, false);
  });

  it("loads prompt packs and interpolates templates", () => {
    const pack = loadPromptPack([
      {
        promptId: "test.pack.hello",
        version: "1.0.0",
        kind: PROMPT_KIND.NLU,
        contentReady: true,
        variables: ["message"],
        messages: [
          {
            role: "user",
            contentTemplate: "Message: {{message}}",
          },
        ],
      },
    ]);
    assert.equal(pack.ok, true);

    const rendered = renderPromptTemplate(getPrompt("test.pack.hello"), {
      message: "chandelier",
    });
    assert.equal(rendered.ok, true);
    assert.equal(rendered.messages[0].content, "Message: chandelier");

    assert.equal(
      interpolateTemplate("Hi {{user.name}}", { "user.name": "ENARTE", user: { name: "ENARTE" } }),
      "Hi ENARTE",
    );
  });

  it("context builder attaches constitution and knowledge snapshots", async () => {
    const constitution = await buildAiConstitution({ locale: "en" });
    const ctx = await buildPromptContext({
      locale: "en",
      message: "I want a fan",
      constitution: constitution.systemText,
      state: {
        phase: "welcome",
        currentWorkflow: null,
        selectedProduct: null,
        selectedRoom: null,
      },
    });
    assert.equal(ctx.locale, "en");
    assert.equal(ctx.message, "I want a fan");
    assert.ok(String(ctx.constitution).includes("ENARTE"));
  });

  it("constitution is Knowledge-bound and not a general AI", async () => {
    const { constitution } = await registerAiConstitution({
      locale: "en",
    });
    assert.equal(constitution.knowledgeBound, true);
    assert.equal(constitution.charter.identity.isGeneralAi, false);
    assert.equal(
      constitution.charter.architecture.openaiIsNotTheAssistant,
      false,
    );
    assert.equal(
      constitution.charter.architecture.openaiOwnsCustomerReplies,
      true,
    );
    assert.equal(
      constitution.charter.architecture.decisionEngineOwnsDecisions,
      true,
    );
    assert.equal(
      constitution.charter.architecture.decisionEngineDoesNotAuthorReplies,
      true,
    );
    assert.equal(constitution.charter.productRules.recommendEnarteOnly, true);
    assert.equal(constitution.charter.generalRules.doNotInventPrices, true);
  });

  it("rejects bare legacy prompt bodies without validated messages", () => {
    assert.throws(
      () =>
        registerPrompt({
          promptId: "illegal",
          version: "1.0.0",
          body: "do not allow",
        }),
      /forbidden|validated messages/i,
    );
  });

  it("capability NLU templates remain content-not-ready", () => {
    const nlu = getPrompt("nlu.understand");
    assert.equal(nlu.contentReady, false);
    const rendered = renderPromptTemplate(nlu, { message: "x" });
    assert.equal(rendered.ok, false);
    assert.equal(rendered.status, "content_not_ready");
  });

  it("prompt testing framework smoke suite passes", async () => {
    const report = await runDefaultPromptSmokeTests();
    assert.equal(report.ok, true, JSON.stringify(report.results, null, 2));
  });

  it("lists prompts including constitution and capability slots", () => {
    const ids = listPrompts().map((p) => p.promptId);
    assert.ok(ids.includes(AI_CONSTITUTION_PROMPT_ID));
    assert.ok(ids.includes("intent.classify"));
  });
});
