import React, { useEffect, useMemo, useRef, useState } from "react";
import { BUDGET_OPTIONS } from "../services/budget.js";
import { resolveLightingType } from "../services/placement/lighting-types.js";
import { normalizeProductId } from "../services/placement/product-entry.js";
import { enarteApiUrl } from "../utils/enarte-api-base.js";
// Static import: lazy chunks break under Shopify App Proxy
// ("Failed to fetch dynamically imported module").
import LightingPositionPicker from "./LightingPositionPicker.jsx";

const GENERATING_PHASES = [
  "جاري رفع الصورة...",
  "جاري تنظيف السقف من الإنارة القديمة...",
  "جاري تركيب الثريا بشكل واقعي...",
  "جاري دمج الإضاءة والظلال...",
  "جاري إنهاء الصورة النهائية...",
];

const ANALYZE_PHASES = [
  "جاري رفع الصورة...",
  "جاري تحليل الغرفة...",
  "جاري مطابقة أفضل المنتجات...",
];

const PROGRESS_STEPS = [
  { id: "upload", label: "رفع الصورة" },
  { id: "analyze", label: "تحليل الغرفة" },
  { id: "ceiling", label: "اكتشاف السقف" },
  { id: "prepare", label: "تجهيز التركيب" },
  { id: "generate", label: "النتيجة النهائية" },
];

const STEPS = {
  HOME: "home",
  LOADING: "loading",
  PRODUCTS: "products",
  MARKERS: "markers",
  GENERATING: "generating",
  RESULT: "result",
};

const LIGHTING_ICONS = {
  chandelier: "💎",
  led_chandelier: "✨",
  spot_light: "🔲",
  wall_light: "🧱",
  enarte_decide: "🤖",
};

/** Shrink room photos before /api/place — App Proxy ~30s budget. */
async function compressRoomForPlace(file, maxSide = 1280, quality = 0.72) {
  if (!file) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    if (scale >= 0.98 && (file.size || 0) < 450_000) {
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
    if (!blob || blob.size >= (file.size || Infinity)) return file;
    return new File([blob], (file.name || "room").replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

function iconForProduct(product) {
  const resolved = resolveLightingType("enarte_decide", product || {});
  return LIGHTING_ICONS[resolved.id] || LIGHTING_ICONS.enarte_decide;
}

const btnPrimary = {
  padding: "14px 26px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #c4a35a 0%, #9a7b3c 100%)",
  color: "#1c1914",
  fontSize: "16px",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary = {
  padding: "14px 22px",
  borderRadius: "12px",
  border: "1px solid #b7c0cc",
  background: "#fff",
  color: "#1c2430",
  fontSize: "16px",
  fontWeight: 600,
  cursor: "pointer",
};

function ProductTryCard({ product, onTry }) {
  return (
    <div
      style={{
        border: "1px solid #d5dde8",
        borderRadius: "16px",
        overflow: "hidden",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        textAlign: "right",
        boxShadow: "0 10px 28px rgba(28, 36, 48, 0.08)",
      }}
    >
      {product.image ? (
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "200px",
            objectFit: "cover",
            display: "block",
            background: "#eef2f6",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "200px",
            background: "#eef2f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#7b8794",
          }}
        >
          لا توجد صورة
        </div>
      )}
      <div
        style={{
          padding: "14px 14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flex: 1,
        }}
      >
        <div
          style={{
            fontFamily: '"Syne", sans-serif',
            fontWeight: 700,
            fontSize: "16px",
            lineHeight: 1.35,
            color: "#1c2430",
          }}
        >
          {product.title}
        </div>
        <div style={{ color: "#4b5563", fontSize: "15px", fontWeight: 600 }}>
          {product.price != null
            ? `${product.price} ${product.currency || "JOD"}`
            : "السعر غير متوفر"}
        </div>
        <button
          type="button"
          onClick={() => onTry(product)}
          style={{ ...btnPrimary, width: "100%", marginTop: "auto" }}
        >
          ✨ جربها الآن
        </button>
        {product.url ? (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnSecondary,
              width: "100%",
              textAlign: "center",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            عرض المنتج
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ProgressRail({ activeIndex }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        width: "min(100%, 420px)",
        marginTop: "8px",
        direction: "rtl",
      }}
      aria-hidden="true"
    >
      {PROGRESS_STEPS.map((step, index) => {
        const done = index < activeIndex;
        const current = index === activeIndex;
        return (
          <div
            key={step.id}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "4px",
                borderRadius: "999px",
                background: done || current ? "#9a7b3c" : "#d7dee8",
                opacity: current ? 1 : done ? 0.85 : 0.55,
                transition: "background 240ms ease, opacity 240ms ease",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                color: current ? "#1c2430" : "#7b8794",
                fontWeight: current ? 700 : 500,
                textAlign: "center",
                lineHeight: 1.25,
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function normalizeLockedProduct(product) {
  if (!product) {
    return null;
  }
  const image = String(product.image || "").trim();
  return {
    ...product,
    id: normalizeProductId(product.id) || product.id,
    image: image.startsWith("//") ? `https:${image}` : image || null,
  };
}

/**
 * @param {{ entryMode?: 'main'|'product', lockedProduct?: object|null }} props
 */
export default function EnarteHomePage({
  entryMode = "main",
  lockedProduct = null,
  handoffId: handoffIdProp = null,
} = {}) {
  const fileInputRef = useRef(null);
  const bootstrappedRef = useRef(false);
  const imageUrlRef = useRef(null);
  const resultUrlRef = useRef(null);
  const placeAbortRef = useRef(null);
  const placeInFlightRef = useRef(false);
  const phaseTimerRef = useRef(null);
  const isProductEntry = entryMode === "product" && Boolean(lockedProduct);

  // Prefer loader prop (SSR-safe). Window search is only a client fallback.
  const initialHandoffId =
    handoffIdProp ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("handoff")
      : null);
  const hasHandoff = Boolean(initialHandoffId);

  const [step, setStep] = useState(() =>
    hasHandoff ? STEPS.LOADING : STEPS.HOME,
  );
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [budget, setBudget] = useState("");
  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState("");
  const [markers, setMarkers] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(() =>
    normalizeLockedProduct(lockedProduct),
  );
  const [placedImageUrl, setPlacedImageUrl] = useState("");
  const [placementError, setPlacementError] = useState("");
  const [loadingMessage, setLoadingMessage] = useState(() =>
    hasHandoff ? "جاري رفع الصورة..." : "",
  );
  const [loadingHint, setLoadingHint] = useState("");
  const [progressIndex, setProgressIndex] = useState(0);

  const markerIcon = useMemo(
    () => iconForProduct(selectedProduct),
    [selectedProduct],
  );

  const setPreviewUrl = (nextUrl) => {
    if (imageUrlRef.current && imageUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(imageUrlRef.current);
    }
    imageUrlRef.current = nextUrl;
    setImage(nextUrl);
  };

  const setResultUrl = (nextUrl) => {
    if (resultUrlRef.current && resultUrlRef.current.startsWith("blob:")) {
      URL.revokeObjectURL(resultUrlRef.current);
    }
    resultUrlRef.current = nextUrl;
    setPlacedImageUrl(nextUrl || "");
  };

  const clearPhaseTimer = () => {
    if (phaseTimerRef.current) {
      clearInterval(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  };

  const startGeneratingPhases = () => {
    clearPhaseTimer();
    let index = 0;
    setProgressIndex(0);
    setLoadingMessage(GENERATING_PHASES[0]);
    setLoadingHint("لا تغلق الصفحة — العملية تكمل تلقائياً");
    phaseTimerRef.current = setInterval(() => {
      index = Math.min(index + 1, GENERATING_PHASES.length - 1);
      setLoadingMessage(GENERATING_PHASES[index]);
      setProgressIndex(index);
    }, 4500);
  };

  const startAnalyzePhases = () => {
    clearPhaseTimer();
    let index = 0;
    setProgressIndex(0);
    setLoadingMessage(ANALYZE_PHASES[0]);
    setLoadingHint("لا تغلق الصفحة — نختار أفضل المنتجات لغرفتك");
    phaseTimerRef.current = setInterval(() => {
      index = Math.min(index + 1, ANALYZE_PHASES.length - 1);
      setLoadingMessage(ANALYZE_PHASES[index]);
      setProgressIndex(Math.min(index + 1, 2));
    }, 3200);
  };

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      fetch(enarteApiUrl("/api/try-handoff?id=ping"), { cache: "no-store" }).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 45000);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      clearPhaseTimer();
      if (placeAbortRef.current) placeAbortRef.current.abort();
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      if (resultUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(resultUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const srcImg = selectedProduct?.image;
    if (!srcImg) return;
    const img = new Image();
    img.decoding = "async";
    img.src = srcImg;
  }, [selectedProduct?.image]);

  const openCameraOrGallery = () => {
    fileInputRef.current?.click();
  };

  const runAnalysisAndRecommendations = async (file) => {
    setStep(STEPS.LOADING);
    startAnalyzePhases();
    setProducts([]);
    setProductsError("");
    setSelectedProduct(null);
    setPlacedImageUrl("");
    setPlacementError("");
    setMarkers([]);

    try {
      const analyzeForm = new FormData();
      analyzeForm.append("image", file);
      if (budget) {
        analyzeForm.append("budget", budget);
      }

      const analyzeResponse = await fetch(enarteApiUrl("/api/analyze"), {
        method: "POST",
        body: analyzeForm,
      });
      const analyzeText = await analyzeResponse.text();
      let analyzeData;
      try {
        analyzeData = JSON.parse(analyzeText);
      } catch {
        console.error("[enarte] analyze non-json", analyzeText?.slice?.(0, 200));
        setProductsError("تعذر قراءة نتيجة التحليل من الخادم");
        setStep(STEPS.PRODUCTS);
        return;
      }

      if (!analyzeData.success) {
        console.error("[enarte] analyze failed", analyzeData);
        setProductsError(analyzeData.error || "تعذر تحليل الصورة");
        setStep(STEPS.PRODUCTS);
        return;
      }

      setLoadingMessage("جاري مطابقة أفضل المنتجات...");
      setProgressIndex(2);

      const productsForm = new FormData();
      productsForm.append("analysis", analyzeData.result || "");
      if (budget) {
        productsForm.append("budget", budget);
      }
      const shopParam = new URLSearchParams(window.location.search).get("shop");
      if (shopParam) {
        productsForm.append("shop", shopParam);
      }

      const productsResponse = await fetch(enarteApiUrl("/api/products"), {
        method: "POST",
        body: productsForm,
      });
      const productsText = await productsResponse.text();
      let productsData;
      try {
        productsData = JSON.parse(productsText);
      } catch {
        console.error("[enarte] products non-json", productsText?.slice?.(0, 200));
        setProductsError("تعذر قراءة استجابة المنتجات");
        setStep(STEPS.PRODUCTS);
        return;
      }

      if (productsData.success) {
        const list = Array.isArray(productsData.products)
          ? productsData.products
          : [];
        setProducts(list);
        if (!list.length) {
          setProductsError("لم يتم العثور على منتجات مطابقة حالياً");
        }
      } else {
        console.error("[enarte] products failed", productsData);
        setProductsError(productsData.error || "تعذر جلب المنتجات");
      }

      setStep(STEPS.PRODUCTS);
    } catch (error) {
      console.error("[enarte] recommend flow failed", error);
      setProductsError(error.message || "حدث خطأ غير متوقع");
      setStep(STEPS.PRODUCTS);
    } finally {
      clearPhaseTimer();
      setLoadingHint("");
    }
  };


  const applyRoomFile = (file, productOverride = null) => {
    const previewUrl = URL.createObjectURL(file);
    setPreviewUrl(previewUrl);
    setImageFile(file);
    setMarkers([]);
    setPlacedImageUrl("");
    setPlacementError("");
    setLoadingHint("");

    if (isProductEntry || productOverride) {
      const product = normalizeLockedProduct(productOverride || lockedProduct);
      setSelectedProduct(product);
      setStep(STEPS.MARKERS);
      return;
    }

    runAnalysisAndRecommendations(file);
  };

  const resetToHome = () => {
    if (isProductEntry) {
      setPreviewUrl(null);
      setImageFile(null);
      setMarkers([]);
      setPlacedImageUrl("");
      setPlacementError("");
      setSelectedProduct(normalizeLockedProduct(lockedProduct));
      setStep(STEPS.HOME);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setStep(STEPS.HOME);
    setPreviewUrl(null);
    setImageFile(null);
    setBudget("");
    setProducts([]);
    setProductsError("");
    setMarkers([]);
    setSelectedProduct(null);
    setPlacedImageUrl("");
    setPlacementError("");
    setLoadingMessage("");
    setLoadingHint("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (bootstrappedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const handoffId = params.get("handoff");

    if (isProductEntry) {
      const product = normalizeLockedProduct(lockedProduct);
      setSelectedProduct(product);
    }

    if (!handoffId) {
      if (isProductEntry) {
        setStep(STEPS.HOME);
        const timer = setTimeout(() => {
          bootstrappedRef.current = true;
          fileInputRef.current?.click();
        }, 250);
        return () => clearTimeout(timer);
      }
      bootstrappedRef.current = true;
      return;
    }

    let cancelled = false;
    (async () => {
      setStep(STEPS.LOADING);
      setProgressIndex(0);
      setLoadingMessage("جاري رفع الصورة...");
      setLoadingHint("لا تغلق الصفحة — العملية تكمل تلقائياً");
      try {
        // Prefer product metadata saved with the handoff over URL query params
        // (query image URLs can be truncated / stale / placeholder).
        let handoffProduct = null;
        try {
          const metaResponse = await fetch(
            enarteApiUrl(`/api/try-handoff?id=${encodeURIComponent(handoffId)}`),
            { cache: "no-store" },
          );
          if (metaResponse.ok) {
            const metaJson = await metaResponse.json();
            if (metaJson?.product) {
              handoffProduct = normalizeLockedProduct(metaJson.product);
            }
          }
        } catch (metaError) {
          console.warn("[enarte] handoff meta fetch skipped", metaError);
        }

        const response = await fetch(
          enarteApiUrl(`/api/try-handoff?id=${encodeURIComponent(handoffId)}&raw=1`),
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!response.ok) {
          let message = "انتهت صلاحية صورة الغرفة — اختر صورة جديدة";
          try {
            const errJson = await response.json();
            message = errJson.error || message;
          } catch {
            /* ignore */
          }
          console.error("[enarte] handoff fetch failed", {
            status: response.status,
            handoffId,
          });
          bootstrappedRef.current = true;
          setPlacementError(message);
          setStep(STEPS.HOME);
          setLoadingHint("");
          return;
        }
        setLoadingMessage("جاري تحليل الغرفة...");
        setProgressIndex(1);
        const blob = await response.blob();
        if (cancelled) return;
        const mime =
          response.headers.get("content-type") || blob.type || "image/jpeg";
        const file = new File([blob], "room.jpg", { type: mime });
        bootstrappedRef.current = true;
        const productForApply = isProductEntry
          ? normalizeLockedProduct({
              ...(lockedProduct || {}),
              ...(handoffProduct || {}),
              image:
                handoffProduct?.image ||
                lockedProduct?.image ||
                null,
            })
          : null;
        if (productForApply) {
          setSelectedProduct(productForApply);
        }
        applyRoomFile(file, productForApply);
        setLoadingHint("");
      } catch (error) {
        console.error("[enarte] handoff bootstrap error", error);
        if (!cancelled) {
          bootstrappedRef.current = true;
          setPlacementError(error.message || "تعذر تحميل صورة الغرفة");
          setStep(STEPS.HOME);
          setLoadingHint("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProductEntry]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    applyRoomFile(file);
  };

  const generatePlacement = async (product, markerList) => {
    if (placeInFlightRef.current) return;
    if (!imageFile) {
      setPlacementError("صورة الغرفة مطلوبة");
      setStep(STEPS.RESULT);
      return;
    }
    if (!product?.image && !product?.id) {
      setPlacementError("المنتج المحدد غير صالح");
      setStep(isProductEntry ? STEPS.MARKERS : STEPS.PRODUCTS);
      return;
    }
    if (!markerList?.length) {
      setPlacementError("حدد مكان الإنارة أولاً");
      setStep(STEPS.MARKERS);
      return;
    }

    placeInFlightRef.current = true;
    if (placeAbortRef.current) placeAbortRef.current.abort();
    const abort = new AbortController();
    placeAbortRef.current = abort;

    setStep(STEPS.GENERATING);
    startGeneratingPhases();
    setPlacementError("");
    setResultUrl("");

    try {
      const placements = markerList.map((marker) => ({
        markerId: marker.id,
        x: marker.x,
        y: marker.y,
        lightingType: "enarte_decide",
        product: {
          id: product.id,
          title: product.title,
          image: product.image,
          collection: product.collection,
        },
      }));

      const formData = new FormData();
      const roomUpload = await compressRoomForPlace(imageFile);
      formData.append("roomImage", roomUpload);
      formData.append("placements", JSON.stringify(placements));
      formData.append("async", "1");

      // Async job: avoids Shopify App Proxy 30s cutoff that forced ugly Sharp paste.
      const startRes = await fetch(
        enarteApiUrl("/api/place?async=1&format=binary"),
        {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
          signal: abort.signal,
        },
      );
      if (abort.signal.aborted) return;

      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !startData.jobId) {
        const message =
          startData.error ||
          (startRes.status === 502 || startRes.status === 504
            ? "التوليد استغرق وقتاً أطول من اللازم — حاول مرة ثانية."
            : "تعذر بدء توليد صورة التركيب — أعد المحاولة");
        console.error("[enarte] place start failed", {
          status: startRes.status,
          data: startData,
        });
        setPlacementError(message);
        setStep(STEPS.RESULT);
        return;
      }

      const jobId = startData.jobId;
      const pollUrl = enarteApiUrl(
        `/api/place/status?id=${encodeURIComponent(jobId)}&format=binary`,
      );
      const deadline = Date.now() + 120_000;
      let resultBlob = null;

      while (Date.now() < deadline) {
        if (abort.signal.aborted) return;
        await new Promise((r) => setTimeout(r, 1800));
        if (abort.signal.aborted) return;

        const pollRes = await fetch(pollUrl, {
          method: "GET",
          headers: { Accept: "image/jpeg, application/json" },
          signal: abort.signal,
        });

        if (pollRes.status === 202) continue;

        if (pollRes.headers.get("X-Enarte-Success") === "1") {
          resultBlob = await pollRes.blob();
          break;
        }

        let message = "تعذر توليد صورة التركيب — أعد المحاولة";
        try {
          const errData = await pollRes.json();
          if (errData.error) message = errData.error;
        } catch {
          // ignore
        }
        setPlacementError(message);
        setStep(STEPS.RESULT);
        return;
      }

      if (!resultBlob) {
        setPlacementError(
          "استغرق التركيب وقتاً أطول من المتوقع — حاول مرة ثانية.",
        );
        setStep(STEPS.RESULT);
        return;
      }

      if (abort.signal.aborted) return;
      setResultUrl(URL.createObjectURL(resultBlob));
      setStep(STEPS.RESULT);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("[enarte] place exception", error);
      const raw = String(error?.message || "");
      const message = /failed to fetch|network|dynamically imported/i.test(raw)
        ? "تعذر الاتصال بخادم التركيب. تأكد من الاتصال وأعد المحاولة."
        : raw || "تعذر توليد صورة التركيب";
      setPlacementError(message);
      setStep(STEPS.RESULT);
    } finally {
      placeInFlightRef.current = false;
      clearPhaseTimer();
      setLoadingHint("");
    }
  };

  const handleTryNow = (product) => {
    setSelectedProduct(product);
    setPlacementError("");
    setPlacedImageUrl("");

    if (markers.length > 0) {
      generatePlacement(product, markers);
      return;
    }

    setStep(STEPS.MARKERS);
  };

  const handleConfirmMarkers = () => {
    if (!markers.length) {
      setPlacementError("حدد مكان الإنارة ثم اضغط تم");
      return;
    }
    const product =
      selectedProduct || normalizeLockedProduct(lockedProduct);
    if (!product?.image) {
      setPlacementError("المنتج المحدد غير صالح");
      if (!isProductEntry) {
        setStep(STEPS.PRODUCTS);
      }
      return;
    }
    generatePlacement(product, markers);
  };

  const handleClearMarkers = () => {
    setMarkers([]);
    setPlacementError("");
  };

  const handleTryAnotherProduct = () => {
    if (isProductEntry) {
      // Same product: new room photo, keep product locked
      setPlacedImageUrl("");
      setPlacementError("");
      setMarkers([]);
      setPreviewUrl(null);
      setImageFile(null);
      setStep(STEPS.HOME);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setPlacedImageUrl("");
    setPlacementError("");
    setSelectedProduct(null);
    setStep(STEPS.PRODUCTS);
  };

  const handleAddToCart = () => {
    const url = selectedProduct?.url || lockedProduct?.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setPlacementError("رابط المنتج غير متوفر حالياً");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(165deg, #eef3f8 0%, #e3eaf2 48%, #d7e0ea 100%)",
        fontFamily: '"Sora", "Segoe UI", sans-serif',
        color: "#1c2430",
        direction: "rtl",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "28px 20px 48px",
        }}
      >
        {step === STEPS.HOME && (
          <section
            style={{
              minHeight: "78vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              gap: "18px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: '"Syne", sans-serif',
                fontSize: "clamp(2.6rem, 9vw, 4rem)",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.02,
                color: "#1c2430",
              }}
            >
              ENARTE AI
            </p>

            {isProductEntry && selectedProduct && (
              <div
                style={{
                  width: "100%",
                  maxWidth: "280px",
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: "1px solid #d5dde8",
                  background: "#fff",
                  textAlign: "right",
                }}
              >
                {selectedProduct.image && (
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.title}
                    style={{
                      width: "100%",
                      height: "160px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
                <div style={{ padding: "12px" }}>
                  <div style={{ fontWeight: 700, fontSize: "15px" }}>
                    {selectedProduct.title}
                  </div>
                </div>
              </div>
            )}

            <p
              style={{
                margin: 0,
                maxWidth: "28rem",
                color: "#5b6573",
                fontSize: "1.05rem",
                lineHeight: 1.55,
              }}
            >
              {isProductEntry
                ? "التقط صورة غرفتك لتركيب هذه الإنارة مباشرة"
                : "شاهد الثريا في غرفتك خلال ثوانٍ"}
            </p>
            <p
              style={{
                margin: 0,
                maxWidth: "30rem",
                color: "#6b7280",
                fontSize: "0.95rem",
                lineHeight: 1.55,
                background: "rgba(255,255,255,0.72)",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px 14px",
              }}
            >
              يرجى التقاط صورة للغرفة بالكامل، وليس منطقة الثريا فقط، للحصول على
              أفضل نتائج التركيب.
            </p>
            {!isProductEntry && (
              <select
                id="budgetSelect"
                aria-label="الميزانية"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid #d5dde8",
                  background: "#fff",
                  color: "#1c2430",
                  fontSize: "15px",
                  fontFamily: "inherit",
                }}
              >
                <option value="">الميزانية (اختياري)</option>
                {BUDGET_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.labelAr}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={openCameraOrGallery}
              style={{
                ...btnPrimary,
                marginTop: "12px",
                padding: "16px 28px",
                fontSize: "1.1rem",
                boxShadow: "0 12px 28px rgba(154, 123, 60, 0.28)",
              }}
            >
              {isProductEntry ? "✨ اختر صورة الغرفة" : "✨ جربها في غرفتك"}
            </button>
            {placementError && (
              <p style={{ color: "#b42318", margin: 0 }}>{placementError}</p>
            )}
          </section>
        )}

        {(step === STEPS.LOADING || step === STEPS.GENERATING) && (
          <section
            style={{
              minHeight: "70vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              textAlign: "center",
            }}
          >
            {image && (
              <img
                src={image}
                alt="غرفتك"
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  borderRadius: "14px",
                  opacity: 0.9,
                  marginBottom: "8px",
                }}
              />
            )}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "3px solid #c5ced9",
                borderTopColor: "#9a7b3c",
                animation: "enarteSpin 0.8s linear infinite",
              }}
            />
            <p style={{ margin: 0, fontSize: "1.05rem", color: "#3d4654" }}>
              {loadingMessage}
            </p>
            {loadingHint ? (
              <p style={{ margin: 0, fontSize: "0.92rem", color: "#7b8794" }}>
                {loadingHint}
              </p>
            ) : null}
            <ProgressRail
              activeIndex={
                step === STEPS.GENERATING
                  ? progressIndex
                  : Math.min(progressIndex, 2)
              }
            />
            <style>{`@keyframes enarteSpin { to { transform: rotate(360deg); } }`}</style>
          </section>
        )}

        {step === STEPS.PRODUCTS && !isProductEntry && (
          <section>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                gap: "12px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: '"Syne", sans-serif',
                  fontSize: "1.55rem",
                  fontWeight: 700,
                }}
              >
                اقتراحات لك
              </h2>
              <button
                type="button"
                onClick={resetToHome}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#6b7280",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                صورة جديدة
              </button>
            </div>

            {image && (
              <img
                src={image}
                alt="غرفتك"
                style={{
                  width: "100%",
                  maxWidth: "560px",
                  display: "block",
                  margin: "0 auto 22px",
                  borderRadius: "14px",
                }}
              />
            )}

            {productsError && (
              <p style={{ color: "#b42318", textAlign: "center" }}>
                {productsError}
              </p>
            )}

            {products.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                {products.map((product) => (
                  <ProductTryCard
                    key={product.id}
                    product={product}
                    onTry={handleTryNow}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {step === STEPS.MARKERS && (
          <section style={{ textAlign: "center" }}>
            {isProductEntry && selectedProduct?.title && (
              <p style={{ margin: "0 0 8px", color: "#5b6573", fontSize: "14px" }}>
                تركيب: {selectedProduct.title}
              </p>
            )}
            <p
              style={{
                margin: "0 0 10px",
                fontFamily: '"Syne", sans-serif',
                fontSize: "1.2rem",
                fontWeight: 700,
                lineHeight: 1.45,
              }}
            >
              يرجى تحديد الموقع الدقيق الذي تريد تركيب الثريا فيه.
            </p>
            <p
              style={{
                margin: "0 0 18px",
                color: "#6b7280",
                fontSize: "0.95rem",
              }}
            >
              ثم اضغط تم
            </p>

            {image && (
              <LightingPositionPicker
                imageSrc={image}
                markers={markers}
                onChange={setMarkers}
                enabled
                markerIcon={markerIcon}
              />
            )}

            {placementError && (
              <p style={{ color: "#b42318", marginTop: "12px" }}>
                {placementError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "12px",
                marginTop: "20px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={handleConfirmMarkers}
                disabled={placeInFlightRef.current}
                style={btnPrimary}
              >
                ✅ تم
              </button>
              <button
                type="button"
                onClick={handleClearMarkers}
                disabled={!markers.length}
                style={{
                  ...btnSecondary,
                  opacity: markers.length ? 1 : 0.55,
                  cursor: markers.length ? "pointer" : "not-allowed",
                }}
              >
                🗑️ مسح النقاط
              </button>
            </div>
          </section>
        )}

        {step === STEPS.RESULT && (
          <section style={{ textAlign: "center" }}>
            <h2
              style={{
                margin: "0 0 16px",
                fontFamily: '"Syne", sans-serif',
                fontSize: "1.55rem",
                fontWeight: 700,
              }}
            >
              غرفتك بعد التركيب
            </h2>

            {placementError && (
              <p style={{ color: "#b42318" }}>{placementError}</p>
            )}

            {placedImageUrl && (
              <img
                src={placedImageUrl}
                alt="الغرفة بعد التركيب"
                style={{
                  width: "100%",
                  maxWidth: "560px",
                  borderRadius: "14px",
                  display: "block",
                  margin: "0 auto 22px",
                }}
              />
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!placedImageUrl}
                style={{
                  ...btnPrimary,
                  opacity: placedImageUrl ? 1 : 0.5,
                  cursor: placedImageUrl ? "pointer" : "not-allowed",
                }}
              >
                🛒 Add to Cart
              </button>
              <button
                type="button"
                onClick={handleTryAnotherProduct}
                style={btnSecondary}
              >
                {isProductEntry ? "🔄 صورة غرفة جديدة" : "🔄 Try Another Product"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
