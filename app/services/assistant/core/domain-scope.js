/**
 * ENARTE storefront domain scope.
 *
 * The assistant is a lighting consultant for enarteshop.com only.
 * Product cards must come from that catalog; off-topic / off-site is refused.
 */

export const ENARTE_STOREFRONT_HOST = "enarteshop.com";

export const ENARTE_ALLOWED_PRODUCT_HOSTS = Object.freeze([
  "enarteshop.com",
  "www.enarteshop.com",
  "jb8xus-wn.myshopify.com",
]);

/** Lighting + store-service signals that keep a turn inside ENARTE. */
const IN_STORE_TOPIC =
  /enarte|اينارتي|إنارتي|enarteshop|ثريا|ثريات|نجفة|chandelier|مروحة|مراوح|fan|إضاءة|اضاءة|إنارة|انارة|lighting|light|lamp|لمبة|لمبات|بلب|ليد|led|سبوت|spot|تراك|track|بروفايل|profile|مغناطيس|magnetic|كشاف|ابجور|أبجور|ستاند|pendant|سقف|جدار|حديقة|حدائق|مدخل|كراج|واجهة|توصيل|تركيب|صيانة|معاينة|إرجاع|ترجيع|استبدال|ضمان|كتالوج|منتج|منتجات|غرفة|صالون|مجلس|delivery|install|maintenance|return|exchange|warranty|catalog|product/i;

/** Other-brand / off-site shopping — never recommend these. */
const OFF_SITE_BRAND =
  /amazon|أمازون|امازون|aliexpress|علي\s*اكسبرس|noon|نون\b|ikea|ايكيا|إيكيا|temu|shein|ebay|فيليبس(?!\s*enarte)|philips(?!\s*enarte)|osram|اورام|home\s*depot|لولو\s*هايبر|كارفور|carrefour/i;

/** Clear non-lighting / non-store topics. */
const OFF_TOPIC =
  /طقس|وصفة|طبخ|كرة\s*القدم|مباراة|رياضة|بيتكوين|bitcoin|crypto|برمجة|كود|بايثون|javascript|python|واجب|دراسة|سياسة|انتخابات|أسهم|بورصة|نكتة|فيلم|مسلسل|أغنية|فتوى|دواء|طبيب|مستشفى|سفر|طيارة|حجز\s*فندق|chatgpt|قصيدة|شعر|سيارة|سيارات|آيفون|ايفون|آيباد|لابتوب|موبايل|تلفون|ملابس|فساتين|كنبة|كنب|ثلاجة|غسالة|ذهب|عملات|homework|politics|recipe|weather|football|sports|programming/i;

function normalize(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isLightingStoreTopic(message = "") {
  return IN_STORE_TOPIC.test(normalize(message));
}

/**
 * True when the latest customer turn is outside ENARTE lighting / storefront.
 * Other-brand shopping is always off-store, even if they also said "منتج".
 */
export function isOffStoreTopic(message = "") {
  const text = normalize(message);
  if (!text) return false;
  if (OFF_SITE_BRAND.test(text)) return true;
  if (isLightingStoreTopic(text)) return false;
  return OFF_TOPIC.test(text);
}

export function isEnarteProductHost(hostname = "") {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return ENARTE_ALLOWED_PRODUCT_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export function isEnarteProductUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return isEnarteProductHost(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Rewrite catalog links onto the public storefront when possible.
 */
export function toEnarteStoreUrl(url = "", handle = "") {
  const raw = String(url || "").trim();
  const slug = String(handle || "").trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.includes("/products/")) {
        return `https://${ENARTE_STOREFRONT_HOST}${parsed.pathname}${parsed.search}`;
      }
      if (isEnarteProductHost(parsed.hostname)) return raw;
    } catch {
      // fall through
    }
  }
  if (slug) return `https://${ENARTE_STOREFRONT_HOST}/products/${slug}`;
  return raw;
}

/**
 * Keep only real ENARTE catalog cards and point URLs at enarteshop.com.
 */
export function filterEnarteCatalogCards(cards = []) {
  const list = Array.isArray(cards) ? cards : [];
  return Object.freeze(
    list
      .filter((card) => card?.id && (card.title || card.url))
      .map((card) => {
        const handle =
          card.handle ||
          String(card.url || "")
            .split("/products/")
            .pop()
            ?.split(/[?#]/)[0] ||
          "";
        const url = toEnarteStoreUrl(card.url, handle);
        if (url && !isEnarteProductUrl(url) && !handle) return null;
        return Object.freeze({
          ...card,
          url,
          handle: handle || card.handle || null,
        });
      })
      .filter(Boolean),
  );
}
