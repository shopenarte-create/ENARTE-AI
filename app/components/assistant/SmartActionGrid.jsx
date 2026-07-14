/**
 * Smart action button grid — presentational only.
 * Action definitions come from the API / UX config, not hardcoded here.
 */

export default function SmartActionGrid({
  actions = [],
  onSelect,
  disabled = false,
  locale = "ar",
}) {
  if (!actions.length) return null;

  return (
    <div className="ea-actions" role="group" aria-label="Smart actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="ea-action"
          disabled={disabled}
          onClick={() => onSelect?.(action)}
        >
          <span className="ea-action-label">{action.label}</span>
        </button>
      ))}
      <style>{`
        .ea-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
          margin-top: 0.85rem;
        }
        @media (min-width: 720px) {
          .ea-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .ea-action {
          appearance: none;
          border: 1px solid rgba(28, 45, 58, 0.14);
          background: rgba(255, 255, 255, 0.72);
          color: #1c2d3a;
          border-radius: 0.85rem;
          padding: 0.85rem 0.95rem;
          text-align: start;
          font: inherit;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }
        .ea-action:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: rgba(176, 141, 87, 0.55);
          background: #fff;
        }
        .ea-action:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .ea-action-label {
          display: block;
          line-height: 1.35;
        }
      `}</style>
    </div>
  );
}
