/**
 * Product Search Workflow — Sprint 2/3.
 *
 * Searches ENARTE Shopify catalog via catalog.search.
 * Conversation intelligence (slots, answers, follow-ups) works even when
 * Shopify catalog is offline — only product cards depend on Shopify.
 */

import { WORKFLOW_STATUS, EVENT_TYPE } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import { invokeCapability } from "../capabilities/registry.js";
import { publish } from "../core/event-bus.js";
import {
  buildCatalogIndependentConsult,
  buildSearchArtifactsFromSlots,
  hasSearchableIntent,
  mergeConversationSlots,
  nextFollowUpSlot,
} from "./_catalog-independent-consult.js";

function catalogOffline(search) {
  return (
    (!search?.ok && search?.error === "shopify_tools_disabled") ||
    (!search?.ok && search?.mode === "error") ||
    (!search?.ok && search?.error === "catalog_load_failed")
  );
}

export default Object.freeze({
  id: "product_search",
  status: WORKFLOW_STATUS.ACTIVE,
  phase: "sprint2",
  intents: Object.freeze([
    "search_products",
    "find_product",
    "product_search",
  ]),
  capabilities: Object.freeze([
    "catalog.search",
    "knowledge.read",
    "memory.write",
    "ai.nlu",
  ]),
  description:
    "Search ENARTE Shopify catalog; consult intelligently when catalog is offline.",

  async run(ctx, input = {}) {
    const message = String(input.message || input.query || "").trim();
    const seedSlots = {
      ...(input.artifacts?.describeSlots || {}),
    };
    if (input.artifacts?.room && !seedSlots.room) {
      seedSlots.room = String(input.artifacts.room).trim();
    }
    if (
      !seedSlots.productType &&
      (input.artifacts?.category === "chandeliers" ||
        /chandelier|ثريا/i.test(message))
    ) {
      seedSlots.productType = "chandelier";
    }
    if (
      !seedSlots.productType &&
      (input.artifacts?.category === "fans" || /fan|مروحة/i.test(message))
    ) {
      seedSlots.productType = "fan";
    }
    if (
      !seedSlots.productType &&
      (input.artifacts?.category === "outdoor" ||
        /outdoor|خارج/i.test(message))
    ) {
      seedSlots.productType = "outdoor";
    }

    const slots = mergeConversationSlots(message, seedSlots);
    const searchArtifacts = {
      ...(input.artifacts || {}),
      ...buildSearchArtifactsFromSlots(slots),
      describeSlots: slots,
    };

    // Enough intent to try catalog immediately (do not interrogate first).
    const searchable = hasSearchableIntent(slots, message);

    if (searchable) {
      const search = await invokeCapability("catalog.search", ctx, {
        shop: ctx.shop || input.shop,
        message,
        query: input.query,
        artifacts: searchArtifacts,
        products: input.products,
      });

      if (!catalogOffline(search)) {
        if (search.mode === "exact" || search.mode === "ranked") {
          return createWorkflowResult({
            ok: true,
            workflowId: "product_search",
            status: WORKFLOW_STATUS.ACTIVE,
            action: "products_found",
            message: null,
            data: {
              mode: search.mode,
              cards: search.cards,
              count: search.count,
              query: search.query,
              shop: search.shop,
              source: search.source,
              describeSlots: Object.freeze({ ...slots }),
            },
            note: search.note,
          });
        }

        if (search.mode === "similar" && search.count > 0) {
          return createWorkflowResult({
            ok: true,
            workflowId: "product_search",
            status: WORKFLOW_STATUS.ACTIVE,
            action: "similar_products",
            message: null,
            data: {
              mode: "similar",
              cards: search.cards,
              count: search.count,
              query: search.query,
              shop: search.shop,
              source: search.source,
              describeSlots: Object.freeze({ ...slots }),
            },
            note: search.note,
          });
        }

        // Catalog reachable, no match.
        // Ask for room only when we know the product type but not the space.
        // Otherwise hand off to product sourcing (ENARTE-only, no invented matches).
        if (slots.productType && !slots.room) {
          return buildCatalogIndependentConsult(
            ctx,
            { ...input, message, artifacts: searchArtifacts },
            {
              workflowId: "product_search",
              catalogUnavailable: false,
              describeSlots: slots,
              search,
            },
          );
        }

        await publish(EVENT_TYPE.WORKFLOW_DELEGATED, {
          from: "product_search",
          to: "product_sourcing",
          reason: "no_relevant_catalog_match",
        });

        const { executeWorkflow } = await import("../core/workflow-runner.js");
        const sourcing = await executeWorkflow("product_sourcing", ctx, {
          message,
          query: search.query,
          artifacts: searchArtifacts,
          reason: "no_relevant_enarte_match",
          routedBy: "product_search",
          skipGeneralDispatch: true,
        });

        return createWorkflowResult({
          ok: Boolean(sourcing?.ok),
          workflowId: "product_search",
          status: WORKFLOW_STATUS.ACTIVE,
          action: "sourcing_triggered",
          message: sourcing?.message ?? null,
          delegated: sourcing,
          data: {
            mode: "none",
            cards: Object.freeze([]),
            count: 0,
            query: search.query,
            shop: search.shop,
            describeSlots: Object.freeze({ ...slots }),
            sourcing,
          },
          note: "No relevant ENARTE products — triggered product_sourcing.",
        });
      }

      // Catalog offline: answer first, ask only for missing detail.
      return buildCatalogIndependentConsult(
        ctx,
        { ...input, message, artifacts: searchArtifacts },
        {
          workflowId: "product_search",
          catalogUnavailable: true,
          describeSlots: slots,
          search,
        },
      );
    }

    // No product signal yet — one clarifying consult question (still no menu).
    return buildCatalogIndependentConsult(
      ctx,
      { ...input, message, artifacts: searchArtifacts },
      {
        workflowId: "product_search",
        catalogUnavailable: false,
        describeSlots: slots,
      },
    );
  },
});
