import fs from "fs";

const path = "app/components/EnarteHomePage.jsx";
let src = fs.readFileSync(path, "utf8");

const start = src.indexOf("  const fileInputRef = useRef(null);");
const end = src.indexOf("  const handleTryNow = (product) => {");
if (start < 0 || end < 0) {
  throw new Error(`markers not found ${start} ${end}`);
}

const runStart = src.indexOf(
  "  const runAnalysisAndRecommendations = async (file) => {",
);
const applyStart = src.indexOf(
  "  const applyRoomFile = (file, productOverride = null) => {",
);
const runAnalysis = src.slice(runStart, applyStart);

const replacement = `  const fileInputRef = useRef(null);
  const bootstrappedRef = useRef(false);
  const imageUrlRef = useRef(null);
  const placeAbortRef = useRef(null);
  const placeInFlightRef = useRef(false);
  const phaseTimerRef = useRef(null);
  const isProductEntry = entryMode === "product" && Boolean(lockedProduct);

  const hasHandoff =
    typeof window !== "undefined" &&
    Boolean(new URLSearchParams(window.location.search).get("handoff"));

  const [step, setStep] = useState(() =>
    isProductEntry && hasHandoff ? STEPS.LOADING : STEPS.HOME,
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
    isProductEntry && hasHandoff ? "جاري تحميل صورة غرفتك..." : "",
  );
  const [loadingHint, setLoadingHint] = useState("");

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

  const clearPhaseTimer = () => {
    if (phaseTimerRef.current) {
      clearInterval(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  };

  const startGeneratingPhases = () => {
    clearPhaseTimer();
    let index = 0;
    setLoadingMessage(GENERATING_PHASES[0]);
    setLoadingHint("لا تغلق الصفحة — العملية تكمل تلقائياً");
    phaseTimerRef.current = setInterval(() => {
      index = Math.min(index + 1, GENERATING_PHASES.length - 1);
      setLoadingMessage(GENERATING_PHASES[index]);
    }, 9000);
  };

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      fetch("/api/try-handoff?id=ping", { cache: "no-store" }).catch(() => {});
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

${runAnalysis}
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
    if (bootstrappedRef.current || !isProductEntry) return;

    const product = normalizeLockedProduct(lockedProduct);
    setSelectedProduct(product);

    const params = new URLSearchParams(window.location.search);
    const handoffId = params.get("handoff");

    if (!handoffId) {
      setStep(STEPS.HOME);
      const timer = setTimeout(() => {
        bootstrappedRef.current = true;
        fileInputRef.current?.click();
      }, 250);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    (async () => {
      setStep(STEPS.LOADING);
      setLoadingMessage("جاري تحميل صورة غرفتك...");
      setLoadingHint("لا تغلق الصفحة — العملية تكمل تلقائياً");
      try {
        const response = await fetch(
          \`/api/try-handoff?id=\${encodeURIComponent(handoffId)}&raw=1\`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!response.ok) {
          bootstrappedRef.current = true;
          setPlacementError("انتهت صلاحية صورة الغرفة — اختر صورة جديدة");
          setStep(STEPS.HOME);
          setLoadingHint("");
          return;
        }
        const blob = await response.blob();
        if (cancelled) return;
        const mime =
          response.headers.get("content-type") || blob.type || "image/jpeg";
        const file = new File([blob], "room.jpg", { type: mime });
        bootstrappedRef.current = true;
        applyRoomFile(file, product);
        setLoadingHint("");
      } catch (error) {
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
    if (!product?.image) {
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
    setPlacedImageUrl("");

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
      formData.append("roomImage", imageFile);
      formData.append("placements", JSON.stringify(placements));

      const response = await fetch("/api/place", {
        method: "POST",
        body: formData,
        signal: abort.signal,
      });
      const data = await response.json();
      if (abort.signal.aborted) return;

      if (!data.success) {
        setPlacementError(data.error || "تعذر توليد صورة التركيب");
        setStep(STEPS.RESULT);
        return;
      }

      setPlacedImageUrl(data.imageDataUrl);
      setStep(STEPS.RESULT);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setPlacementError(error.message || "تعذر توليد صورة التركيب");
      setStep(STEPS.RESULT);
    } finally {
      placeInFlightRef.current = false;
      clearPhaseTimer();
      setLoadingHint("");
    }
  };

`;

src = src.slice(0, start) + replacement + src.slice(end);

src = src.replace(
  `            <p style={{ margin: 0, fontSize: "1.05rem", color: "#3d4654" }}>
              {loadingMessage}
            </p>
            <style>{\`@keyframes enarteSpin { to { transform: rotate(360deg); } }\`}</style>`,
  `            <p style={{ margin: 0, fontSize: "1.05rem", color: "#3d4654" }}>
              {loadingMessage}
            </p>
            {loadingHint ? (
              <p style={{ margin: 0, fontSize: "0.92rem", color: "#7b8794" }}>
                {loadingHint}
              </p>
            ) : null}
            <style>{\`@keyframes enarteSpin { to { transform: rotate(360deg); } }\`}</style>`,
);

src = src.replace(
  `<button type="button" onClick={handleConfirmMarkers} style={btnPrimary}>
                ✅ تم
              </button>`,
  `<button
                type="button"
                onClick={handleConfirmMarkers}
                disabled={placeInFlightRef.current}
                style={btnPrimary}
              >
                ✅ تم
              </button>`,
);

fs.writeFileSync(path, src);
console.log("OK", src.length);
