/**
 * Chat experience API — sessions, welcome, actions, messages.
 * Decision Engine + Conversation State + optional Prisma persistence (V1).
 */

import { CHANNEL } from "../constants.js";
import { createSession } from "../core/session-manager.js";
import { appendMemory, readMemory } from "../core/memory.js";
import { handleTurn } from "../core/orchestrator.js";
import { getAdapter } from "../adapters/registry.js";
import {
  getSmartAction,
  listSmartActions,
  resolveActionLabel,
  isMainMenuRequest,
} from "./smart-actions.js";
import { formatTurnForChat, uxText, personalityText } from "./format-response.js";
import {
  decide,
  commitDecisionResult,
  toTurnInput,
  createConversationState,
  getConversationState,
  resetConversationState,
  resolveSmartButtonSet,
  DECISION_KIND,
  CONVERSATION_PHASE,
} from "../brain/index.js";
import { validateMessagePayload, validateSessionId } from "../utils/validation.js";
import { logAssistant, logAssistantError } from "../utils/logging.js";
import {
  findTaughtAnswer,
  upsertTaughtAnswer,
  verifyTrainKey,
} from "../learning/taught-answers.js";
import {
  parseTrainerCommand,
  trainerConfirmation,
  trainerNeedsContext,
} from "../learning/train-commands.js";

/** @type {Map<string, object>} */
const sessions = new Map();

function persistence() {
  return getAdapter("persistence.prisma")?.api || null;
}

function createMessage(partial) {
  return Object.freeze({
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    role: partial.role,
    type: partial.type || "text",
    content: partial.content ?? null,
    cards: partial.cards ? Object.freeze([...partial.cards]) : null,
    actions: partial.actions ? Object.freeze([...partial.actions]) : null,
    createdAt: new Date().toISOString(),
    meta: partial.meta ? Object.freeze({ ...partial.meta }) : null,
  });
}

function getStore(sessionId) {
  return sessions.get(sessionId) || null;
}

function publicSession(store) {
  const brain = getConversationState(store.session.id);
  return Object.freeze({
    id: store.session.id,
    shop: store.session.shop,
    locale: store.session.locale,
    channel: store.session.channel,
    status: store.session.status,
    createdAt: store.session.createdAt,
    phase: brain?.phase || CONVERSATION_PHASE.WELCOME,
    currentWorkflow: brain?.currentWorkflow || null,
    persisted: Boolean(store.persisted),
  });
}

function welcomeActions(locale) {
  return listSmartActions({ welcomeOnly: true }).map((a) => {
    const full = getSmartAction(a.id);
    return Object.freeze({
      id: a.id,
      label: resolveActionLabel(full, locale),
      workflowId: a.workflowId,
    });
  });
}

/**
 * Find the most recent real question/answer pair in the transcript so a trainer
 * can approve or correct "the last answer" by talking. Skips menus, photos, and
 * previous trainer command bubbles.
 */
function findLastQnA(store) {
  const messages = store?.messages || [];
  let answer = null;
  let answerIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (m.meta?.trainerCommand) continue;
    if (["welcome", "support_offer"].includes(m.type)) continue;
    if (!String(m.content || "").trim()) continue;
    answer = m;
    answerIndex = i;
    break;
  }
  let question = null;
  for (let i = answerIndex - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (m.meta?.trainerCommand) continue;
    if (!String(m.content || "").trim()) continue;
    question = m;
    break;
  }
  return { question, answer };
}

/** Hide earlier Smart Action Buttons so the conversation stays continuous. */
function retireHistoricalActions(store) {
  if (!store?.messages?.length) return;
  store.messages = store.messages.map((m) =>
    m.actions?.length ? Object.freeze({ ...m, actions: null }) : m,
  );
}

async function persistMessage(conversationId, message, workflowId) {
  const api = persistence();
  if (!api?.appendMessage) return;
  await api.appendMessage(conversationId, {
    ...message,
    workflowId,
    meta: { ...(message.meta || {}), workflowId: workflowId || null },
  });
}

/** Fire-and-forget so Prisma I/O never blocks the customer reply path. */
function queuePersistMessage(conversationId, message, workflowId) {
  void persistMessage(conversationId, message, workflowId).catch((error) => {
    logAssistantError("persist.message_failed", error, { conversationId });
  });
}

async function persistBrainState(conversationId, brain) {
  const api = persistence();
  if (!api?.updateConversationMetadata || !brain) return;
  await api.updateConversationMetadata(conversationId, {
    brain: {
      phase: brain.phase,
      currentWorkflow: brain.currentWorkflow,
      previousAction: brain.previousAction,
      clarification: brain.clarification,
      selectedProduct: brain.selectedProduct,
      selectedRoom: brain.selectedRoom,
      context: brain.context,
    },
  });
}

function queuePersistBrainState(conversationId, brain) {
  void persistBrainState(conversationId, brain).catch((error) => {
    logAssistantError("persist.brain_failed", error, { conversationId });
  });
}

function supportStuckMessage(locale = "ar") {
  const useEn = String(locale).toLowerCase().startsWith("en");
  return createMessage({
    role: "assistant",
    type: "support_offer",
    content: useEn
      ? "I hit a snag finishing that. Tap «Having a problem?» for WhatsApp, a call, or a human — we'll get you sorted."
      : "واجهت مشكلة في إكمال الطلب. اضغط «هل تواجه مشكلة؟» للدعم عبر واتساب أو الاتصال أو ممثل بشري — سنكمل معك فوراً.",
    meta: Object.freeze({ supportOffer: true }),
  });
}

/**
 * Start a chat session with welcome message + smart actions.
 */
export async function startChatSession(input = {}) {
  const created = await createSession({
    shop: input.shop,
    locale: input.locale,
    channel: input.channel || CHANNEL.API,
    metadata: input.metadata,
  });

  if (!created.ok) {
    return created;
  }

  const locale = created.session.locale || "ar";
  const actions = welcomeActions(locale);
  const welcomeText =
    (await personalityText("greeting", locale)) ||
    uxText("placeholder", locale);

  const welcome = createMessage({
    role: "assistant",
    type: "welcome",
    content: welcomeText,
    actions,
  });

  let persisted = false;
  const api = persistence();
  if (api?.saveConversation) {
    const saved = await api.saveConversation(created.session);
    persisted = Boolean(saved?.persisted);
    if (saved?.ok) {
      await persistMessage(created.session.id, welcome, null);
    }
  }

  const store = {
    session: created.session,
    messages: [welcome],
    persisted,
  };
  sessions.set(created.session.id, store);

  createConversationState(created.session.id, {
    phase: CONVERSATION_PHASE.WELCOME,
    previousAction: "welcome",
  });

  appendMemory(created.session.id, {
    role: "assistant",
    content: welcome.content,
    type: "welcome",
  });

  logAssistant("session.started", {
    conversationId: created.session.id,
    shop: created.session.shop,
    persisted,
  });

  return Object.freeze({
    ok: true,
    session: publicSession(store),
    messages: Object.freeze([...store.messages]),
    actions,
    decision: Object.freeze({
      kind: "show_actions",
      phase: CONVERSATION_PHASE.WELCOME,
      showSmartButtons: true,
    }),
  });
}

/**
 * Fetch session from memory, or hydrate from Prisma if available.
 */
export async function getChatSession(sessionId) {
  const idCheck = validateSessionId(sessionId);
  if (!idCheck.ok) {
    return Object.freeze({ ok: false, error: idCheck.error });
  }

  let store = getStore(idCheck.value);
  if (!store) {
    const api = persistence();
    if (api?.loadConversation) {
      const loaded = await api.loadConversation(idCheck.value);
      if (loaded?.ok) {
        store = {
          session: loaded.session,
          messages: [...loaded.messages],
          persisted: true,
        };
        sessions.set(idCheck.value, store);
        const brainSeed = loaded.session.metadata?.brain || {
          phase: CONVERSATION_PHASE.WELCOME,
        };
        createConversationState(idCheck.value, brainSeed);
      }
    }
  }

  if (!store) {
    return Object.freeze({ ok: false, error: "session_not_found" });
  }

  const brain = getConversationState(sessionId);
  const buttonSet = brain?.lastDecision?.smartButtonSet;
  const actions = buttonSet
    ? resolveSmartButtonSet(buttonSet, store.session.locale)
    : welcomeActions(store.session.locale);

  return Object.freeze({
    ok: true,
    session: publicSession(store),
    messages: Object.freeze([...store.messages]),
    actions,
    state: brain,
    history: Object.freeze([...store.messages]),
  });
}

/**
 * Handle a user text message or smart-action click via Decision Engine.
 */
export async function sendChatMessage(input = {}) {
  const validated = validateMessagePayload(input);
  if (!validated.ok) {
    return Object.freeze({ ok: false, error: validated.error });
  }
  const payload = validated.value;

  const store = getStore(payload.sessionId);
  if (!store) {
    // Try hydrate once
    const hydrated = await getChatSession(payload.sessionId);
    if (!hydrated.ok) {
      return Object.freeze({ ok: false, error: "session_not_found" });
    }
  }
  const liveStore = getStore(payload.sessionId);
  if (!liveStore) {
    return Object.freeze({ ok: false, error: "session_not_found" });
  }

  const locale = liveStore.session.locale || payload.locale || "ar";
  const state = getConversationState(liveStore.session.id);

  const isChoiceAction =
    typeof payload.actionId === "string" &&
    payload.actionId.startsWith("choice:");
  const isMainMenuAction = payload.actionId === "main_menu";

  let userContent = payload.message;
  if (payload.actionId && !isChoiceAction) {
    const action = getSmartAction(payload.actionId);
    if (!action) {
      return Object.freeze({ ok: false, error: "unknown_action" });
    }
    userContent = resolveActionLabel(action, locale);
  } else if (isChoiceAction) {
    userContent = payload.message || payload.actionId;
  } else if (payload.image && !userContent) {
    userContent =
      payload.image.source === "camera"
        ? locale.toLowerCase().startsWith("en")
          ? "Photo captured"
          : "تم التقاط صورة"
        : locale.toLowerCase().startsWith("en")
          ? "Photo uploaded"
          : "تم رفع صورة";
  }

  const describeArtifacts = {
    describeSlots: state?.context?.describeSlots || {},
    describeStep: state?.context?.describeStep || null,
    ...(isChoiceAction ? { choiceId: payload.actionId } : {}),
  };

  const trainerMode =
    !payload.actionId &&
    !payload.image &&
    Boolean(String(userContent || "").trim()) &&
    verifyTrainKey(input.trainKey);

  try {
    // Train mode: interpret plain messages as teaching instructions.
    if (trainerMode) {
      const command = parseTrainerCommand(userContent);
      if (command) {
        const userMessage = createMessage({
          role: "user",
          type: "text",
          content: userContent,
          meta: Object.freeze({
            trainerCommand: true,
            decisionKind: `trainer_${command.kind}`,
          }),
        });
        liveStore.messages.push(userMessage);
        queuePersistMessage(liveStore.session.id, userMessage, null);

        if (command.kind === "stop") {
          const confirmMessage = createMessage({
            role: "assistant",
            type: "text",
            content: trainerConfirmation("stop", {}, locale),
            meta: Object.freeze({
              trainerCommand: true,
              trainingEnded: true,
              teachable: false,
            }),
          });
          liveStore.messages.push(confirmMessage);
          queuePersistMessage(liveStore.session.id, confirmMessage, null);

          return Object.freeze({
            ok: true,
            trainingEnded: true,
            session: publicSession(liveStore),
            userMessage,
            messages: Object.freeze([confirmMessage]),
            transcript: Object.freeze([...liveStore.messages]),
            history: Object.freeze([...liveStore.messages]),
            decision: Object.freeze({
              kind: "trainer_stop",
              workflowId: null,
              needsClarification: false,
              showSmartButtons: false,
              smartButtonSet: null,
              escalate: false,
              escalationReason: null,
              note: "Trainer paused training for this visit",
            }),
            state: getConversationState(liveStore.session.id),
            transition: null,
            turn: Object.freeze({
              ok: true,
              route: null,
              action: "reply",
              leafAction: "reply",
            }),
            actions: Object.freeze([]),
            memorySize: readMemory(liveStore.session.id).length,
          });
        }

        let question = command.question || null;
        let answer = command.answer || null;

        if (command.kind === "approve" || command.kind === "correct") {
          const lastQnA = findLastQnA(liveStore);
          question = question || lastQnA.question?.content || null;
          if (command.kind === "approve") {
            answer = lastQnA.answer?.content || null;
          }
        }

        if (!question || !answer) {
          const askMessage = createMessage({
            role: "assistant",
            type: "text",
            content: trainerNeedsContext(locale),
            meta: Object.freeze({ trainerCommand: true, teachable: false }),
          });
          liveStore.messages.push(askMessage);
          queuePersistMessage(liveStore.session.id, askMessage, null);
          return Object.freeze({
            ok: true,
            session: publicSession(liveStore),
            userMessage,
            messages: Object.freeze([askMessage]),
            transcript: Object.freeze([...liveStore.messages]),
            history: Object.freeze([...liveStore.messages]),
            decision: Object.freeze({
              kind: `trainer_${command.kind}`,
              workflowId: null,
              needsClarification: true,
              showSmartButtons: false,
              smartButtonSet: null,
              escalate: false,
              escalationReason: null,
              note: "Trainer command missing question/answer context",
            }),
            state: getConversationState(liveStore.session.id),
            transition: null,
            turn: Object.freeze({ ok: true, route: null, action: "clarify", leafAction: "clarify" }),
            actions: Object.freeze([]),
            memorySize: readMemory(liveStore.session.id).length,
          });
        }

        const saved = await upsertTaughtAnswer({
          shop: liveStore.session.shop,
          question,
          answer,
          locale,
          conversationId: liveStore.session.id,
          sourceMessageId: userMessage.id,
        });

        const confirmContent = saved.ok
          ? trainerConfirmation(
              command.kind,
              { question, answer, persisted: saved.persisted },
              locale,
            )
          : locale.toLowerCase().startsWith("en")
            ? "Could not save that — please try again."
            : "تعذّر الحفظ — حاول مرة أخرى.";

        const confirmMessage = createMessage({
          role: "assistant",
          type: "text",
          content: confirmContent,
          meta: Object.freeze({
            trainerCommand: true,
            teachable: false,
            taught: saved.ok,
            taughtAnswerId: saved.answer?.id || null,
          }),
        });
        liveStore.messages.push(confirmMessage);
        queuePersistMessage(liveStore.session.id, confirmMessage, null);

        logAssistant("turn.trainer_command", {
          conversationId: liveStore.session.id,
          kind: command.kind,
          persisted: Boolean(saved.persisted),
        });

        return Object.freeze({
          ok: true,
          session: publicSession(liveStore),
          userMessage,
          messages: Object.freeze([confirmMessage]),
          transcript: Object.freeze([...liveStore.messages]),
          history: Object.freeze([...liveStore.messages]),
          decision: Object.freeze({
            kind: `trainer_${command.kind}`,
            workflowId: null,
            needsClarification: false,
            showSmartButtons: false,
            smartButtonSet: null,
            escalate: false,
            escalationReason: null,
            note: "Trainer taught answer via conversation",
          }),
          state: getConversationState(liveStore.session.id),
          transition: null,
          turn: Object.freeze({ ok: true, route: null, action: "reply", leafAction: "reply" }),
          actions: Object.freeze([]),
          memorySize: readMemory(liveStore.session.id).length,
        });
      }
    }

    // Prefer human-taught answers for free-text questions (not menu/photo flows).
    // Works for web, mobile site, and the app — same server DB.
    // Trainers also get taught answers when asking normal questions (so they can verify).
    const canUseTaught =
      !payload.actionId &&
      !payload.image &&
      !input.escalate &&
      Boolean(String(userContent || "").trim());

    if (canUseTaught) {
      const taught = await findTaughtAnswer({
        shop: liveStore.session.shop,
        question: userContent,
        locale,
      });
      if (taught.match?.answer) {
        const userMessage = createMessage({
          role: "user",
          type: "text",
          content: userContent,
          meta: Object.freeze({
            actionId: null,
            decisionKind: "taught_answer",
            taughtAnswerId: taught.match.id,
          }),
        });
        liveStore.messages.push(userMessage);
        queuePersistMessage(liveStore.session.id, userMessage, null);
        retireHistoricalActions(liveStore);

        const taughtMessage = createMessage({
          role: "assistant",
          type: "text",
          content: taught.match.answer,
          meta: Object.freeze({
            teachable: true,
            taught: true,
            taughtAnswerId: taught.match.id,
            question: userContent,
            needsTeach: false,
          }),
        });
        liveStore.messages.push(taughtMessage);
        queuePersistMessage(liveStore.session.id, taughtMessage, null);
        appendMemory(liveStore.session.id, {
          role: "user",
          content: userContent,
        });
        appendMemory(liveStore.session.id, {
          role: "assistant",
          content: taught.match.answer,
          metadata: Object.freeze({ taught: true }),
        });

        logAssistant("turn.taught_answer", {
          conversationId: liveStore.session.id,
          taughtAnswerId: taught.match.id,
          score: taught.score,
        });

        return Object.freeze({
          ok: true,
          session: publicSession(liveStore),
          userMessage,
          messages: Object.freeze([taughtMessage]),
          transcript: Object.freeze([...liveStore.messages]),
          history: Object.freeze([...liveStore.messages]),
          decision: Object.freeze({
            kind: "taught_answer",
            workflowId: null,
            needsClarification: false,
            showSmartButtons: false,
            smartButtonSet: null,
            escalate: false,
            escalationReason: null,
            note: "Human-approved taught answer",
          }),
          state: getConversationState(liveStore.session.id),
          transition: null,
          turn: Object.freeze({
            ok: true,
            route: null,
            action: "reply",
            leafAction: "reply",
          }),
          actions: Object.freeze([]),
          memorySize: readMemory(liveStore.session.id).length,
        });
      }
    }

    const decision = decide({
      conversationId: liveStore.session.id,
      state,
      message:
        payload.actionId && !isChoiceAction
          ? getSmartAction(payload.actionId)?.message || userContent
          : isMainMenuRequest(userContent)
            ? userContent
            : userContent,
      actionId: isMainMenuAction
        ? "main_menu"
        : isChoiceAction
          ? payload.actionId
          : payload.actionId || null,
      intent: input.intent,
      workflowId: input.workflowId,
      artifacts: {
        ...(payload.artifacts || {}),
        ...describeArtifacts,
      },
      image: payload.image,
      escalate: input.escalate,
      transitionEvent: input.transitionEvent,
    });

    const userMessage = createMessage({
      role: "user",
      type: payload.actionId
        ? "action"
        : payload.image
          ? "photo"
          : "text",
      content: userContent,
      meta: Object.freeze({
        actionId: payload.actionId || null,
        decisionKind: decision.kind,
        image: payload.image
          ? Object.freeze({
              name: payload.image.name || null,
              source: payload.image.source || null,
              photoKind: payload.image.photoKind || null,
            })
          : null,
      }),
    });
    liveStore.messages.push(userMessage);
    queuePersistMessage(liveStore.session.id, userMessage, decision.workflowId);
    // Customer engaged — remove stale welcome/menu chips from earlier bubbles.
    retireHistoricalActions(liveStore);

    // SHOW_ACTIONS (main menu) — reply with welcome buttons, no workflow noise.
    if (decision.kind === DECISION_KIND.SHOW_ACTIONS) {
      const menuActions = resolveSmartButtonSet(
        decision.smartButtonSet || "welcome",
        locale,
      );
      const menuText =
        (await personalityText("greeting", locale)) ||
        uxText("placeholder", locale);
      const menuMessage = createMessage({
        role: "assistant",
        type: "welcome",
        content: menuText,
        actions: menuActions,
        meta: Object.freeze({
          workflowId: decision.workflowId,
          openCamera: false,
        }),
      });
      commitDecisionResult({
        conversationId: liveStore.session.id,
        decision,
        turn: {
          workflowResult: {
            action: "reply",
            message: menuText,
            data: {},
          },
        },
      });
      liveStore.messages.push(menuMessage);
      queuePersistMessage(liveStore.session.id, menuMessage, decision.workflowId);
      return Object.freeze({
        ok: true,
        session: publicSession(liveStore),
        userMessage,
        messages: Object.freeze([menuMessage]),
        transcript: Object.freeze([...liveStore.messages]),
        history: Object.freeze([...liveStore.messages]),
        decision: Object.freeze({
          kind: decision.kind,
          workflowId: decision.workflowId,
          needsClarification: false,
          showSmartButtons: true,
          smartButtonSet: decision.smartButtonSet,
          escalate: false,
          escalationReason: null,
          note: decision.note,
        }),
        state: getConversationState(liveStore.session.id),
        transition: null,
        turn: Object.freeze({
          ok: true,
          route: null,
          action: "reply",
          leafAction: "reply",
        }),
        actions: menuActions,
        memorySize: readMemory(liveStore.session.id).length,
      });
    }

    const turnInput = toTurnInput(decision, {
      shop: liveStore.session.shop,
      locale,
      session: liveStore.session,
      message: decision.message || userContent,
      artifacts: {
        ...(payload.artifacts || {}),
        ...(decision.artifacts || {}),
        ...describeArtifacts,
        describeSlots:
          decision.artifacts?.describeSlots ||
          state?.context?.describeSlots ||
          {},
        describeStep:
          decision.artifacts?.describeStep ||
          state?.context?.describeStep ||
          null,
      },
      products: payload.products,
      image: payload.image,
      selectedProduct:
        payload.selectedProduct || state?.selectedProduct || null,
      selectedRoom: payload.selectedRoom || state?.selectedRoom || null,
      history: readMemory(liveStore.session.id, { limit: 10 }),
    });

    const turn = await handleTurn(turnInput);

    const committed = commitDecisionResult({
      conversationId: liveStore.session.id,
      decision,
      turn,
      selectedProduct: payload.selectedProduct,
      selectedRoom: payload.selectedRoom,
      uploadedImage: payload.image || null,
    });

    queuePersistBrainState(liveStore.session.id, committed?.state);

    const followUpActions =
      committed?.showSmartButtons
        ? resolveSmartButtonSet(committed.smartButtonSet, locale)
        : decision.showSmartButtons
          ? resolveSmartButtonSet(decision.smartButtonSet, locale)
          : Object.freeze([]);

    const replyMessages = (
      await formatTurnForChat(turn, locale)
    ).map((m, index, arr) => {
      const isLast = index === arr.length - 1;
      const localActions = Array.isArray(m.actions) ? m.actions : null;
      const content = m.content ?? null;
      const leafAction =
        turn.workflowResult?.delegated?.action || turn.workflowResult?.action;
      const isOutOfDomain = Boolean(
        decision.outOfDomain ||
          turn.workflowResult?.data?.outOfDomain ||
          turn.workflowResult?.delegated?.data?.outOfDomain,
      );
      const needsTeach =
        Boolean(userContent) &&
        !payload.actionId &&
        !payload.image &&
        (isOutOfDomain ||
          !String(content || "").trim() ||
          leafAction === "placeholder");

      return createMessage({
        ...m,
        actions:
          localActions && localActions.length
            ? localActions
            : isLast && followUpActions.length
              ? followUpActions
              : null,
        meta: Object.freeze({
          ...(m.meta || {}),
          workflowId: decision.workflowId,
          openCamera: false,
          teachable: Boolean(userContent) && !payload.image,
          question: userContent || null,
          needsTeach,
          taught: false,
        }),
      });
    });

    if (decision.escalate && replyMessages.length) {
      const last = replyMessages[replyMessages.length - 1];
      const escalated = createMessage({
        ...last,
        content:
          (last.content ? `${last.content}\n\n` : "") +
          (locale.startsWith("en")
            ? "Connecting you with the ENARTE team. Use «Having a problem?» anytime for WhatsApp, call, or feedback."
            : "سيتم توصيلك بفريق ENARTE. استخدم «هل تواجه مشكلة؟» في أي وقت لواتساب أو الاتصال أو الملاحظات."),
        actions: followUpActions.length ? followUpActions : last.actions,
        meta: Object.freeze({
          ...(last.meta || {}),
          supportOffer: true,
        }),
      });
      liveStore.messages.push(...replyMessages.slice(0, -1), escalated);
      queuePersistMessage(liveStore.session.id, escalated, decision.workflowId);
    } else {
      liveStore.messages.push(...replyMessages);
      for (const msg of replyMessages) {
        queuePersistMessage(liveStore.session.id, msg, decision.workflowId);
      }
    }

    for (const msg of replyMessages) {
      appendMemory(liveStore.session.id, {
        role: msg.role,
        content: msg.content || msg.type,
        type: msg.type,
        metadata: Object.freeze({
          cards: msg.cards || null,
          selectedProduct:
            committed?.state?.selectedProduct ||
            payload.selectedProduct ||
            null,
          selectedRoom:
            committed?.state?.selectedRoom || payload.selectedRoom || null,
        }),
      });
    }

    logAssistant("turn.completed", {
      conversationId: liveStore.session.id,
      workflowId: decision.workflowId,
      action:
        turn.workflowResult?.delegated?.action || turn.workflowResult?.action,
      phase: committed?.state?.phase,
    });

    return Object.freeze({
      ok: Boolean(turn.ok) || replyMessages.length > 0,
      session: publicSession(liveStore),
      userMessage,
      messages: Object.freeze(replyMessages),
      transcript: Object.freeze([...liveStore.messages]),
      history: Object.freeze([...liveStore.messages]),
      decision: Object.freeze({
        kind: decision.kind,
        workflowId: decision.workflowId,
        needsClarification: decision.needsClarification,
        showSmartButtons: Boolean(
          committed?.showSmartButtons || decision.showSmartButtons,
        ),
        smartButtonSet:
          committed?.smartButtonSet || decision.smartButtonSet || null,
        escalate: decision.escalate,
        escalationReason: decision.escalationReason,
        note: decision.note,
      }),
      state: committed?.state || getConversationState(liveStore.session.id),
      transition: committed?.transition || null,
      turn: Object.freeze({
        ok: turn.ok,
        route: turn.route,
        action: turn.workflowResult?.action,
        leafAction:
          turn.workflowResult?.delegated?.action || turn.workflowResult?.action,
      }),
      actions: followUpActions,
      memorySize: readMemory(liveStore.session.id).length,
      supportOffer:
        Boolean(decision.escalate) ||
        turn.ok === false ||
        Boolean(
          replyMessages.some(
            (m) =>
              !m.cards?.length &&
              /catalog|كتالوج|واتساب|WhatsApp|support|دعم/i.test(
                String(m.content || ""),
              ) &&
              /offline|unavailable|مشكلة|لا أستطيع|cannot|couldn't|couldn't|could not|مؤقت/i.test(
                String(m.content || ""),
              ),
          ),
        ),
    });
  } catch (error) {
    logAssistantError("turn.failed", error, {
      conversationId: liveStore.session.id,
    });
    const stuck = supportStuckMessage(locale);
    liveStore.messages.push(stuck);
    queuePersistMessage(liveStore.session.id, stuck, null);
    return Object.freeze({
      ok: false,
      error: "turn_failed",
      note: error instanceof Error ? error.message : "unknown_error",
      supportOffer: true,
      session: publicSession(liveStore),
      messages: Object.freeze([stuck]),
      transcript: Object.freeze([...liveStore.messages]),
      history: Object.freeze([...liveStore.messages]),
    });
  }
}

export function listChatSmartActions(locale = "ar") {
  return welcomeActions(locale);
}

export function resetChatSessions() {
  for (const id of sessions.keys()) {
    resetConversationState(id);
  }
  sessions.clear();
  resetConversationState();
}
