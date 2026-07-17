/**
 * Train-mode controls on an assistant bubble:
 * ✓ approve current answer · ✎ edit then approve · teach when empty
 */

import { useState } from "react";

export default function TeachControls({
  message,
  locale = "ar",
  disabled = false,
  onApprove,
  onCorrect,
  onTeach,
}) {
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  const [editing, setEditing] = useState(Boolean(message?.meta?.needsTeach));
  const [draft, setDraft] = useState(
    message?.meta?.needsTeach ? "" : String(message?.content || ""),
  );
  const [status, setStatus] = useState(null); // approved | saving | error | temp
  const [busy, setBusy] = useState(false);

  if (!message || message.role !== "assistant") return null;
  if (message.meta?.approvedLocal) {
    const temp = message.meta?.persisted === false;
    return (
      <p
        className={`ea-teach-status ${temp ? "ea-teach-status--err" : "ea-teach-status--ok"}`}
      >
        {temp
          ? useEn
            ? "Saved temporarily only — not on mobile yet."
            : "حُفظ مؤقتاً فقط — لسا ما وصل للموبايل."
          : useEn
            ? "Approved — saved on server for all devices."
            : "مُعتمد — محفوظ على السيرفر لكل الأجهزة."}
      </p>
    );
  }

  const question = message.meta?.question || "";
  const needsTeach = Boolean(message.meta?.needsTeach) && !String(message.content || "").trim();

  const save = async (kind, answerOverride) => {
    const answer = String(
      answerOverride != null ? answerOverride : draft || "",
    ).trim();
    if (!answer) {
      setStatus("error");
      return;
    }
    setBusy(true);
    setStatus("saving");
    try {
      const fn =
        kind === "teach" ? onTeach : kind === "correct" ? onCorrect : onApprove;
      const result = await fn?.({
        messageId: message.id,
        question,
        answer,
        originalAnswer: message.content || "",
      });
      const ok = result === true || result?.ok === true;
      if (ok) {
        setStatus(result?.persisted === false ? "temp" : "approved");
        setEditing(false);
        setDraft(answer);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ea-teach" dir={useEn ? "ltr" : "rtl"}>
      {needsTeach && !editing ? (
        <button
          type="button"
          className="ea-teach-open"
          disabled={disabled || busy}
          onClick={() => {
            setEditing(true);
            setDraft("");
          }}
        >
          {useEn ? "No answer — teach one" : "ما في جواب — علّمني الجواب"}
        </button>
      ) : null}

      {editing ? (
        <div className="ea-teach-editor">
          <label className="ea-teach-label" htmlFor={`teach-${message.id}`}>
            {needsTeach
              ? useEn
                ? "Write the correct answer:"
                : "اكتب الجواب الصحيح:"
              : useEn
                ? "Edit the answer:"
                : "عدّل الجواب:"}
          </label>
          <textarea
            id={`teach-${message.id}`}
            className="ea-teach-textarea"
            rows={4}
            value={draft}
            disabled={disabled || busy}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              useEn ? "Correct answer for this question…" : "الجواب الصحيح لهذا السؤال…"
            }
          />
          <div className="ea-teach-row">
            <button
              type="button"
              className="ea-teach-btn ea-teach-btn--ok"
              disabled={disabled || busy || !draft.trim()}
              onClick={() => save(needsTeach ? "teach" : "correct")}
              title={useEn ? "Approve this answer" : "اعتماد هذا الجواب"}
            >
              ✓ {useEn ? "Approve" : "اعتماد"}
            </button>
            {!needsTeach ? (
              <button
                type="button"
                className="ea-teach-btn"
                disabled={disabled || busy}
                onClick={() => {
                  setEditing(false);
                  setDraft(String(message.content || ""));
                  setStatus(null);
                }}
              >
                {useEn ? "Cancel" : "إلغاء"}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="ea-teach-row">
          <button
            type="button"
            className="ea-teach-btn ea-teach-btn--ok"
            disabled={disabled || busy || !String(message.content || "").trim()}
            onClick={() => save("approve", message.content)}
            title={useEn ? "Approve — always use this answer" : "صح — اعتمد الجواب دائماً"}
          >
            ✓
          </button>
          <button
            type="button"
            className="ea-teach-btn"
            disabled={disabled || busy}
            onClick={() => {
              setEditing(true);
              setDraft(String(message.content || ""));
            }}
            title={useEn ? "Edit answer" : "تعديل الجواب"}
          >
            ✎
          </button>
        </div>
      )}

      {status === "saving" ? (
        <p className="ea-teach-status">{useEn ? "Saving…" : "جاري الحفظ…"}</p>
      ) : null}
      {status === "approved" ? (
        <p className="ea-teach-status ea-teach-status--ok">
          {useEn
            ? "Approved — saved on server for all devices."
            : "مُعتمد — محفوظ على السيرفر لكل الأجهزة."}
        </p>
      ) : null}
      {status === "temp" ? (
        <p className="ea-teach-status ea-teach-status--err">
          {useEn
            ? "Saved temporarily only — not shared to mobile yet."
            : "حُفظ مؤقتاً فقط — لسا ما وصل للموبايل."}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="ea-teach-status ea-teach-status--err">
          {useEn ? "Could not save. Check train key / answer." : "تعذر الحفظ. تحقق من مفتاح التدريب أو الجواب."}
        </p>
      ) : null}

      <style>{`
        .ea-teach {
          margin-top: 0.65rem;
          padding-top: 0.55rem;
          border-top: 1px dashed rgba(28, 45, 58, 0.12);
        }
        .ea-teach-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
        }
        .ea-teach-btn {
          appearance: none;
          border: 1px solid rgba(28, 45, 58, 0.14);
          background: #fff;
          color: #1c2d3a;
          border-radius: 999px;
          width: 2.1rem;
          height: 2.1rem;
          font: inherit;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 0.65rem;
          min-width: 2.1rem;
        }
        .ea-teach-btn--ok {
          background: #1c2d3a;
          color: #f7f1e8;
          border-color: #1c2d3a;
          width: auto;
          gap: 0.25rem;
        }
        .ea-teach-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ea-teach-open {
          appearance: none;
          border: 1px dashed rgba(154, 115, 64, 0.5);
          background: rgba(154, 115, 64, 0.08);
          color: #9a7340;
          border-radius: 0.7rem;
          padding: 0.45rem 0.7rem;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          text-align: start;
        }
        .ea-teach-editor {
          display: grid;
          gap: 0.45rem;
        }
        .ea-teach-label {
          font-size: 0.78rem;
          font-weight: 700;
          color: rgba(28, 45, 58, 0.72);
        }
        .ea-teach-textarea {
          width: 100%;
          resize: vertical;
          min-height: 5rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(28, 45, 58, 0.16);
          padding: 0.65rem 0.75rem;
          font: inherit;
          font-size: 0.9rem;
          line-height: 1.45;
          background: #fff;
          color: #1c2d3a;
        }
        .ea-teach-status {
          margin: 0.35rem 0 0;
          font-size: 0.75rem;
          color: rgba(28, 45, 58, 0.6);
        }
        .ea-teach-status--ok { color: #2f6b4f; font-weight: 700; }
        .ea-teach-status--err { color: #8a3b2d; }
      `}</style>
    </div>
  );
}
