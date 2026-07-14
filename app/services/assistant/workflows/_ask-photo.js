/**
 * Ask-for-photo workflows (room / product image).
 * Never opens the camera — UX waits for an explicit customer gesture.
 *
 * Product photos → Vision attribute catalog search (Shopify only) + similar fallback.
 * Room photos → analyze → text catalog.search (existing soft path).
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createWorkflowResult } from "../contracts/index.js";
import {
  getPersonalityImageAskMessage,
  getPersonalityRoomAskMessage,
  getPersonalityMessage,
} from "../knowledge/readers/assistant-personality.js";
import { invokeCapability } from "../capabilities/registry.js";
import { isOpenAiConfigured } from "../openai-responses.server.js";
import {
  analyzeAssistantPhoto,
  visionToDescribeSlots,
} from "../ai/vision/photo-analyze.js";
import { setConversationState, getConversationState } from "../brain/state.js";
import {
  imageSearchSourcingMessage,
  searchCatalogByImage,
} from "../../catalog/image-search.server.js";

function resolveImage(ctx, input) {
  return (
    input.image ||
    input.artifacts?.image ||
    (Array.isArray(ctx.uploadedImages) && ctx.uploadedImages.length
      ? ctx.uploadedImages[ctx.uploadedImages.length - 1]
      : null)
  );
}

function dataUrlToBuffer(dataUrl) {
  const raw = String(dataUrl || "");
  const comma = raw.indexOf(",");
  if (comma < 0) return null;
  try {
    return Buffer.from(raw.slice(comma + 1), "base64");
  } catch {
    return null;
  }
}

function cardsFromImageSearch(products) {
  return (products || []).map((p) =>
    Object.freeze({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: p.currency || "JOD",
      image: p.image,
      url: p.url,
      handle: p.handle,
      collection: p.collection,
      matchReason: p.matchReason || null,
      score: p.score,
    }),
  );
}

function pickPitch(analysis, locale, cards, mode) {
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  if (mode === "similar") {
    return useEn
      ? "No exact match in the catalog — here are the closest ENARTE pieces:"
      : "لا يوجد تطابق تام في الكتالوج — هذه أقرب قطع ENARTE:";
  }
  if (useEn && analysis?.pitchHintEn) return analysis.pitchHintEn;
  if (!useEn && analysis?.pitchHintAr) return analysis.pitchHintAr;
  if (cards?.length) {
    return useEn
      ? `Based on your photo, here are the closest ENARTE pieces — ranked best first.`
      : `بناءً على صورتك، هذه أقرب قطع ENARTE — مرتّبة من الأنسب.`;
  }
  return null;
}

/**
 * @param {object} spec
 * @param {string} spec.id
 * @param {string[]} spec.intents
 * @param {string} spec.description
 * @param {"room"|"product"} spec.photoKind
 */
export function createAskPhotoWorkflow(spec) {
  const { id, intents, description, photoKind } = spec;

  return Object.freeze({
    id,
    status: WORKFLOW_STATUS.ACTIVE,
    phase: "entry_redesign",
    intents: Object.freeze([...(intents || [])]),
    capabilities: Object.freeze([
      "knowledge.read",
      "catalog.search",
      "memory.write",
    ]),
    description: description || "",
    async run(ctx, input = {}) {
      const locale = ctx.locale || ctx.config?.runtime?.defaultLocale || "ar";
      const knowledgeOpts = {
        manager: ctx?.knowledge
          ? { get: (kid, opts) => ctx.knowledge.get(kid, opts) }
          : undefined,
      };

      const image = resolveImage(ctx, input);
      const hasImage = Boolean(image);

      if (hasImage) {
        // --- Product photo: Vision / fingerprint catalog orchestrator ---
        if (photoKind === "product") {
          const buffer =
            image?.buffer ||
            (image?.dataUrl ? dataUrlToBuffer(image.dataUrl) : null);

          if (buffer?.length) {
            const result = await searchCatalogByImage({
              imageBuffer: buffer,
              shop: ctx.shop || input.shop || null,
              limit: 8,
              locale,
            });

            const cards = cardsFromImageSearch(result.products);
            const sourcingMessage =
              result.sourcingMessage || imageSearchSourcingMessage(locale);
            const showSourcing = Boolean(
              result.showSourcingOffer ||
                result.unavailable ||
                result.mode === "similar" ||
                !cards.length,
            );

            if (ctx.conversationId) {
              const state = getConversationState(ctx.conversationId);
              setConversationState(ctx.conversationId, {
                ...(state || {}),
                context: {
                  ...(state?.context || {}),
                  conversationActive: true,
                  freeChatMode: true,
                  photoKind,
                  awaitingPhoto: false,
                  photoReceived: true,
                  imageSearchMode: result.mode || null,
                },
              });
            }

            if (cards.length) {
              const action =
                result.mode === "similar" || result.mode === "unavailable"
                  ? "similar_products"
                  : "products_found";
              return createWorkflowResult({
                ok: true,
                workflowId: id,
                status: WORKFLOW_STATUS.ACTIVE,
                action,
                message: pickPitch(null, locale, cards, result.mode),
                data: Object.freeze({
                  photoKind,
                  photoReceived: true,
                  awaitingPhoto: false,
                  analysisDeferred: false,
                  analysisAvailable: Boolean(result.vision?.ok),
                  mode: result.mode || "match",
                  cards: Object.freeze(cards),
                  count: cards.length,
                  engine: result.engine || null,
                  showSourcingOffer: showSourcing,
                  sourcingMessage: showSourcing ? sourcingMessage : null,
                  shop: result.shop || ctx.shop || null,
                }),
                note: `${id} — product photo → image search (${result.mode}).`,
              });
            }

            return createWorkflowResult({
              ok: true,
              workflowId: id,
              status: WORKFLOW_STATUS.ACTIVE,
              action: "sourcing_triggered",
              message: sourcingMessage,
              data: Object.freeze({
                photoKind,
                photoReceived: true,
                awaitingPhoto: false,
                unavailable: true,
                showSourcingOffer: true,
                sourcingMessage,
                engine: result.engine || null,
              }),
              note: `${id} — product photo; no catalog match → sourcing WhatsApp.`,
            });
          }
        }

        // --- Room (or product without buffer): text Vision + catalog.search ---
        const canVision = isOpenAiConfigured();
        let analysis = null;
        if (canVision && image?.dataUrl) {
          analysis = await analyzeAssistantPhoto(image, photoKind);
        }

        if (analysis?.searchQuery) {
          const describeSlots = visionToDescribeSlots(analysis);
          if (ctx.conversationId && Object.keys(describeSlots).length) {
            const state = getConversationState(ctx.conversationId);
            setConversationState(ctx.conversationId, {
              ...(state || {}),
              context: {
                ...(state?.context || {}),
                conversationActive: true,
                freeChatMode: true,
                describeSlots: Object.freeze({
                  ...(state?.context?.describeSlots || {}),
                  ...describeSlots,
                }),
                photoKind,
                awaitingPhoto: false,
                photoReceived: true,
              },
              selectedRoom: analysis.roomType
                ? { name: analysis.roomType }
                : state?.selectedRoom || null,
            });
          }

          const search = await invokeCapability("catalog.search", ctx, {
            shop: ctx.shop || input.shop,
            message: analysis.searchQuery,
            artifacts: Object.freeze({
              describeSlots,
              keywords: Object.freeze(
                analysis.searchQuery.split(/\s+/).filter(Boolean),
              ),
              category:
                describeSlots.productType === "chandelier"
                  ? "chandeliers"
                  : describeSlots.productType === "fan"
                    ? "fans"
                    : describeSlots.productType === "outdoor"
                      ? "outdoor"
                      : null,
            }),
          });

          const cards = search?.cards || [];
          if (cards.length) {
            const isSimilar = search.mode === "similar";
            const sourcingMessage = isSimilar
              ? imageSearchSourcingMessage(locale)
              : null;
            return createWorkflowResult({
              ok: true,
              workflowId: id,
              status: WORKFLOW_STATUS.ACTIVE,
              action: isSimilar ? "similar_products" : "products_found",
              message: pickPitch(analysis, locale, cards, search.mode),
              data: Object.freeze({
                photoKind,
                photoReceived: true,
                awaitingPhoto: false,
                analysisDeferred: false,
                analysisAvailable: true,
                analysis,
                describeSlots,
                mode: search.mode || "ranked",
                cards: Object.freeze([...cards]),
                count: cards.length,
                query: search.query || null,
                shop: search.shop || ctx.shop || null,
                showSourcingOffer: isSimilar,
                sourcingMessage,
              }),
              note: `${id} — photo analyzed → catalog matches.`,
            });
          }
        }

        // Soft fallback: search using last known slots / generic lighting query.
        const state = ctx.conversationId
          ? getConversationState(ctx.conversationId)
          : null;
        const known = state?.context?.describeSlots || {};
        const hasKnownPrefs = Object.values(known).some(Boolean);
        const fallbackQuery = [
          known.productType,
          known.style,
          known.color,
          known.room,
          photoKind === "product" ? "lighting fixture" : null,
        ]
          .filter(Boolean)
          .join(" ");

        if (hasKnownPrefs || analysis?.searchQuery) {
          const soft = await invokeCapability("catalog.search", ctx, {
            shop: ctx.shop || input.shop,
            message: fallbackQuery || analysis.searchQuery || "chandelier lighting",
            artifacts: Object.freeze({ describeSlots: known }),
          });
          if (soft?.cards?.length) {
            const useEn = String(locale).toLowerCase().startsWith("en");
            const sourcingMessage = imageSearchSourcingMessage(locale);
            return createWorkflowResult({
              ok: true,
              workflowId: id,
              status: WORKFLOW_STATUS.ACTIVE,
              action: "similar_products",
              message: useEn
                ? analysis
                  ? "Closest ENARTE matches from your photo — best first."
                  : "Using what you already told me, here are the closest ENARTE picks."
                : analysis
                  ? "أقرب منتجات ENARTE من صورتك — الأنسب أولاً."
                  : "بناءً على تفضيلاتك، هذه أقرب خيارات ENARTE.",
              data: Object.freeze({
                photoKind,
                photoReceived: true,
                awaitingPhoto: false,
                analysisDeferred: !analysis,
                analysisAvailable: Boolean(analysis),
                cards: Object.freeze([...soft.cards]),
                count: soft.cards.length,
                mode: soft.mode || "similar",
                showSourcingOffer: true,
                sourcingMessage,
              }),
              note: `${id} — photo path soft catalog fallback.`,
            });
          }
        }

        const sourcingMessage = imageSearchSourcingMessage(locale);
        if (photoKind === "product") {
          return createWorkflowResult({
            ok: true,
            workflowId: id,
            status: WORKFLOW_STATUS.ACTIVE,
            action: "sourcing_triggered",
            message: sourcingMessage,
            data: Object.freeze({
              photoKind,
              photoReceived: true,
              awaitingPhoto: false,
              unavailable: true,
              showSourcingOffer: true,
              sourcingMessage,
            }),
            note: `${id} — product photo; no match → sourcing WhatsApp.`,
          });
        }

        const disabledKey =
          photoKind === "room" ? "roomAnalysisDisabled" : "imageSearchDisabled";
        const received =
          (await getPersonalityMessage(disabledKey, locale, knowledgeOpts)) ||
          null;

        return createWorkflowResult({
          ok: true,
          workflowId: id,
          status: WORKFLOW_STATUS.ACTIVE,
          action: "reply",
          message: received,
          data: Object.freeze({
            photoKind,
            photoReceived: true,
            awaitingPhoto: false,
            analysisDeferred: true,
            analysisAvailable: false,
            offerRecoveryActions: true,
          }),
          note: `${id} — photo received; analysis/catalog unavailable.`,
        });
      }

      const askMessage =
        photoKind === "room"
          ? await getPersonalityRoomAskMessage(locale, knowledgeOpts)
          : await getPersonalityImageAskMessage(locale, knowledgeOpts);

      return createWorkflowResult({
        ok: true,
        workflowId: id,
        status: WORKFLOW_STATUS.ACTIVE,
        action: "ask_photo",
        message: askMessage || null,
        data: Object.freeze({
          photoKind,
          awaitingPhoto: true,
          openCamera: false,
        }),
        note: `${id} — ask for ${photoKind} photo (no auto-camera).`,
      });
    },
  });
}
