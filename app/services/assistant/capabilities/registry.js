/**
 * Capability registry — typed tools workflows may request.
 * knowledge.read is wired to the Knowledge Engine (interfaces only; data empty).
 */

import { CAPABILITY_STATUS } from "../constants.js";
import {
  createNotImplementedResult,
  defineCapability,
} from "../contracts/index.js";
import { createKnowledgeClient } from "../knowledge/index.js";
import { getShopifyCatalogAdapter } from "../adapters/shopify-catalog.js";
import { appendMemory, readMemory } from "../core/memory.js";
import { getAdapter } from "../adapters/registry.js";

/** @type {Map<string, import("../contracts/index.js").CapabilityDefinition>} */
const capabilities = new Map();

export function registerCapability(definition) {
  const capability = defineCapability(definition);
  capabilities.set(capability.id, capability);
  return capability;
}

export function getCapability(id) {
  return capabilities.get(id) || null;
}

export function listCapabilities() {
  return [...capabilities.values()].map((c) =>
    Object.freeze({
      id: c.id,
      status: c.status,
      description: c.description,
      dependsOn: c.dependsOn,
    }),
  );
}

export async function invokeCapability(id, ctx, input = {}) {
  const capability = capabilities.get(id);
  if (!capability) {
    return createNotImplementedResult(
      "capability",
      id,
      `Capability "${id}" is not registered.`,
    );
  }
  return capability.invoke(ctx, input);
}

function resolveKnowledgeClient(ctx) {
  if (ctx?.knowledge && typeof ctx.knowledge.get === "function") {
    return ctx.knowledge;
  }
  return createKnowledgeClient({
    shop: ctx?.shop,
    locale: ctx?.locale,
  });
}

function registerReservedCapabilities() {
  const reserved = [
    {
      id: "vision.analyze_room",
      description: "Reserved: room image analysis (wired in a later phase).",
    },
    {
      id: "vision.search_image",
      description: "Reserved: image-based product search (later phase).",
    },
    {
      id: "placement.compose",
      description: "Reserved: virtual chandelier placement (later phase).",
    },
    {
      id: "analytics.track",
      description: "Reserved: emit analytics events via event bus.",
    },
    {
      id: "learning.record",
      description: "Reserved: record learning signals from conversations.",
    },
  ];

  for (const item of reserved) {
    if (capabilities.has(item.id)) continue;
    registerCapability({
      id: item.id,
      status: CAPABILITY_STATUS.RESERVED,
      description: item.description,
      async invoke(_ctx, _input) {
        return createNotImplementedResult("capability", item.id);
      },
    });
  }

  /**
   * AI capabilities — always go through the dedicated AI Adapter.
   * Degrade when LLM flag is off or providers are unavailable.
   * Decision Engine / Intent Router remain authoritative.
   */
  registerCapability({
    id: "assistant.converse",
    status: CAPABILITY_STATUS.ACTIVE,
    description:
      "Full ENARTE assistant conversation via OpenAI Responses API and tool calling.",
    dependsOn: ["ai.adapter"],
    async invoke(ctx, input = {}) {
      const { getAiAdapter } = await import("../ai/adapter.js");
      const adapter = getAiAdapter();
      const result = await adapter.api.complete(
        {
          kind: input.kind || "assistant_chat",
          input: {
            message: input.message,
            history: input.history,
            state: input.state,
            artifacts: input.artifacts,
            knowledge: ctx?.knowledge,
            shop: input.shop || ctx?.shop,
            locale: input.locale || ctx?.locale,
          },
          locale: input.locale || ctx?.locale,
          conversationId: input.conversationId || ctx?.conversationId,
          shop: input.shop || ctx?.shop,
        },
        {},
      );
      return Object.freeze({
        ok: Boolean(result.ok),
        capabilityId: "assistant.converse",
        ...result,
      });
    },
  });

  registerCapability({
    id: "llm.complete",
    status: CAPABILITY_STATUS.PLANNED,
    description:
      "AI completion via dedicated AI Adapter (signals only; not the assistant).",
    dependsOn: ["ai.adapter"],
    async invoke(ctx, input = {}) {
      const { getAiAdapter } = await import("../ai/adapter.js");
      const adapter = getAiAdapter();
      const result = await adapter.api.complete(
        {
          kind: input.kind || "nlu",
          ...input,
          locale: input.locale || ctx?.locale,
          conversationId: input.conversationId || ctx?.conversationId,
          shop: input.shop || ctx?.shop,
        },
        {},
      );
      return Object.freeze({
        ok: Boolean(result.ok),
        capabilityId: "llm.complete",
        ...result,
      });
    },
  });

  for (const kind of [
    "nlu",
    "intent_classification",
    "entity_extraction",
    "image_understanding",
    "room_analysis",
    "response_rewriting",
    "structured_json",
  ]) {
    const id = `ai.${kind}`;
    registerCapability({
      id,
      status: CAPABILITY_STATUS.PLANNED,
      description: `AI capability "${kind}" via AI Adapter (architecture only).`,
      dependsOn: ["ai.adapter"],
      async invoke(ctx, input = {}) {
        const { getAiAdapter } = await import("../ai/adapter.js");
        const adapter = getAiAdapter();
        const result = await adapter.api.complete(
          {
            ...input,
            kind,
            locale: input.locale || ctx?.locale,
            conversationId: input.conversationId || ctx?.conversationId,
            shop: input.shop || ctx?.shop,
          },
          {},
        );
        return Object.freeze({
          ok: Boolean(result.ok),
          capabilityId: id,
          ...result,
        });
      },
    });
  }

  /**
   * Active capability: workflows request knowledge only through this interface
   * (or ctx.knowledge). Never embed business facts in workflow code.
   */
  registerCapability({
    id: "knowledge.read",
    status: CAPABILITY_STATUS.ACTIVE,
    description:
      "Read knowledge modules via the Knowledge Engine (provider-backed).",
    async invoke(ctx, input = {}) {
      const client = resolveKnowledgeClient(ctx);

      if (input.bundle === true || Array.isArray(input.modules)) {
        const record = await client.bundle(input.modules);
        return Object.freeze({
          ok: true,
          capabilityId: "knowledge.read",
          kind: "bundle",
          data: record,
        });
      }

      if (!input.moduleId && !input.module) {
        return Object.freeze({
          ok: false,
          capabilityId: "knowledge.read",
          error: "module_id_required",
          note: "Pass moduleId (e.g. delivery, faq) or modules[].",
          modules: client.modules,
        });
      }

      const moduleId = input.moduleId || input.module;
      const record = input.query
        ? await client.query({ moduleId, ...input.query })
        : await client.get(moduleId, {
            key: input.key,
            filters: input.filters,
          });

      return Object.freeze({
        ok: true,
        capabilityId: "knowledge.read",
        kind: "record",
        record,
      });
    },
  });

  registerCapability({
    id: "catalog.search",
    status: CAPABILITY_STATUS.ACTIVE,
    description:
      "Search ENARTE Shopify catalog by name/category/keywords/tags.",
    async invoke(ctx, input = {}) {
      const adapter = getShopifyCatalogAdapter();
      const result = await adapter.search({
        shop: input.shop || ctx?.shop,
        locale: input.locale || ctx?.locale || "ar",
        message: input.message,
        query: input.query,
        artifacts: input.artifacts,
        products: input.products,
      });
      return Object.freeze({
        ok: Boolean(result.ok),
        capabilityId: "catalog.search",
        ...result,
      });
    },
  });

  registerCapability({
    id: "catalog.recommend",
    status: CAPABILITY_STATUS.ACTIVE,
    description:
      "Recommend similar ENARTE catalog products from a selected product / room (no vision).",
    async invoke(ctx, input = {}) {
      const adapter = getShopifyCatalogAdapter();
      const seed = input.selectedProduct || input.seedProduct || null;
      const room =
        input.selectedRoom?.name ||
        input.selectedRoom ||
        input.room ||
        input.artifacts?.room ||
        null;
      const roomName =
        room && typeof room === "object" ? room.name || room.id : room;

      const keywords = [
        ...(Array.isArray(seed?.tags) ? seed.tags : []),
        ...(Array.isArray(input.artifacts?.keywords)
          ? input.artifacts.keywords
          : []),
        seed?.collection,
        seed?.title,
        roomName,
      ].filter(Boolean);

      const message =
        input.message ||
        [seed?.title, seed?.collection, roomName, "ENARTE"]
          .filter(Boolean)
          .join(" ");

      const result = await adapter.search({
        shop: input.shop || ctx?.shop,
        message,
        query: input.query,
        artifacts: Object.freeze({
          ...(input.artifacts || {}),
          category: input.category || seed?.collection || null,
          keywords: Object.freeze(keywords.map(String)),
          tags: Object.freeze([
            ...(Array.isArray(seed?.tags) ? seed.tags : []),
            ...(Array.isArray(input.artifacts?.tags) ? input.artifacts.tags : []),
          ]),
        }),
        products: input.products,
      });

      const cards = Object.freeze(
        (result.cards || []).filter((card) => !seed?.id || card.id !== seed.id),
      );

      return Object.freeze({
        ok: Boolean(result.ok),
        capabilityId: "catalog.recommend",
        ...result,
        cards,
        count: cards.length,
        mode:
          cards.length === 0
            ? "none"
            : result.mode === "exact"
              ? "ranked"
              : result.mode || "ranked",
        seedProductId: seed?.id || null,
        note:
          cards.length === 0
            ? "No recommendable ENARTE catalog matches."
            : "ENARTE catalog recommendations.",
      });
    },
  });

  registerCapability({
    id: "memory.read",
    status: CAPABILITY_STATUS.ACTIVE,
    description: "Read conversation memory for a session.",
    async invoke(ctx, input = {}) {
      const conversationId = input.conversationId || ctx?.conversationId;
      const entries = readMemory(conversationId, { limit: input.limit });
      return Object.freeze({
        ok: Boolean(conversationId),
        capabilityId: "memory.read",
        conversationId: conversationId || null,
        entries: Object.freeze([...entries]),
        count: entries.length,
      });
    },
  });

  registerCapability({
    id: "memory.write",
    status: CAPABILITY_STATUS.ACTIVE,
    description: "Append conversation memory for a session.",
    async invoke(ctx, input = {}) {
      const conversationId = input.conversationId || ctx?.conversationId;
      const result = appendMemory(conversationId, input.entry || input);
      return Object.freeze({
        ...result,
        capabilityId: "memory.write",
        conversationId: conversationId || null,
      });
    },
  });

  registerCapability({
    id: "notify.admin",
    status: CAPABILITY_STATUS.ACTIVE,
    description:
      "Queue an admin notification event via persistence (best-effort).",
    async invoke(ctx, input = {}) {
      const persistence = getAdapter("persistence.prisma");
      const payload = Object.freeze({
        type: input.type || "assistant_event",
        message: input.message || null,
        reason: input.reason || null,
        ...(input.payload && typeof input.payload === "object"
          ? input.payload
          : {}),
        at: new Date().toISOString(),
      });

      let recorded = Object.freeze({ ok: false, degraded: true });
      if (persistence?.api?.recordEvent && (ctx?.shop || input.shop)) {
        recorded = await persistence.api.recordEvent({
          shop: input.shop || ctx.shop,
          conversationId: input.conversationId || ctx?.conversationId || null,
          type: payload.type,
          payload,
        });
      }

      return Object.freeze({
        ok: true,
        capabilityId: "notify.admin",
        queued: true,
        persisted: Boolean(recorded?.ok),
        degraded: Boolean(recorded?.degraded),
        payload,
      });
    },
  });
}

registerReservedCapabilities();
