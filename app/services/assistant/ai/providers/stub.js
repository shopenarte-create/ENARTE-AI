/**
 * Stub AI provider — always unavailable.
 * Guarantees assistant continues without AI.
 */

import { AI_PROVIDER_ID, AI_PROVIDER_STATUS, AI_CAPABILITY_KIND } from "../constants.js";
import { createDegradedAiResult } from "../contracts.js";
import { defineAiProvider } from "./types.js";

export function createStubAiProvider() {
  return defineAiProvider({
    id: AI_PROVIDER_ID.STUB,
    status: AI_PROVIDER_STATUS.STUB,
    description:
      "Stub AI provider. Never calls a model. Used when LLM is disabled or providers fail.",
    supports: Object.freeze(Object.values(AI_CAPABILITY_KIND)),
    isAvailable: () => false,
    async invoke(request) {
      return createDegradedAiResult({
        kind: request?.kind,
        reason: "stub_provider",
        note: "Stub provider — no model call. Pattern router / Knowledge remain authoritative.",
        providerId: AI_PROVIDER_ID.STUB,
      });
    },
  });
}
