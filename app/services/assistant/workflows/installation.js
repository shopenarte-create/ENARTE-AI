/**
 * Installation Workflow — V1.
 * Knowledge Layer (services): team phone + general catalog/base tips.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory } from "../core/memory.js";
import {
  getServiceOffering,
  getServicesContact,
} from "../knowledge/readers/services.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";
import { pickLocale } from "../utils/locale.js";

function mentionsMaintenance(text = "") {
  const t = String(text).toLowerCase();
  return (
    t.includes("maintenance") ||
    t.includes("صيانة") ||
    t.includes("تركيب وصيانة") ||
    t.includes("installation & maintenance")
  );
}

export default Object.freeze({
  id: "installation",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint5",
  intents: Object.freeze(["installation", "install_help"]),
  capabilities: Object.freeze([
    "knowledge.read",
    "memory.write",
    "ai.nlu",
  ]),
  description: "Installation (and combined install/maintenance) from Knowledge.",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const knowledgeOpts = knowledgeOptsFromCtx(ctx, locale);

    const includeMaintenance =
      mentionsMaintenance(input.message) ||
      input.artifacts?.includeMaintenance === true;

    const installation = await getServiceOffering("installation", knowledgeOpts);
    const maintenance = includeMaintenance
      ? await getServiceOffering("maintenance", knowledgeOpts)
      : null;
    const contact = await getServicesContact(knowledgeOpts);

    // Canonical ENARTE installation reply only (فني / كهربجي / تركيب).
    // Do not append DIY-rule prose — same phone number answer covers those asks.
    const parts = [pickLocale(installation?.description, locale)].filter(Boolean);
    if (includeMaintenance) {
      const maintenanceText = pickLocale(maintenance?.description, locale);
      if (maintenanceText && !parts.includes(maintenanceText)) {
        parts.push(maintenanceText);
      }
    }

    const message = parts.join(" ").trim();

    if (!message) {
      return createWorkflowResult({
        ok: true,
        workflowId: "installation",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "placeholder",
        message: null,
        note: "Services knowledge missing — placeholder chrome.",
      });
    }

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        content: message,
        workflowId: "installation",
      });
    }

    return createWorkflowResult({
      ok: true,
      workflowId: "installation",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "reply",
      message,
      data: Object.freeze({
        contactPhone: contact?.phone || null,
        includeMaintenance,
      }),
      note: "Installation/services reply from Knowledge Layer.",
    });
  },
});
