/**
 * Composer: text input + attach (+) menu (gallery / camera) + send.
 * Avoids overlapping icon buttons covering the message field on mobile RTL.
 */

import { useEffect, useRef, useState } from "react";

export default function Composer({
  value,
  onChange,
  onSubmit,
  onPhotoSelect,
  disabled = false,
  pickerEnabled = true,
  photoKind = "room",
  placeholder = "",
  locale = "ar",
}) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  const pickersDisabled = !pickerEnabled;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menuOpen]);

  const emitFile = (file, source) => {
    if (!file || (!pickerEnabled && disabled)) return;
    if (!pickerEnabled) return;
    setMenuOpen(false);
    const base = {
      name: file.name || `${photoKind || "room"}-${source}.jpg`,
      type: file.type || "image/jpeg",
      size: file.size || 0,
      source,
      photoKind: photoKind === "product" ? "product" : "room",
    };
    const reader = new FileReader();
    reader.onload = () => {
      onPhotoSelect?.({
        ...base,
        dataUrl: typeof reader.result === "string" ? reader.result : null,
      });
    };
    reader.onerror = () => onPhotoSelect?.(base);
    reader.readAsDataURL(file);
  };

  return (
    <form
      className="ea-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) onSubmit?.();
      }}
    >
      <div className="ea-composer-row" ref={menuRef}>
        <div className="ea-attach">
          <button
            type="button"
            className="ea-composer-plus"
            disabled={pickersDisabled}
            title={useEn ? "Attach photo" : "إرفاق صورة"}
            aria-label={useEn ? "Attach photo" : "إرفاق صورة"}
            aria-expanded={menuOpen}
            onClick={() => {
              if (!pickersDisabled) setMenuOpen((open) => !open);
            }}
          >
            +
          </button>
          {menuOpen ? (
            <div className="ea-attach-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="ea-attach-item"
                onClick={() => galleryRef.current?.click()}
              >
                {useEn ? "Choose from gallery" : "اختر من المعرض"}
              </button>
              <button
                type="button"
                role="menuitem"
                className="ea-attach-item"
                onClick={() => cameraRef.current?.click()}
              >
                {useEn ? "Take a photo" : "التقاط صورة"}
              </button>
            </div>
          ) : null}
        </div>

        <input
          className="ea-composer-input"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Message"
        />

        <button
          className="ea-composer-send"
          type="submit"
          disabled={disabled || !value.trim()}
        >
          {useEn ? "Send" : "إرسال"}
        </button>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="ea-composer-file"
        tabIndex={-1}
        aria-hidden="true"
        disabled={pickersDisabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          emitFile(file, "upload");
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="ea-composer-file"
        tabIndex={-1}
        aria-hidden="true"
        disabled={pickersDisabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          emitFile(file, "camera");
        }}
      />

      <style>{`
        .ea-composer {
          position: relative;
          padding: 0.75rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid rgba(28, 45, 58, 0.08);
          background: rgba(255, 255, 255, 0.92);
        }
        .ea-composer-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 0.5rem;
          align-items: center;
        }
        .ea-attach {
          position: relative;
          flex-shrink: 0;
        }
        .ea-composer-plus {
          appearance: none;
          border: 1.5px solid #b88e5f;
          border-radius: 999px;
          width: 2.55rem;
          height: 2.55rem;
          display: grid;
          place-items: center;
          background: #f7f1e8;
          color: #b88e5f;
          font-size: 1.45rem;
          font-weight: 600;
          line-height: 1;
          cursor: pointer;
        }
        .ea-composer-plus:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ea-attach-menu {
          position: absolute;
          bottom: calc(100% + 0.45rem);
          inset-inline-start: 0;
          min-width: 11.5rem;
          display: grid;
          gap: 0.25rem;
          padding: 0.4rem;
          border-radius: 12px;
          background: #fff;
          border: 1px solid rgba(28, 45, 58, 0.12);
          box-shadow: 0 10px 28px rgba(28, 45, 58, 0.12);
          z-index: 30;
        }
        .ea-attach-item {
          appearance: none;
          border: 0;
          background: transparent;
          text-align: start;
          padding: 0.7rem 0.75rem;
          border-radius: 8px;
          font: inherit;
          font-weight: 600;
          color: #1c2d3a;
          cursor: pointer;
          white-space: nowrap;
        }
        .ea-attach-item:hover {
          background: #f7f1e8;
          color: #9a7340;
        }
        .ea-composer-input {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(28, 45, 58, 0.14);
          border-radius: 999px;
          padding: 0.75rem 1rem;
          font: inherit;
          background: #fff;
          color: #1c2d3a;
        }
        .ea-composer-input:focus {
          outline: 2px solid rgba(176, 141, 87, 0.35);
          border-color: rgba(176, 141, 87, 0.55);
        }
        .ea-composer-send {
          appearance: none;
          border: 0;
          border-radius: 999px;
          padding: 0.7rem 1rem;
          background: #1c2d3a;
          color: #f7f1e8;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .ea-composer-send:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ea-composer-file {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </form>
  );
}
