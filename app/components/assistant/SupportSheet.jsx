/**
 * Support help sheet triggered by "هل تواجه مشكلة؟"
 */

import { getSupportActions, getSupportSheetTitle } from "./support-actions.js";

export default function SupportSheet({
  open = false,
  onClose,
  onSelect,
  locale = "ar",
}) {
  if (!open) return null;
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  const actions = getSupportActions(locale);

  return (
    <div className="ea-support-overlay" role="presentation" onClick={onClose}>
      <div
        className="ea-support-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={getSupportSheetTitle(locale)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ea-support-head">
          <h2 className="ea-support-title">{getSupportSheetTitle(locale)}</h2>
          <button
            type="button"
            className="ea-support-close"
            onClick={onClose}
            aria-label={useEn ? "Close" : "إغلاق"}
          >
            ×
          </button>
        </div>
        <ul className="ea-support-list">
          {actions.map((action) => (
            <li key={action.id}>
              {action.kind === "external" ? (
                <a
                  className="ea-support-item"
                  href={action.href}
                  target={action.id === "support_whatsapp" ? "_blank" : undefined}
                  rel={
                    action.id === "support_whatsapp"
                      ? "noreferrer noopener"
                      : undefined
                  }
                >
                  {action.label}
                </a>
              ) : (
                <button
                  type="button"
                  className="ea-support-item"
                  onClick={() => onSelect?.(action)}
                >
                  {action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        .ea-support-overlay {
          position: absolute;
          inset: 0;
          z-index: 40;
          background: rgba(28, 45, 58, 0.38);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: ea-support-fade 180ms ease both;
        }
        .ea-support-sheet {
          width: 100%;
          max-width: 44rem;
          border-radius: 1.25rem 1.25rem 0 0;
          background: #fbf7f0;
          border: 1px solid rgba(28, 45, 58, 0.1);
          box-shadow: 0 -16px 48px rgba(28, 45, 58, 0.18);
          padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
          animation: ea-support-rise 220ms ease both;
        }
        .ea-support-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .ea-support-title {
          margin: 0;
          font-family: "Syne", "Sora", sans-serif;
          font-size: 1.05rem;
          font-weight: 800;
          color: #1c2d3a;
        }
        .ea-support-close {
          appearance: none;
          border: 0;
          background: transparent;
          font-size: 1.5rem;
          line-height: 1;
          color: rgba(28, 45, 58, 0.55);
          cursor: pointer;
          padding: 0.15rem 0.35rem;
        }
        .ea-support-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.55rem;
        }
        .ea-support-item {
          display: block;
          width: 100%;
          text-align: inherit;
          appearance: none;
          border: 1px solid rgba(28, 45, 58, 0.12);
          border-radius: 0.9rem;
          background: #fff;
          color: #1c2d3a;
          font: inherit;
          font-weight: 650;
          padding: 0.9rem 1rem;
          text-decoration: none;
          cursor: pointer;
          transition: border-color 140ms ease, transform 140ms ease;
        }
        .ea-support-item:hover {
          border-color: rgba(154, 115, 64, 0.45);
          transform: translateY(-1px);
        }
        @keyframes ea-support-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ea-support-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
