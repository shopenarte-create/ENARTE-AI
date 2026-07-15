/** Clean messy Shopify collection titles for mobile display. */
export function collectionLabel(title: string, handle?: string) {
  const raw = String(title || "").trim();
  const h = String(handle || "")
    .toLowerCase()
    .trim();

  const byHandle: Record<string, string> = {
    chandeliers: "ثريات",
    "garden-lights": "إنارة الحديقة",
    "led-lamp": "لمبات LED",
    "led-pendants": "تعليقات LED",
    "magnatic-led-brofil": "مسارات مغناطيسية",
    "magnetic-tracks": "مسارات مغناطيسية",
    "spot-lights": "سبوتات",
    spotlights: "سبوتات",
    "stands-table-lamps": "ستاندات وطاولات",
    stands: "ستاندات",
    "wall-lights": "إضاءة جدارية",
    "ceiling-lights": "إضاءة سقف",
    sconces: "أباليـك",
    outdoor: "خارجي",
    sale: "عروض",
    clearance: "تصفية",
  };

  if (byHandle[h]) return byHandle[h];

  const arabicChars = (raw.match(/[\u0600-\u06FF]/g) || []).length;
  if (arabicChars >= 2) return raw;

  const cleaned = raw
    .replace(/magnatic\s*&?\s*led\s*brofil/i, "مسارات مغناطيسية")
    .replace(/magnetic\s*3?\s*led\s*profile/i, "مسار مغناطيسي")
    .replace(/spot\s*lights?/i, "سبوتات")
    .replace(/stands?\s*&?\s*table\s*lamps?/i, "ستاندات وطاولات")
    .replace(/stands?/i, "ستاندات")
    .replace(/wall\s*lights?/i, "إضاءة جدارية")
    .replace(/garden\s*lights?/i, "إنارة الحديقة")
    .replace(/led\s*pendants?/i, "تعليقات LED")
    .replace(/led\s*lamp/i, "لمبات LED")
    .replace(/chandeliers?/i, "ثريات")
    .trim();

  if (cleaned && cleaned.length <= 24) return cleaned;
  return raw.length > 20 ? `${raw.slice(0, 18)}…` : raw || "قسم";
}

export function collectionEmoji(title: string, handle?: string) {
  const h = `${handle || ""} ${title || ""}`.toLowerCase();
  if (/chandelier|ثريا/.test(h)) return "💡";
  if (/spot|سبوت/.test(h)) return "🔆";
  if (/wall|sconce|أبليك|جدار/.test(h)) return "🕯️";
  if (/magnetic|magnatic|مسار|track|brofil|profil/.test(h)) return "🧲";
  if (/pendant|تعليق/.test(h)) return "✨";
  if (/lamp|لمب/.test(h)) return "🪔";
  if (/stand|ستاند|table/.test(h)) return "🛋️";
  if (/outdoor|garden|خارج|حديق/.test(h)) return "🌿";
  if (/sale|عرض|تصفي/.test(h)) return "🏷️";
  return "✨";
}
