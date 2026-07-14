/**
 * Explicit upload / capture chooser for assistant photo steps.
 * NEVER opens the camera on mount — only after the customer taps Capture.
 */

import { useRef } from "react";

export default function PhotoPrompt({
  photoKind = "room",
  locale = "ar",
  disabled = false,
  onSelect,
}) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");

  const labels =
    photoKind === "product"
      ? {
          upload: useEn ? "Upload product photo" : "رفع صورة المنتج",
          capture: useEn ? "Take product photo" : "التقاط صورة المنتج",
          hint: useEn
            ? "Choose how to add a photo — the camera opens only if you tap Capture."
            : "اختر طريقة إضافة الصورة — الكاميرا تُفتح فقط عند الضغط على التقاط.",
        }
      : {
          upload: useEn ? "Upload room photo" : "رفع صورة الغرفة",
          capture: useEn ? "Capture room photo" : "التقاط صورة الغرفة",
          hint: useEn
            ? "Choose how to add a room photo — the camera opens only if you tap Capture."
            : "اختر طريقة إضافة صورة الغرفة — الكاميرا تُفتح فقط عند الضغط على التقاط.",
        };

  const emitFile = (file, source) => {
    if (!file || disabled) return;
    const base = {
      name: file.name || `${photoKind}-${source}.jpg`,
      type: file.type || "image/jpeg",
      size: file.size || 0,
      source,
      photoKind,
    };
    const reader = new FileReader();
    reader.onload = () => {
      onSelect?.({
        ...base,
        dataUrl: typeof reader.result === "string" ? reader.result : null,
      });
    };
    reader.onerror = () => onSelect?.(base);
    reader.readAsDataURL(file);
  };

  return (
    <div className="ea-photo-prompt">
      <p className="ea-photo-hint">{labels.hint}</p>
      <div className="ea-photo-actions">
        <button
          type="button"
          className="ea-photo-btn ea-photo-btn--secondary"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
        >
          {labels.upload}
        </button>
        <button
          type="button"
          className="ea-photo-btn ea-photo-btn--primary"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          {labels.capture}
        </button>
      </div>
      {/* Gallery: never use capture attribute */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="ea-photo-input"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          emitFile(file, "upload");
        }}
      />
      {/* Camera: capture only after customer taps Capture */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="ea-photo-input"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          emitFile(file, "camera");
        }}
      />
      <style>{`
        .ea-photo-prompt {
          margin-top: 0.85rem;
          display: grid;
          gap: 0.65rem;
        }
        .ea-photo-hint {
          margin: 0;
          font-size: 0.82rem;
          line-height: 1.45;
          color: rgba(28, 45, 58, 0.68);
        }
        .ea-photo-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }
        .ea-photo-btn {
          appearance: none;
          border-radius: 999px;
          padding: 0.55rem 0.95rem;
          font: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
        }
        .ea-photo-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ea-photo-btn--primary {
          border: 0;
          background: #1c2d3a;
          color: #f7f1e8;
        }
        .ea-photo-btn--secondary {
          border: 1px solid rgba(28, 45, 58, 0.18);
          background: #fff;
          color: #1c2d3a;
        }
        .ea-photo-input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
