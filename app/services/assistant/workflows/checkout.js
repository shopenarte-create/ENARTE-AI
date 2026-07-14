/**
 * Checkout handoff — V1 (pre-cart session).
 * Knowledge contact + selected product URL. No payment processing.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { appendMemory, readMemory } from "../core/memory.js";
import { getPersonalityMessage } from "../knowledge/readers/assistant-personality.js";
import { getServicesContact } from "../knowledge/readers/services.js";
import { knowledgeOptsFromCtx } from "../utils/knowledge-ctx.js";

function resolveSelectedProduct(ctx, input = {}) {
  if (input.selectedProduct?.id) return input.selectedProduct;
  if (ctx?.metadata?.selectedProduct?.id) return ctx.metadata.selectedProduct;
  const memory = ctx.conversationId
    ? readMemory(ctx.conversationId, { limit: 40 })
    : [];
  for (let i = memory.length - 1; i >= 0; i -= 1) {
    const product = memory[i]?.metadata?.selectedProduct;
    if (product?.id) return product;
  }
  return null;
}

export default Object.freeze({
  id: "checkout",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint7",
  intents: Object.freeze(["checkout", "buy", "purchase"]),
  capabilities: Object.freeze([
    "knowledge.read",
    "memory.read",
    "memory.write",
    "ai.nlu",
  ]),
  description:
    "Checkout handoff: ENARTE product link + Knowledge contact (no cart API yet).",

  async run(ctx, input = {}) {
    const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
    const opts = knowledgeOptsFromCtx(ctx, locale);
    const selected = resolveSelectedProduct(ctx, input);
    const contact = await getServicesContact(opts);

    const handoff =
      (await getPersonalityMessage("checkoutHandoff", locale, opts)) || null;

    const parts = [];
    if (handoff) parts.push(handoff);
    if (selected?.title) {
      parts.push(
        String(locale).toLowerCase().startsWith("en")
          ? `Selected: ${selected.title}`
          : `المحدد: ${selected.title}`,
      );
    }
    if (selected?.url) {
      parts.push(selected.url);
    }
    if (contact?.phone) {
      parts.push(
        String(locale).toLowerCase().startsWith("en")
          ? `ENARTE contact: ${contact.phone}`
          : `تواصل ENARTE: ${contact.phone}`,
      );
    }

    const message = parts.filter(Boolean).join("\n") || null;

    if (!message) {
      return createWorkflowResult({
        ok: true,
        workflowId: "checkout",
        status: WORKFLOW_STATUS.ACTIVE,
        action: "placeholder",
        message: null,
        note: "Checkout knowledge/contact missing.",
      });
    }

    if (ctx.conversationId) {
      appendMemory(ctx.conversationId, {
        role: "assistant",
        workflowId: "checkout",
        content: message,
        metadata: { selectedProduct: selected, contact },
      });
    }

    return createWorkflowResult({
      ok: true,
      workflowId: "checkout",
      status: WORKFLOW_STATUS.ACTIVE,
      action: "reply",
      message,
      data: Object.freeze({
        selectedProduct: selected,
        contactPhone: contact?.phone || null,
        contact: contact
          ? Object.freeze({
              phone: contact.phone || null,
              whatsapp: contact.whatsapp || null,
            })
          : null,
      }),
      note: "Checkout handoff from Knowledge contact + selected product.",
    });
  },
});
