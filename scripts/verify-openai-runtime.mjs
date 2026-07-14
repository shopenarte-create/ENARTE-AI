/**
 * Runtime verification: free-text chat → OpenAI Responses API.
 * Does not print API keys.
 */
import { resetAssistantConfigCache } from "../app/services/assistant/config/index.js";
import {
  startChatSession,
  sendChatMessage,
  resetChatSessions,
} from "../app/services/assistant/ux/chat-api.js";
import { resetConversationState } from "../app/services/assistant/brain/index.js";
import { isAiConversationReady } from "../app/services/assistant/ai/conversation.js";
import { getAssistantConfig } from "../app/services/assistant/config/index.js";
import { resetAiProviders } from "../app/services/assistant/ai/providers/registry.js";

resetAssistantConfigCache();
resetAiProviders();
resetChatSessions();
resetConversationState();

const key = process.env.OPENAI_API_KEY || "";
const cfg = getAssistantConfig({ refresh: true });

const preflight = {
  hasOpenAiKey: Boolean(key),
  keyLength: key.length,
  enableLlm: cfg.features.enableLlm,
  openaiSdkWired: cfg.ai.openaiSdkWired,
  model: cfg.ai.model,
  isAiConversationReady: isAiConversationReady(),
};

if (!preflight.isAiConversationReady) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        stage: "preflight",
        preflight,
        reason:
          "LLM path not armed — free-text will NOT call OpenAI until enableLlm is true and OPENAI_API_KEY is set.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const started = await startChatSession({
  shop: "demo.myshopify.com",
  locale: "en",
});

const sent = await sendChatMessage({
  sessionId: started.session.id,
  message: "What ENARTE lighting would suit a modern dining room?",
  locale: "en",
});

const leaf = sent.turn?.workflowResult;
const data = leaf?.data || {};
const aiReply = sent.decision?.workflowId === "ai_assisted_chat" && Boolean(sent.messages?.[0]?.content);

console.log(
  JSON.stringify(
    {
      ok: sent.ok,
      preflight,
      decisionWorkflow: sent.decision?.workflowId,
      turnAction: sent.turn?.action,
      aiPowered: Boolean(data.ai),
      providerId: data.providerId || (aiReply ? "openai" : null),
      usage: data.usage || null,
      toolCallCount: Array.isArray(data.toolCalls) ? data.toolCalls.length : 0,
      messagePreview: String(sent.messages?.[0]?.content || "").slice(0, 200),
      openAiCalled: sent.decision?.workflowId === "ai_assisted_chat" && aiReply,
    },
    null,
    2,
  ),
);

process.exit(sent.ok && sent.decision?.workflowId === "ai_assisted_chat" && aiReply ? 0 : 1);
