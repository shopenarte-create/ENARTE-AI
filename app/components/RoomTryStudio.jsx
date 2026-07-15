import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUDGET_OPTIONS, DEFAULT_BUDGET_ID } from "../services/budget.js";
import { STYLE_OPTIONS } from "../services/virtual-try/types.js";
import { enarteApiUrl } from "../utils/enarte-api-base.js";

const COUNT_OPTIONS = [
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "3", label: "3" },
  { id: "4", label: "4" },
  { id: "5+", label: "5+" },
];

const STEPS = {
  SETUP: "setup",
  RUNNING: "running",
  CONFIRM: "confirm",
  RESULT: "result",
};

const PHASE_LABELS = {
  queued: "جاري التحضير...",
  analyzing: "جاري تحليل الغرفة...",
  preparing: "جاري تنظيف السقف من الإنارة القديمة...",
  installing: "جاري تركيب الثريات بواقعية...",
  done: "اكتملت الصورة",
  error: "حدث خطأ",
};

const gold = "#9a7b3c";
const ivory = "#f7f3ec";
const charcoal = "#1c1914";

const btnPrimary = {
  padding: "14px 26px",
  borderRadius: "12px",
  border: "none",
  background: `linear-gradient(135deg, #c4a35a 0%, ${gold} 100%)`,
  color: charcoal,
  fontSize: "16px",
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

const btnSecondary = {
  padding: "12px 20px",
  borderRadius: "12px",
  border: `1px solid ${gold}`,
  background: "transparent",
  color: charcoal,
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};

const chipBase = {
  padding: "10px 16px",
  borderRadius: "999px",
  border: "1px solid #ddd4c4",
  background: "#fff",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
  color: charcoal,
};

function chipActive(active) {
  return active
    ? {
        ...chipBase,
        border: `1px solid ${gold}`,
        background: "rgba(154, 123, 60, 0.12)",
        color: gold,
      }
    : chipBase;
}

async function compressRoom(file, maxSide = 1600, quality = 0.78) {
  if (!file) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    if (scale >= 0.98 && (file.size || 0) < 800_000) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    return new File([blob], (file.name || "room").replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function normalizeLockedProduct(product) {
  if (!product) return null;
  return {
    id: product.id || null,
    title: product.title || "",
    image: product.image || null,
    price: product.price ?? null,
    currency: product.currency || "JOD",
    url: product.url || null,
    collection: product.collection || null,
  };
}

/**
 * Brand-agnostic room try studio (automatic layout — no markers).
 */
export default function RoomTryStudio({
  entryMode = "main",
  lockedProduct = null,
  handoffId: handoffIdProp = null,
}) {
  const isProductEntry = entryMode === "product" && Boolean(lockedProduct);
  const fileRef = useRef(null);
  const pollRef = useRef(null);

  const initialHandoff =
    handoffIdProp ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("handoff")
      : null);

  const [step, setStep] = useState(
    initialHandoff ? STEPS.SETUP : STEPS.SETUP,
  );
  const [roomPreviewUrl, setRoomPreviewUrl] = useState(null);
  const [roomFile, setRoomFile] = useState(null);
  const [handoffId, setHandoffId] = useState(initialHandoff);
  const [product, setProduct] = useState(() =>
    normalizeLockedProduct(lockedProduct),
  );
  const [count, setCount] = useState("1");
  const [budget, setBudget] = useState(DEFAULT_BUDGET_ID);
  const [style, setStyle] = useState("");
  const [jobId, setJobId] = useState(null);
  const [phase, setPhase] = useState("queued");
  const [confirmInfo, setConfirmInfo] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [error, setError] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(Boolean(initialHandoff));

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  useEffect(() => {
    if (!initialHandoff) return undefined;
    let cancelled = false;

    (async () => {
      setBootstrapping(true);
      setError(null);
      try {
        const metaRes = await fetch(
          enarteApiUrl(`/api/try-handoff?id=${encodeURIComponent(initialHandoff)}`),
          { cache: "no-store" },
        );
        if (metaRes.ok) {
          const meta = await metaRes.json();
          if (!cancelled && meta?.product) {
            setProduct((prev) =>
              normalizeLockedProduct({ ...(prev || {}), ...meta.product }),
            );
          }
          if (!cancelled && meta?.imageDataUrl) {
            setRoomPreviewUrl(meta.imageDataUrl);
          }
        }

        const rawRes = await fetch(
          enarteApiUrl(
            `/api/try-handoff?id=${encodeURIComponent(initialHandoff)}&raw=1`,
          ),
          { cache: "no-store" },
        );
        if (!rawRes.ok) {
          throw new Error("تعذر تحميل صورة الغرفة");
        }
        const blob = await rawRes.blob();
        const file = new File([blob], "room.jpg", {
          type: blob.type || "image/jpeg",
        });
        if (cancelled) return;
        setRoomFile(file);
        setHandoffId(initialHandoff);
        const url = URL.createObjectURL(blob);
        setRoomPreviewUrl((prev) => prev || url);
        setStep(STEPS.SETUP);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "تعذر تجهيز صورة الغرفة");
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialHandoff]);

  const onPickFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    const compressed = await compressRoom(file);
    setRoomFile(compressed);
    setHandoffId(null);
    const url = URL.createObjectURL(compressed);
    setRoomPreviewUrl(url);
    setResultUrl(null);
    setStep(STEPS.SETUP);
  };

  const pollStatus = useCallback(
    (id) => {
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            enarteApiUrl(`/api/virtual-try/status?id=${encodeURIComponent(id)}`),
            { cache: "no-store" },
          );
          const data = await res.json();
          if (!data) return;

          setPhase(data.status || "queued");

          if (data.status === "needs_confirmation" || data.needsConfirmation) {
            stopPoll();
            setConfirmInfo({
              suggestedCount: data.layout?.suggestedCount,
              requestedCount: data.layout?.requestedCount,
              reason: data.layout?.suggestionReasonAr,
              analysis: data.analysis,
            });
            setStep(STEPS.CONFIRM);
            return;
          }

          if (data.status === "error" || (data.ok === false && data.error)) {
            stopPoll();
            setError(data.error || "تعذر توليد الصورة");
            setStep(STEPS.SETUP);
            return;
          }

          if (data.status === "done") {
            stopPoll();
            if (data.imageDataUrl) {
              setResultUrl(data.imageDataUrl);
            } else {
              const bin = await fetch(
                enarteApiUrl(
                  `/api/virtual-try/status?id=${encodeURIComponent(id)}&format=binary`,
                ),
                { cache: "no-store" },
              );
              const blob = await bin.blob();
              setResultUrl(URL.createObjectURL(blob));
            }
            setStep(STEPS.RESULT);
          }
        } catch (err) {
          console.warn("[room-try] poll", err);
        }
      }, 1800);
    },
    [stopPoll],
  );

  const startRun = async ({
    forceCount = false,
    acceptSuggestedCount = false,
    resumeJobId = null,
  } = {}) => {
    setError(null);
    setConfirmInfo(null);
    setResultUrl(null);
    setStep(STEPS.RUNNING);
    setPhase(resumeJobId ? "preparing" : "analyzing");

    try {
      const form = new FormData();
      if (resumeJobId) {
        form.set("jobId", resumeJobId);
        if (forceCount) form.set("forceCount", "1");
        if (acceptSuggestedCount) form.set("acceptSuggestedCount", "1");
      } else {
        if (handoffId) {
          form.set("handoffId", handoffId);
        } else if (roomFile) {
          form.set("roomImage", roomFile);
        } else {
          throw new Error("ارفع صورة الغرفة أولاً");
        }
        form.set("count", count);
        form.set("budget", budget);
        if (style) form.set("style", style);
        if (product) form.set("product", JSON.stringify(product));
        if (forceCount) form.set("forceCount", "1");
        if (acceptSuggestedCount) form.set("acceptSuggestedCount", "1");
      }

      const res = await fetch(enarteApiUrl("/api/virtual-try/run"), {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data?.jobId) {
        throw new Error(data?.error || "تعذر بدء التجربة");
      }
      setJobId(data.jobId);
      pollStatus(data.jobId);
    } catch (err) {
      setError(err?.message || "تعذر بدء التجربة");
      setStep(STEPS.SETUP);
    }
  };

  const phaseLabel = useMemo(
    () => PHASE_LABELS[phase] || "جاري المعالجة...",
    [phase],
  );

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: `linear-gradient(165deg, ${ivory} 0%, #efe8dc 55%, #e8dfd0 100%)`,
        color: charcoal,
        fontFamily:
          "Tahoma, 'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif",
        padding: "24px 16px 48px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ marginBottom: 20, textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              letterSpacing: "0.18em",
              fontSize: 12,
              color: gold,
              fontWeight: 700,
            }}
          >
            ENARTE
          </p>
          <h1 style={{ margin: "8px 0 6px", fontSize: 26, fontWeight: 800 }}>
            جرّبها بغرفتك
          </h1>
          <p style={{ margin: 0, color: "#6b6560", fontSize: 14, lineHeight: 1.6 }}>
            ارفع صورة الغرفة، اختر عدد الثريات، وسنركّبها تلقائياً بمواضع احترافية.
          </p>
        </header>

        {isProductEntry && product ? (
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: 12,
              borderRadius: 14,
              background: "#fff",
              border: "1px solid #e6ddd0",
              marginBottom: 16,
            }}
          >
            {product.image ? (
              <img
                src={product.image}
                alt=""
                style={{
                  width: 56,
                  height: 56,
                  objectFit: "cover",
                  borderRadius: 10,
                }}
              />
            ) : null}
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{product.title}</div>
              {product.price != null ? (
                <div style={{ color: gold, fontSize: 13, marginTop: 2 }}>
                  {product.price} {product.currency}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {bootstrapping ? (
          <p style={{ textAlign: "center", color: "#6b6560" }}>
            جاري تحميل صورة الغرفة...
          </p>
        ) : null}

        {error ? (
          <div
            style={{
              background: "#fdecea",
              color: "#8a1f11",
              padding: "12px 14px",
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {step === STEPS.SETUP || step === STEPS.RUNNING || step === STEPS.CONFIRM ? (
          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 16,
              border: "1px solid #e6ddd0",
              boxShadow: "0 10px 30px rgba(28,25,20,0.06)",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: 14,
                overflow: "hidden",
                background: "#ddd7cc",
                minHeight: 220,
                marginBottom: 16,
              }}
            >
              {roomPreviewUrl ? (
                <img
                  src={roomPreviewUrl}
                  alt="الغرفة"
                  style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "cover" }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: "100%",
                    minHeight: 220,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#6b6560",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  اضغط لرفع صورة الغرفة
                </button>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={onPickFile}
            />

            {roomPreviewUrl ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ ...btnSecondary, marginBottom: 18 }}
                disabled={step === STEPS.RUNNING}
              >
                تغيير الصورة
              </button>
            ) : null}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
                عدد الثريات
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {COUNT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={step === STEPS.RUNNING}
                    onClick={() => setCount(opt.id)}
                    style={chipActive(count === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
                الميزانية{" "}
                <span style={{ fontWeight: 400, color: "#8a847c" }}>(اختياري)</span>
              </div>
              <select
                value={budget}
                disabled={step === STEPS.RUNNING}
                onChange={(e) => setBudget(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd4c4",
                  background: "#fff",
                  fontSize: 14,
                }}
              >
                {BUDGET_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.labelAr}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
                نمط التصميم{" "}
                <span style={{ fontWeight: 400, color: "#8a847c" }}>(اختياري)</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id || "auto"}
                    type="button"
                    disabled={step === STEPS.RUNNING}
                    onClick={() => setStyle(opt.id)}
                    style={chipActive(style === opt.id)}
                  >
                    {opt.labelAr}
                  </button>
                ))}
              </div>
            </div>

            {step === STEPS.RUNNING ? (
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: `3px solid ${gold}`,
                    borderTopColor: "transparent",
                    margin: "0 auto 12px",
                    animation: "roomtry-spin 0.9s linear infinite",
                  }}
                />
                <p style={{ margin: 0, fontWeight: 600 }}>{phaseLabel}</p>
              </div>
            ) : step === STEPS.CONFIRM && confirmInfo ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: ivory,
                  border: `1px solid ${gold}`,
                  marginBottom: 12,
                }}
              >
                <p style={{ margin: "0 0 10px", fontWeight: 700 }}>
                  اقتراح توزيع أفضل
                </p>
                <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.6 }}>
                  {confirmInfo.reason ||
                    `الأنسب لهذه الغرفة ${confirmInfo.suggestedCount} ثريا/ثريات.`}
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    type="button"
                    style={btnPrimary}
                    onClick={() =>
                      startRun({
                        resumeJobId: jobId,
                        acceptSuggestedCount: true,
                      })
                    }
                  >
                    استخدام العدد المقترح ({confirmInfo.suggestedCount})
                  </button>
                  <button
                    type="button"
                    style={btnSecondary}
                    onClick={() =>
                      startRun({
                        resumeJobId: jobId,
                        forceCount: true,
                      })
                    }
                  >
                    المتابعة بعددي ({confirmInfo.requestedCount})
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                style={{
                  ...btnPrimary,
                  opacity: roomPreviewUrl ? 1 : 0.5,
                }}
                disabled={!roomPreviewUrl}
                onClick={() => startRun()}
              >
                جرّب الآن
              </button>
            )}
          </section>
        ) : null}

        {step === STEPS.RESULT && resultUrl ? (
          <section
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 16,
              border: "1px solid #e6ddd0",
            }}
          >
            <img
              src={resultUrl}
              alt="النتيجة"
              style={{ width: "100%", borderRadius: 14, display: "block" }}
            />
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              {product?.url ? (
                <a
                  href={product.url}
                  style={{
                    ...btnPrimary,
                    textAlign: "center",
                    textDecoration: "none",
                    display: "block",
                    boxSizing: "border-box",
                  }}
                >
                  شراء المنتج
                </a>
              ) : null}
              <button
                type="button"
                style={btnSecondary}
                onClick={() => {
                  setResultUrl(null);
                  setJobId(null);
                  setStep(STEPS.SETUP);
                }}
              >
                تجربة جديدة
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <style>{`
        @keyframes roomtry-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
