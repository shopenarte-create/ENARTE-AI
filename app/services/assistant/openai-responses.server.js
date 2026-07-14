/**

 * OpenAI Responses API client for the ENARTE assistant.

 * Lives outside ai/ so the AI layer stays provider-agnostic at the interface level.

 */



let client = null;



function hasApiKey() {

  return Boolean(String(process.env.OPENAI_API_KEY || "").trim());

}



export function isOpenAiConfigured() {

  return hasApiKey();

}



async function getClient() {

  if (!hasApiKey()) {

    throw new Error("OPENAI_API_KEY is required for assistant AI");

  }

  if (!client) {

    const { default: OpenAI } = await import("openai");

    const timeoutMs = Number(process.env.ASSISTANT_AI_TIMEOUT_MS || 60_000);

    client = new OpenAI({

      apiKey: process.env.OPENAI_API_KEY,

      timeout: timeoutMs,

    });

  }

  return client;

}



function extractText(response) {

  if (response?.output_text) return String(response.output_text).trim();

  const parts = [];

  for (const item of response?.output || []) {

    if (item.type === "message") {

      for (const block of item.content || []) {

        if (block.type === "output_text" && block.text) {

          parts.push(block.text);

        }

      }

    }

  }

  return parts.join("\n").trim();

}



function extractFunctionCalls(response) {

  return (response?.output || []).filter((item) => item.type === "function_call");

}



function usageFromResponse(response, model) {

  const usage = response?.usage || {};

  const promptTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;

  const completionTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;

  return {

    promptTokens,

    completionTokens,

    totalTokens: usage.total_tokens ?? promptTokens + completionTokens,

    model,

  };

}



function mergeUsage(a, b) {

  return {

    promptTokens: (a?.promptTokens || 0) + (b?.promptTokens || 0),

    completionTokens: (a?.completionTokens || 0) + (b?.completionTokens || 0),

    totalTokens: (a?.totalTokens || 0) + (b?.totalTokens || 0),

    model: b?.model || a?.model || null,

  };

}



/**

 * Run a tool-using assistant conversation via the Responses API.

 *

 * @param {object} options

 * @param {string} options.instructions

 * @param {object[]} options.input

 * @param {object[]} options.tools

 * @param {(name: string, args: object, callId: string) => Promise<object>} options.runTool

 * @param {string} [options.model]

 * @param {number} [options.maxToolRounds]

 * @param {boolean} [options.requireCatalogSearch]

 * @param {string} [options.catalogSearchMessage]

 */

export async function runAssistantResponsesConversation(options = {}) {

  const openai = await getClient();

  const model = options.model || process.env.ASSISTANT_MODEL || "gpt-4.1";

  const maxToolRounds = options.maxToolRounds ?? 2;

  const tools = options.tools || [];

  const runTool = options.runTool;

  if (typeof runTool !== "function") {

    throw new Error("runTool callback is required");

  }



  let input = [...(options.input || [])];

  const collected = {

    cards: null,

    actions: null,

    toolCalls: [],

  };



  let lastResponse = null;

  let usage = {

    promptTokens: 0,

    completionTokens: 0,

    totalTokens: 0,

    model,

  };



  async function runRound(toolChoice = "auto") {

    lastResponse = await openai.responses.create({

      model,

      instructions: options.instructions,

      input,

      tools,

      tool_choice: toolChoice,

      temperature: options.temperature ?? 0.3,

    });

    usage = mergeUsage(usage, usageFromResponse(lastResponse, model));



    const calls = extractFunctionCalls(lastResponse);

    if (!calls.length) return false;



    input = input.concat(lastResponse.output);



    for (const call of calls) {

      let args = {};

      try {

        args = call.arguments ? JSON.parse(call.arguments) : {};

      } catch {

        args = {};

      }



      const result = await runTool(call.name, args, call.call_id);

      collected.toolCalls.push(

        Object.freeze({

          name: call.name,

          callId: call.call_id,

          args,

          ok: result?.ok !== false,

        }),

      );



      if (result?.cards?.length) {

        collected.cards = Object.freeze([...result.cards]);

      }

      if (result?.actions?.length) {

        collected.actions = Object.freeze([...result.actions]);

      }



      input.push({

        type: "function_call_output",

        call_id: call.call_id,

        output: JSON.stringify(result ?? { ok: false }),

      });

    }

    return true;

  }



  for (let round = 0; round < maxToolRounds; round += 1) {

    const hadTools = await runRound("auto");

    if (!hadTools) break;

    // Stop early once we have ranked catalog cards.
    if (collected.cards?.length) break;

  }



  // Product questions must surface real catalog cards whenever possible.
  // Skip forced re-search when search_catalog already ran (avoids multi-round
  // latency when the catalog is temporarily offline).

  const alreadySearchedCatalog = collected.toolCalls.some(
    (call) => call.name === "search_catalog" || call.name === "recommend_products",
  );

  if (

    options.requireCatalogSearch &&

    !collected.cards?.length &&

    !alreadySearchedCatalog &&

    tools.some((t) => t.name === "search_catalog")

  ) {

    input.push({

      role: "user",

      content:

        "Search the ENARTE catalog now for matching products and then give a short sales reply. Do not answer without calling search_catalog.",

    });

    const forced = await runRound({

      type: "function",

      name: "search_catalog",

    });

    if (forced && !collected.cards?.length) {

      // One short follow-up only — never stack 3 extra LLM rounds on empty catalog.

      await runRound("auto");

    }

  }



  let message = extractText(lastResponse);

  // Model must author the spoken line — never invent a sales pitch here.
  if (!message && collected.cards?.length) {
    await runRound("auto");
    message = extractText(lastResponse);
  }

  if (!message) {

    throw new Error("openai_empty_response");

  }



  return Object.freeze({

    message,

    cards: collected.cards,

    actions: collected.actions,

    toolCalls: Object.freeze(collected.toolCalls),

    usage,

    model,

    responseId: lastResponse?.id || null,

  });

}



/**
 * Vision call for room/product photos. Lives here so ai/ never imports the OpenAI SDK.
 * @param {string} dataUrl
 * @param {string} prompt
 * @returns {Promise<string|null>} raw model text
 */
export async function runAssistantVisionPrompt(dataUrl, prompt) {
  if (!hasApiKey()) return null;
  const url = String(dataUrl || "").trim();
  if (!url.startsWith("data:")) return null;
  try {
    const client = await getClient();
    const model =
      process.env.ASSISTANT_VISION_MODEL ||
      process.env.ASSISTANT_MODEL ||
      "gpt-4.1";
    const response = await client.responses.create({
      model,
      temperature: 0.2,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: String(prompt || "") },
            { type: "input_image", image_url: url },
          ],
        },
      ],
    });
    return extractText(response) || null;
  } catch {
    return null;
  }
}


