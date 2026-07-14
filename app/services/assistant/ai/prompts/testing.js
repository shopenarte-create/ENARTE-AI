/**
 * Prompt testing framework — unit-test helpers for prompts & constitution.
 * Does not call OpenAI. Does not execute live models.
 */

import { validatePromptDocument } from "./validation.js";
import { interpolateTemplate, renderPromptTemplate } from "./templates.js";
import { getPrompt, listPrompts } from "./registry.js";
import { buildPromptContext } from "./context-builder.js";
import {
  AI_CONSTITUTION_PROMPT_ID,
  PROMPT_KIND,
} from "./constants.js";

/**
 * Run a suite of prompt assertions.
 * @param {object} suite
 * @param {string} suite.name
 * @param {Array<object>} suite.cases
 */
export async function runPromptTestSuite(suite = {}) {
  const cases = Array.isArray(suite.cases) ? suite.cases : [];
  const results = [];

  for (const testCase of cases) {
    results.push(await runPromptTestCase(testCase));
  }

  const passed = results.filter((r) => r.ok).length;
  return Object.freeze({
    ok: passed === results.length,
    name: suite.name || "prompt-suite",
    total: results.length,
    passed,
    failed: results.length - passed,
    results: Object.freeze(results),
  });
}

/**
 * @param {object} testCase
 * @param {string} testCase.name
 * @param {"validate"|"render"|"interpolate"|"constitution"|"context"} testCase.type
 */
export async function runPromptTestCase(testCase = {}) {
  const name = testCase.name || "unnamed";
  try {
    switch (testCase.type) {
      case "validate": {
        const validation = validatePromptDocument(testCase.document);
        const expectOk = testCase.expectOk !== false;
        return finish(name, validation.ok === expectOk, {
          validation,
        });
      }
      case "interpolate": {
        const out = interpolateTemplate(
          testCase.template,
          testCase.variables || {},
        );
        const ok =
          testCase.expectIncludes == null
            ? true
            : String(out).includes(testCase.expectIncludes);
        return finish(name, ok, { out });
      }
      case "render": {
        const prompt =
          testCase.prompt ||
          getPrompt(testCase.promptId, testCase.version || null);
        const rendered = renderPromptTemplate(prompt, testCase.variables || {});
        const expectOk = testCase.expectOk !== false;
        return finish(name, rendered.ok === expectOk, { rendered });
      }
      case "constitution": {
        const prompt = getPrompt(AI_CONSTITUTION_PROMPT_ID);
        const checks = [
          Boolean(prompt),
          prompt?.kind === PROMPT_KIND.CONSTITUTION,
          prompt?.knowledgeBound === true,
          prompt?.contentReady === true,
          (prompt?.messages?.[0]?.content || "").includes("ENARTE"),
          (prompt?.messages?.[0]?.content || "").includes("Decision Engine"),
        ];
        return finish(name, checks.every(Boolean), {
          promptId: prompt?.promptId,
          version: prompt?.version,
        });
      }
      case "context": {
        const ctx = await buildPromptContext(testCase.input || {});
        const ok =
          typeof ctx.locale === "string" &&
          Object.prototype.hasOwnProperty.call(ctx, "constitution");
        return finish(name, ok, { ctxKeys: Object.keys(ctx) });
      }
      default:
        return finish(name, false, {
          error: `Unknown test type: ${testCase.type}`,
        });
    }
  } catch (error) {
    return finish(name, false, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function finish(name, ok, details = {}) {
  return Object.freeze({
    ok: Boolean(ok),
    name,
    ...details,
  });
}

/**
 * Built-in smoke suite for Sprint 8.
 */
export async function runDefaultPromptSmokeTests() {
  return runPromptTestSuite({
    name: "sprint8.prompt_system.smoke",
    cases: [
      {
        name: "capability slots registered",
        type: "validate",
        expectOk: true,
        document: listPrompts()[0],
      },
      {
        name: "interpolate variables",
        type: "interpolate",
        template: "Hello {{name}} from {{brand}}",
        variables: { name: "ENARTE", brand: "ENARTE" },
        expectIncludes: "ENARTE",
      },
      {
        name: "nlu slot not ready",
        type: "render",
        promptId: "nlu.understand",
        expectOk: false,
      },
      {
        name: "constitution registered from knowledge",
        type: "constitution",
      },
      {
        name: "context builder shape",
        type: "context",
        input: { locale: "en", message: "hello" },
      },
    ],
  });
}
