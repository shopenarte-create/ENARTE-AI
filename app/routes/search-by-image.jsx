/**
 * /search-by-image — ENARTE Shopify visual/attribute search UI.
 * Vision extracts product traits → catalog rank; fingerprint matcher is fallback.
 */

import { useLoaderData } from "react-router";
import { useRef, useState } from "react";
import { enarteApiUrl } from "../utils/enarte-api-base.js";
import { warmCatalogFingerprints } from "../services/catalog/visual-match.server.js";

const SUPPORT_WHATSAPP = "00962792404023";
const SUPPORT_WHATSAPP_LINK = "https://wa.me/962792404023";
const SOURCING_MESSAGE =
  "سنحاول تأمين طلبك خلال ثلاثة أيام. يمكنك تأكيد الطلب عن طريق إرسال طلبك للرقم 00962792404023";

export const meta = () => [
  { title: "ابحث بالصورة | ENARTE" },
  {
    name: "description",
    content: "ابحث عن منتج ENARTE نفسه أو بديل مشابه من صورة",
  },
];

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop =
    url.searchParams.get("shop") ||
    process.env.ASSISTANT_DEFAULT_SHOP ||
    process.env.SHOP ||
    "";
  const locale = url.searchParams.get("locale") || "ar";
  // Warm fingerprint cache so the first search is fast.
  void warmCatalogFingerprints(shop || null);
  return { shop, locale };
}

function formatPrice(product) {
  if (product.price == null) return "";
  return `${product.price} ${product.currency || "JOD"}`;
}

/** Shrink phone photos before upload (keeps search under ~1s after warm cache). */
async function compressForSearch(file, maxSide = 960, quality = 0.82) {
  if (!file || !file.type?.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
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
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], (file.name || "query").replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

const btnPrimary = {
  width: "100%",
  border: "1.5px solid #b88e5f",
  background: "#f7f1e8",
  color: "#b88e5f",
  borderRadius: 10,
  padding: "0.85rem 1rem",
  fontWeight: 700,
  fontSize: "1rem",
  cursor: "pointer",
};

const btnCamera = {
  ...btnPrimary,
  background: "#b88e5f",
  color: "#fff",
};

export default function SearchByImageRoute() {
  const { shop } = useLoaderData();
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSourcing, setShowSourcing] = useState(false);
  const [sourcingNote, setSourcingNote] = useState(SOURCING_MESSAGE);
  const [products, setProducts] = useState([]);
  const [preview, setPreview] = useState("");

  async function runSearch(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    setShowSourcing(false);
    setSourcingNote(SOURCING_MESSAGE);
    setProducts([]);
    try {
      if (preview) {
        try {
          URL.revokeObjectURL(preview);
        } catch {
          // ignore
        }
      }
      setPreview(URL.createObjectURL(file));

      const compressed = await compressForSearch(file);
      const formData = new FormData();
      formData.append("image", compressed, compressed.name || "query.jpg");
      if (shop) formData.append("shop", shop);
      formData.append("locale", "ar");
      formData.append("limit", "8");

      const response = await fetch(enarteApiUrl("/api/catalog/image-search"), {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.message || data.error || "تعذر البحث");
      }
      const list = Array.isArray(data.products) ? data.products : [];
      setProducts(list);
      const offer =
        Boolean(data.showSourcingOffer) ||
        Boolean(data.unavailable) ||
        data.mode === "similar" ||
        !list.length;
      setShowSourcing(offer);
      if (data.sourcingMessage) setSourcingNote(data.sourcingMessage);
    } catch (err) {
      setError(err?.message || "تعذر البحث في الكتالوج");
    } finally {
      setBusy(false);
    }
  }

  function onFilePicked(event) {
    const file = event.target.files?.[0];
    runSearch(file);
    try {
      event.target.value = "";
    } catch {
      // ignore
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        margin: 0,
        fontFamily: '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif',
        background: "linear-gradient(180deg, #f7f1e8 0%, #eef3f8 100%)",
        color: "#1c2d3a",
        padding: "1.5rem 1rem 3rem",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            margin: 0,
            color: "#9a7b3c",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          ENARTE
        </p>
        <h1 style={{ margin: "0.35rem 0 0.5rem", fontSize: "1.65rem" }}>
          ابحث بالصورة
        </h1>
        <p
          style={{
            margin: "0 0 1.25rem",
            color: "rgba(28,45,58,0.7)",
            lineHeight: 1.55,
          }}
        >
          اختر صورة واضحة للمنتج نفسه أو منتج شبيه — نعرض فقط المطابق أو البديل من
          متجر ENARTE.
        </p>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "1.1rem",
            border: "1px solid rgba(28,45,58,0.08)",
            marginBottom: "1.25rem",
            display: "grid",
            gap: "0.75rem",
          }}
        >
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onFilePicked}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={onFilePicked}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
            style={{
              ...btnPrimary,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            🖼️ اختر من المعرض
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            style={{
              ...btnCamera,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            📷 التقاط صورة
          </button>

          {busy ? (
            <p style={{ margin: 0, textAlign: "center", color: "#6b7280" }}>
              جاري البحث...
            </p>
          ) : null}

          {preview ? (
            <img
              src={preview}
              alt="معاينة"
              style={{
                marginTop: 4,
                width: "100%",
                maxHeight: 220,
                objectFit: "cover",
                borderRadius: 12,
              }}
            />
          ) : null}
          {error ? (
            <p style={{ color: "#b42318", margin: 0 }}>{error}</p>
          ) : null}

          {showSourcing ? (
            <div
              style={{
                marginTop: 4,
                padding: "0.95rem 1rem",
                borderRadius: 12,
                background: "#f7f1e8",
                border: "1px solid rgba(184,142,95,0.35)",
                lineHeight: 1.65,
              }}
            >
              <p style={{ margin: 0, color: "#1c2d3a", fontWeight: 600 }}>
                {sourcingNote}
              </p>
              <a
                href={SUPPORT_WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  marginTop: "0.85rem",
                  padding: "0.65rem 1.1rem",
                  borderRadius: 10,
                  background: "#25D366",
                  color: "#fff",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                تواصل واتساب {SUPPORT_WHATSAPP}
              </a>
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          {products.map((product) => (
            <a
              key={product.id}
              href={product.url || "#"}
              style={{
                display: "grid",
                gridTemplateColumns: "96px 1fr",
                gap: "0.85rem",
                textDecoration: "none",
                color: "inherit",
                background: "#fff",
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(28,45,58,0.08)",
              }}
            >
              <img
                src={product.image}
                alt={product.title}
                style={{ width: 96, height: 96, objectFit: "cover" }}
              />
              <div
                style={{
                  padding: "0.7rem 0.7rem 0.7rem 0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <strong style={{ fontSize: "0.98rem", lineHeight: 1.35 }}>
                  {product.title}
                </strong>
                <span
                  style={{ marginTop: 4, color: "#9a7b3c", fontWeight: 700 }}
                >
                  {formatPrice(product)}
                </span>
                <span
                  style={{
                    marginTop: 4,
                    fontSize: "0.8rem",
                    color: "rgba(28,45,58,0.55)",
                  }}
                >
                  {product.matchReason}
                  {product.score != null
                    ? ` · ${(product.score * 100).toFixed(0)}%`
                    : ""}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
