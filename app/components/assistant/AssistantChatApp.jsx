/**
 * ENARTE AI Assistant — independent customer chat experience.
 * Does not import or depend on EnarteHomePage / try-in-room UI.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { enarteApiUrl } from "../../utils/enarte-api-base.js";
import MessageList from "./MessageList.jsx";
import Composer from "./Composer.jsx";
import SupportSheet from "./SupportSheet.jsx";
import { getSupportTriggerLabel } from "./support-actions.js";

function humanizeError(code, locale = "ar") {
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  const map = {
    invalid_json: useEn
      ? "Connection glitch — please send again."
      : "حصل خلل بالاتصال — أعد الإرسال من فضلك.",
    session_not_found: useEn
      ? "Session expired — starting a fresh chat."
      : "انتهت الجلسة — نبدأ محادثة جديدة.",
    network_error: useEn
      ? "Network error — check your connection."
      : "مشكلة بالشبكة — تحقق من الاتصال.",
    send_failed: useEn
      ? "Could not send the message — try again."
      : "تعذر إرسال الرسالة — حاول مرة أخرى.",
  };
  return map[code] || (useEn ? "Something went wrong." : "حدث خطأ غير متوقع.");
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

function makeOptimisticUserMessage(content, meta = {}) {
  return {
    id: `optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: "user",
    type: meta.type || "text",
    content,
    meta: Object.freeze(meta),
  };
}

function sessionStorageKey(shop) {
  return `enarte_assistant_session:${String(shop || "default").toLowerCase()}`;
}

function readStoredSessionId(shop) {
  try {
    return window.localStorage.getItem(sessionStorageKey(shop)) || null;
  } catch {
    return null;
  }
}

function storeSessionId(shop, id) {
  try {
    if (id) window.localStorage.setItem(sessionStorageKey(shop), id);
  } catch {
    // ignore quota / private mode
  }
}

const TRAIN_KEY_STORAGE = "enarte_assistant_train_key";

function readStoredTrainKey() {
  try {
    return window.localStorage.getItem(TRAIN_KEY_STORAGE) || null;
  } catch {
    return null;
  }
}

function persistTrainKey(key) {
  try {
    if (key) window.localStorage.setItem(TRAIN_KEY_STORAGE, key);
  } catch {
    // ignore quota / private mode
  }
}

function clearStoredTrainKey() {
  try {
    window.localStorage.removeItem(TRAIN_KEY_STORAGE);
  } catch {
    // ignore
  }
}

function clearTrainParamFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("train")) return;
    url.searchParams.delete("train");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {
    // ignore
  }
}

function readBootParams() {
  if (typeof window === "undefined") {
    return { action: null, continueChat: false, trainKey: null, trainOff: false };
  }
  const url = new URL(window.location.href);
  const rawTrain = url.searchParams.get("train");
  const trainOff = rawTrain === "off" || rawTrain === "0";
  return {
    action: url.searchParams.get("action") || null,
    continueChat:
      url.searchParams.get("continue") === "1" ||
      url.searchParams.get("continue") === "true",
    trainKey: trainOff ? null : rawTrain || null,
    trainOff,
  };
}

function clearBootActionFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("action") && !url.searchParams.has("continue")) {
      return;
    }
    url.searchParams.delete("action");
    url.searchParams.delete("continue");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {
    // ignore
  }
}

function AssistantSkeleton({ locale = "ar" }) {
  const useEn = String(locale).toLowerCase().startsWith("en");
  return (
    <div className="ea-skeleton" aria-busy="true" aria-live="polite">
      <div className="ea-skeleton-line ea-skeleton-line--lg" />
      <div className="ea-skeleton-line" />
      <div className="ea-skeleton-chips">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="ea-skeleton-hint">
        {useEn ? "Opening your ENARTE consultant…" : "جاري فتح مستشار ENARTE…"}
      </p>
    </div>
  );
}

export default function AssistantChatApp({
  shop,
  locale = "ar",
  initialAction = null,
  continueChat = false,
  trainKey: trainKeyProp = null,
}) {
  const bootParams = useMemo(() => {
    const fromUrl = readBootParams();
    return {
      action: initialAction || fromUrl.action,
      continueChat: continueChat || fromUrl.continueChat,
    };
  }, [initialAction, continueChat]);

  // Train mode is remembered per-device: activate once via the training link,
  // then it stays on for this browser. Customers never see the controls.
  const [trainKey, setTrainKey] = useState(null);
  useEffect(() => {
    const fromUrl = readBootParams();
    if (fromUrl.trainOff) {
      clearStoredTrainKey();
      setTrainKey(null);
      return;
    }
    const key = trainKeyProp || fromUrl.trainKey || readStoredTrainKey();
    if (key) {
      persistTrainKey(key);
      setTrainKey(key);
    }
  }, [trainKeyProp]);

  const trainMode = Boolean(trainKey);

  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [photoKind, setPhotoKind] = useState("room");
  const stickTokenRef = useRef(0);
  const forceStickTokenRef = useRef(0);
  const [stickToken, setStickToken] = useState(0);
  const [forceStickToken, setForceStickToken] = useState(0);
  const pendingActionRef = useRef(null);
  const actionAppliedRef = useRef(false);

  const bumpStick = useCallback((force = false) => {
    stickTokenRef.current += 1;
    setStickToken(stickTokenRef.current);
    if (force) {
      forceStickTokenRef.current += 1;
      setForceStickToken(forceStickTokenRef.current);
    }
  }, []);

  const dir = String(locale).toLowerCase().startsWith("en") ? "ltr" : "rtl";

  const send = useCallback(
    async ({ message, actionId, selectedProduct, image, escalate } = {}) => {
      if (!sessionId || busy) return;
      setBusy(true);
      setError(null);
      bumpStick(true);

      const optimisticContent =
        message ||
        (actionId
          ? dir === "rtl"
            ? "تم اختيار إجراء"
            : "Action selected"
          : image
            ? dir === "rtl"
              ? "تم إرسال صورة"
              : "Photo sent"
            : escalate
              ? dir === "rtl"
                ? "طلب دعم"
                : "Support request"
              : "");
      if (optimisticContent) {
        setMessages((prev) => [
          ...prev,
          makeOptimisticUserMessage(optimisticContent, {
            type: actionId ? "action" : image ? "photo" : "text",
            actionId: actionId || null,
            optimistic: true,
          }),
        ]);
        bumpStick(true);
      }

      try {
        const response = await fetch(enarteApiUrl("/api/assistant/messages"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(trainKey ? { "X-Enarte-Train-Key": trainKey } : {}),
          },
          body: JSON.stringify({
            sessionId,
            message,
            actionId,
            selectedProduct,
            image,
            locale,
            shop,
            escalate: Boolean(escalate),
            trainKey: trainKey || undefined,
          }),
        });
        let data = await readJson(response);

        // After server restart, in-memory sessions are gone — recreate and retry once.
        if (
          (!response.ok || data.error === "session_not_found") &&
          data.error === "session_not_found"
        ) {
          try {
            window.localStorage.removeItem(sessionStorageKey(shop));
          } catch {
            // ignore
          }
          const refresh = await fetch(enarteApiUrl("/api/assistant/sessions"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shop, locale }),
          });
          const fresh = await readJson(refresh);
          if (fresh?.ok && fresh.session?.id) {
            setSessionId(fresh.session.id);
            storeSessionId(shop, fresh.session.id);
            if (fresh.messages?.length) {
              setMessages(fresh.messages);
            }
            const retry = await fetch(enarteApiUrl("/api/assistant/messages"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(trainKey ? { "X-Enarte-Train-Key": trainKey } : {}),
              },
              body: JSON.stringify({
                sessionId: fresh.session.id,
                message,
                actionId,
                selectedProduct,
                image,
                locale,
                shop,
                escalate: Boolean(escalate),
                trainKey: trainKey || undefined,
              }),
            });
            data = await readJson(retry);
          }
        }

        if (data.transcript) {
          setMessages(data.transcript);
        } else if (data.userMessage || data.messages) {
          setMessages((prev) => {
            const withoutOptimistic = prev.filter((m) => !m.meta?.optimistic);
            return [
              ...withoutOptimistic,
              ...(data.userMessage ? [data.userMessage] : []),
              ...(data.messages || []),
            ];
          });
        }
        if (data.trainingEnded) {
          // Pause for this visit only — keep the device remembered so training
          // resumes automatically the next time the assistant is opened here.
          clearTrainParamFromUrl();
          setTrainKey(null);
        }
        if (!data.ok && !data.messages?.length && !data.transcript) {
          setError(data.error || "send_failed");
          setSupportOpen(true);
        } else if (!data.ok || data.supportOffer) {
          if (!data.ok) setError(data.error || "send_failed");
          setSupportOpen(Boolean(data.supportOffer) || !data.ok);
        }
        const last = (data.transcript || data.messages || []).slice(-1)[0];
        if (last?.meta?.photoKind) {
          setPhotoKind(last.meta.photoKind === "product" ? "product" : "room");
        }
        bumpStick(true);
        setDraft("");
        requestAnimationFrame(() => {
          bumpStick(true);
          setTimeout(() => bumpStick(true), 120);
        });
      } catch (err) {
        setMessages((prev) => prev.filter((m) => !m.meta?.optimistic));
        setError(err instanceof Error ? err.message : "network_error");
        setSupportOpen(true);
      } finally {
        setBusy(false);
        bumpStick(true);
      }
    },
    [sessionId, busy, locale, dir, bumpStick, shop, trainKey],
  );

  const boot = useCallback(async () => {
    setBooting(true);
    setError(null);
    try {
      let data = null;
      const storedId = readStoredSessionId(shop);
      const preferResume =
        bootParams.continueChat ||
        bootParams.action === "talk_to_assistant" ||
        Boolean(storedId);

      if (preferResume && storedId) {
        const resumed = await fetch(
          enarteApiUrl(`/api/assistant/sessions?id=${encodeURIComponent(storedId)}`),
        );
        data = await readJson(resumed);
        if (!data.ok) data = null;
      }

      if (!data?.ok) {
        const response = await fetch(enarteApiUrl("/api/assistant/sessions"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop, locale }),
        });
        data = await readJson(response);
      }

      if (!data?.ok) {
        setError(data?.error || data?.note || "session_failed");
        setSupportOpen(true);
        return;
      }

      setSessionId(data.session.id);
      storeSessionId(shop, data.session.id);

      let nextMessages = [...(data.messages || [])];
      const lastMsg = nextMessages[nextMessages.length - 1];
      const welcomeHasButtons = Boolean(lastMsg?.actions?.length);
      const useEn = String(locale || "ar").toLowerCase().startsWith("en");
      // Restore menu if a resumed free-chat session hid the smart buttons.
      if (
        !welcomeHasButtons &&
        (!bootParams.action || bootParams.action === "talk_to_assistant")
      ) {
        const menuActions =
          Array.isArray(data.actions) && data.actions.length
            ? data.actions
            : [
                {
                  id: "search_by_image",
                  label: useEn ? "Search by Image" : "بحث بالصورة",
                },
                {
                  id: "describe_looking_for",
                  label: useEn
                    ? "Describe What You're Looking For"
                    : "صف ما تبحث عنه",
                },
                {
                  id: "recommend_room",
                  label: useEn
                    ? "Recommend Lighting for My Room"
                    : "إضاءة مناسبة لغرفتي",
                },
                {
                  id: "chandeliers",
                  label: useEn ? "Chandeliers" : "ثريات",
                },
                { id: "fans", label: useEn ? "Fans" : "مراوح" },
                {
                  id: "outdoor_lighting",
                  label: useEn ? "Outdoor Lighting" : "إضاءة خارجية",
                },
                {
                  id: "installation_maintenance",
                  label: useEn
                    ? "Installation & Maintenance"
                    : "تركيب وصيانة",
                },
                {
                  id: "site_inspection",
                  label: useEn ? "Site Inspection" : "معاينة الموقع",
                },
                {
                  id: "delivery",
                  label: useEn ? "Delivery" : "التوصيل",
                },
                {
                  id: "talk_to_assistant",
                  label: useEn ? "Talk to the Assistant" : "تحدث مع المساعد",
                },
                {
                  id: "suggestions_feedback",
                  label: useEn
                    ? "Suggestions & Feedback"
                    : "اقتراحات وملاحظات",
                },
              ];
        nextMessages.push({
          id: `welcome_restore_${Date.now()}`,
          role: "assistant",
          type: "welcome",
          content: useEn
            ? "Pick from the menu or type your question:"
            : "اختر من القائمة أو اكتب استفسارك مباشرة:",
          actions: menuActions,
        });
      }

      setMessages(nextMessages);
      bumpStick(true);

      const action = bootParams.action;
      const onlyContinue =
        bootParams.continueChat &&
        (action === "talk_to_assistant" || !action);
      // Opening ENARTE AI must keep the welcome smart-action buttons.
      // Never auto-fire talk_to_assistant — that used to wipe the menu.
      if (action && !onlyContinue && action !== "talk_to_assistant") {
        pendingActionRef.current = action;
      } else {
        pendingActionRef.current = null;
      }
      clearBootActionFromUrl();
    } catch (err) {
      setError(err instanceof Error ? err.message : "network_error");
      setSupportOpen(true);
    } finally {
      setBooting(false);
    }
  }, [shop, locale, bumpStick, bootParams.action, bootParams.continueChat]);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (!sessionId || booting || busy || actionAppliedRef.current) return;
    const action = pendingActionRef.current;
    if (!action) return;
    actionAppliedRef.current = true;
    pendingActionRef.current = null;
    send({ actionId: action });
  }, [sessionId, booting, busy, send]);

  const onSupportSelect = useCallback(
    (action) => {
      setSupportOpen(false);
      if (!action) return;
      if (action.kind === "escalate") {
        send({ message: action.message, escalate: true });
        return;
      }
      if (action.kind === "action" && action.actionId) {
        send({ actionId: action.actionId });
      }
    },
    [send],
  );

  const teachSave = useCallback(
    async ({ messageId, question, answer, action }) => {
      if (!trainKey) return false;

      let resolvedQuestion = String(question || "").trim();
      if (!resolvedQuestion) {
        const idx = messages.findIndex((m) => m.id === messageId);
        for (let i = idx - 1; i >= 0; i -= 1) {
          if (messages[i]?.role === "user" && messages[i]?.content) {
            resolvedQuestion = String(messages[i].content).trim();
            break;
          }
        }
      }
      if (!resolvedQuestion) return false;

      const response = await fetch(enarteApiUrl("/api/assistant/teach"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Enarte-Train-Key": trainKey,
        },
        body: JSON.stringify({
          action,
          shop,
          locale,
          sessionId,
          messageId,
          question: resolvedQuestion,
          answer,
          trainKey,
        }),
      });
      const data = await readJson(response);
      if (!data?.ok) return false;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            content: answer,
            meta: {
              ...(m.meta || {}),
              needsTeach: false,
              taught: true,
              approvedLocal: true,
              teachable: true,
              question: resolvedQuestion,
              taughtAnswerId: data.answer?.id || m.meta?.taughtAnswerId || null,
            },
          };
        }),
      );
      bumpStick(true);
      return true;
    },
    [trainKey, shop, locale, sessionId, bumpStick, messages],
  );

  const onTeachApprove = useCallback(
    (payload) => teachSave({ ...payload, action: "approve" }),
    [teachSave],
  );
  const onTeachCorrect = useCallback(
    (payload) => teachSave({ ...payload, action: "correct" }),
    [teachSave],
  );
  const onTeachNew = useCallback(
    (payload) => teachSave({ ...payload, action: "teach" }),
    [teachSave],
  );

  const composerReady = Boolean(sessionId) && !booting;

  return (
    <div className="ea-shell" dir={dir} lang={locale}>
      <div className="ea-backdrop" aria-hidden="true" />
      <main className="ea-panel">
        <header className="ea-header">
          <div className="ea-header-row">
            <div>
              <p className="ea-brand">ENARTE</p>
              <h1 className="ea-title">AI Assistant</h1>
              <p className="ea-subtitle">
                {dir === "rtl"
                  ? "مستشار إضاءة ومبيعات"
                  : "Lighting sales consultant"}
              </p>
              {trainMode ? (
                <p className="ea-train-badge">
                  {dir === "rtl"
                    ? "وضع التدريب — ✓ اعتماد · ✎ تعديل"
                    : "Train mode — ✓ approve · ✎ edit"}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="ea-support-trigger"
              onClick={() => setSupportOpen(true)}
            >
              {getSupportTriggerLabel(locale)}
            </button>
          </div>
        </header>

        <div className="ea-chat">
          {booting && !messages.length ? (
            <AssistantSkeleton locale={locale} />
          ) : (
            <MessageList
              messages={messages}
              locale={locale}
              actionsDisabled={busy || booting}
              stickyScrollToken={stickToken}
              forceStickToken={forceStickToken}
              trainMode={trainMode}
              onTeachApprove={onTeachApprove}
              onTeachCorrect={onTeachCorrect}
              onTeachNew={onTeachNew}
              onAction={(action) => {
                if (String(action?.id || "").startsWith("choice:")) {
                  send({
                    actionId: action.id,
                    message: action.label || action.id,
                  });
                  return;
                }
                send({ actionId: action.id });
              }}
              onPhotoSelect={(image) =>
                send({
                  message:
                    dir === "rtl"
                      ? image.source === "camera"
                        ? "تم التقاط صورة"
                        : "تم رفع صورة"
                      : image.source === "camera"
                        ? "Photo captured"
                        : "Photo uploaded",
                  image,
                })
              }
              onSelectProduct={(card) =>
                send({
                  message: card.title,
                  selectedProduct: {
                    id: card.id,
                    title: card.title,
                    url: card.url,
                    image: card.image,
                    price: card.price,
                    currency: card.currency,
                  },
                })
              }
            />
          )}
          {busy && !booting ? <p className="ea-status">…</p> : null}
          {error ? (
            <p className="ea-error">{humanizeError(error, locale)}</p>
          ) : null}
        </div>

        <Composer
          value={draft}
          onChange={setDraft}
          locale={locale}
          photoKind={photoKind}
          disabled={!composerReady || busy}
          pickerEnabled={composerReady}
          placeholder={
            dir === "rtl" ? "اكتب رسالتك…" : "Type your message…"
          }
          onSubmit={() => send({ message: draft.trim() })}
          onPhotoSelect={(image) =>
            send({
              message:
                dir === "rtl"
                  ? image.source === "camera"
                    ? "تم التقاط صورة"
                    : "تم رفع صورة"
                  : image.source === "camera"
                    ? "Photo captured"
                    : "Photo uploaded",
              image: { ...image, photoKind: image.photoKind || photoKind },
            })
          }
        />

        <SupportSheet
          open={supportOpen}
          onClose={() => setSupportOpen(false)}
          onSelect={onSupportSelect}
          locale={locale}
        />
      </main>

      <style>{`
        .ea-shell {
          min-height: 100vh;
          min-height: 100dvh;
          position: relative;
          display: grid;
          place-items: center;
          padding: 1.25rem;
          font-family: "Sora", system-ui, sans-serif;
          color: #1c2d3a;
          background:
            radial-gradient(1200px 600px at 10% -10%, rgba(176, 141, 87, 0.18), transparent 55%),
            radial-gradient(900px 500px at 100% 0%, rgba(90, 122, 145, 0.16), transparent 50%),
            linear-gradient(180deg, #eef3f8 0%, #f7f1e8 48%, #e8eef4 100%);
        }
        .ea-backdrop {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(28,45,58,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(28,45,58,0.03) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: radial-gradient(circle at center, black 35%, transparent 80%);
          pointer-events: none;
        }
        .ea-panel {
          position: relative;
          width: min(100%, 44rem);
          height: min(92vh, 52rem);
          height: min(92dvh, 52rem);
          display: flex;
          flex-direction: column;
          border-radius: 1.5rem;
          overflow: hidden;
          background: rgba(247, 241, 232, 0.55);
          border: 1px solid rgba(28, 45, 58, 0.08);
          box-shadow: 0 24px 80px rgba(28, 45, 58, 0.12);
          backdrop-filter: blur(10px);
          animation: ea-rise 320ms ease both;
        }
        @keyframes ea-rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ea-header {
          padding: 1.1rem 1.15rem 0.9rem;
          border-bottom: 1px solid rgba(28, 45, 58, 0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.25));
          flex-shrink: 0;
        }
        .ea-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .ea-brand {
          margin: 0;
          font-family: "Syne", "Sora", sans-serif;
          font-weight: 800;
          letter-spacing: 0.14em;
          font-size: 0.78rem;
          color: #9a7340;
        }
        .ea-title {
          margin: 0.2rem 0 0;
          font-family: "Syne", "Sora", sans-serif;
          font-size: clamp(1.35rem, 3vw, 1.85rem);
          font-weight: 800;
          line-height: 1.1;
        }
        .ea-subtitle {
          margin: 0.35rem 0 0;
          color: rgba(28, 45, 58, 0.68);
          font-size: 0.9rem;
        }
        .ea-train-badge {
          margin: 0.45rem 0 0;
          display: inline-block;
          padding: 0.25rem 0.55rem;
          border-radius: 999px;
          background: rgba(154, 115, 64, 0.12);
          color: #9a7340;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .ea-support-trigger {
          appearance: none;
          flex-shrink: 0;
          border: 1px solid rgba(154, 115, 64, 0.35);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.85);
          color: #9a7340;
          font: inherit;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.45rem 0.75rem;
          cursor: pointer;
          white-space: nowrap;
        }
        .ea-chat {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .ea-chat .ea-messages {
          flex: 1;
        }
        .ea-status, .ea-error {
          margin: 0;
          padding: 0 1.1rem 0.75rem;
          font-size: 0.85rem;
        }
        .ea-error { color: #8a3b2d; }
        .ea-status { color: rgba(28, 45, 58, 0.55); }
        .ea-skeleton {
          flex: 1;
          padding: 1.25rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .ea-skeleton-line {
          height: 0.85rem;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(28,45,58,0.08), rgba(28,45,58,0.14), rgba(28,45,58,0.08));
          background-size: 200% 100%;
          animation: ea-shimmer 1.1s ease-in-out infinite;
          width: 78%;
        }
        .ea-skeleton-line--lg {
          height: 3.4rem;
          width: 100%;
          border-radius: 1rem;
        }
        .ea-skeleton-chips {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.55rem;
          margin-top: 0.35rem;
        }
        .ea-skeleton-chips span {
          height: 2.4rem;
          border-radius: 0.85rem;
          background: linear-gradient(90deg, rgba(28,45,58,0.06), rgba(28,45,58,0.12), rgba(28,45,58,0.06));
          background-size: 200% 100%;
          animation: ea-shimmer 1.1s ease-in-out infinite;
        }
        .ea-skeleton-hint {
          margin: 0.35rem 0 0;
          font-size: 0.82rem;
          color: rgba(28, 45, 58, 0.55);
        }
        @keyframes ea-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }

        @media (max-width: 720px) {
          .ea-shell {
            padding: 0;
            place-items: stretch;
            height: 100vh;
            height: 100dvh;
            min-height: 100dvh;
            overflow: hidden;
          }
          .ea-panel {
            width: 100%;
            height: 100%;
            min-height: 100dvh;
            max-height: none;
            border-radius: 0;
            border: 0;
            box-shadow: none;
            backdrop-filter: none;
            background: linear-gradient(180deg, #f7f1e8 0%, #eef3f8 100%);
          }
          .ea-header {
            padding: 0.85rem 0.9rem calc(0.75rem + env(safe-area-inset-top, 0px) * 0.15);
            padding-top: max(0.85rem, env(safe-area-inset-top, 0px));
          }
          .ea-title { font-size: 1.25rem; }
          .ea-subtitle { font-size: 0.82rem; }
          .ea-support-trigger {
            font-size: 0.68rem;
            padding: 0.4rem 0.65rem;
            max-width: 9.5rem;
            white-space: normal;
            text-align: center;
            line-height: 1.25;
          }
        }
      `}</style>
    </div>
  );
}
