/**
 * GET /api/assistant/status
 *
 * Architecture introspection for the ENARTE AI Assistant.
 * Phase 2: workflow engine status. No AI responses. No business logic execution.
 */

import { getAssistantFoundationStatus } from "../services/assistant/index.js";

export async function loader() {
  const status = getAssistantFoundationStatus();

  return Response.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
