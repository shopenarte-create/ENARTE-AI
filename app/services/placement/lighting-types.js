/**
 * Lighting type choices for virtual placement (Phase 6).
 * Kept separate from recommendation/marker cores.
 *
 * mountStyle + hangDropPercent drive canopy-vs-body geometry:
 * the tap/mount point is always the ceiling canopy; the body hangs below.
 */

export const MOUNT_STYLES = Object.freeze({
  FLUSH: "flush",
  SHORT_PENDANT: "short_pendant",
  LONG_PENDANT: "long_pendant",
  SPOT: "spot",
  WALL: "wall",
});

export const LIGHTING_TYPES = Object.freeze([
  {
    id: "chandelier",
    labelEn: "Chandelier",
    labelAr: "ثريا",
    hangFromCeiling: true,
    mountStyle: MOUNT_STYLES.SHORT_PENDANT,
    /** Image-% below canopy where the fixture body should sit */
    hangDropPercent: 7.2,
    /** Width as fraction of room image width before perspective */
    baseWidthRatio: 0.14,
    /** Sharp fallback: 0 = top of product bitmap at canopy */
    anchorY: 0,
  },
  {
    id: "led_chandelier",
    labelEn: "LED Chandelier",
    labelAr: "ثريا LED",
    hangFromCeiling: true,
    mountStyle: MOUNT_STYLES.SHORT_PENDANT,
    hangDropPercent: 5.8,
    baseWidthRatio: 0.13,
    anchorY: 0,
  },
  {
    id: "spot_light",
    labelEn: "Spot Light",
    labelAr: "سبوت لايت",
    hangFromCeiling: true,
    mountStyle: MOUNT_STYLES.SPOT,
    hangDropPercent: 1.2,
    baseWidthRatio: 0.08,
    anchorY: 0.08,
  },
  {
    id: "wall_light",
    labelEn: "Wall Light",
    labelAr: "إضاءة جدارية",
    hangFromCeiling: false,
    mountStyle: MOUNT_STYLES.WALL,
    hangDropPercent: 0,
    baseWidthRatio: 0.1,
    anchorY: 0.5,
  },
  {
    id: "enarte_decide",
    labelEn: "Let ENARTE Decide",
    labelAr: "دع ENARTE تقرر",
    hangFromCeiling: true,
    mountStyle: MOUNT_STYLES.SHORT_PENDANT,
    hangDropPercent: 5,
    baseWidthRatio: 0.12,
    anchorY: 0,
  },
]);

const FLUSH_KEYWORDS = [
  "flush",
  "semi-flush",
  "semiflush",
  "semi flush",
  "close to ceiling",
  "ceiling mount",
  "flush-mount",
  "flushmount",
  "ملتصق",
  "شبه ملتصق",
  "قريبة من السقف",
];

const LONG_PENDANT_KEYWORDS = [
  "long pendant",
  "long drop",
  "long chain",
  "cascade",
  "cascading",
  "multi-tier",
  "multitier",
  "multi tier",
  "linear pendant",
  "طويلة",
  "سلسلة طويلة",
  "متدلية طويلة",
];

const SHORT_PENDANT_KEYWORDS = [
  "short pendant",
  "mini pendant",
  "pendant",
  "drop",
  "hanging",
  "معلقة",
  "متدلية",
  "بندنت",
];

function includesAny(blob, keywords) {
  return keywords.some((keyword) => blob.includes(keyword));
}

/**
 * Infer flush / short / long hang style from product text.
 */
export function inferMountStyle(product = {}, lightingTypeId = "chandelier") {
  if (lightingTypeId === "wall_light") {
    return MOUNT_STYLES.WALL;
  }
  if (lightingTypeId === "spot_light") {
    return MOUNT_STYLES.SPOT;
  }

  const blob = `${product.title || ""} ${product.collection || ""} ${product.type || ""}`
    .toLowerCase()
    .trim();

  if (includesAny(blob, FLUSH_KEYWORDS)) {
    return MOUNT_STYLES.FLUSH;
  }
  if (includesAny(blob, LONG_PENDANT_KEYWORDS)) {
    return MOUNT_STYLES.LONG_PENDANT;
  }
  if (includesAny(blob, SHORT_PENDANT_KEYWORDS)) {
    return MOUNT_STYLES.SHORT_PENDANT;
  }

  // LED fixtures are often closer to the ceiling than crystal chandeliers
  if (lightingTypeId === "led_chandelier" || blob.includes("led")) {
    return MOUNT_STYLES.SHORT_PENDANT;
  }

  return MOUNT_STYLES.SHORT_PENDANT;
}

/**
 * Hang drop (image % below canopy) by mount style.
 */
export function hangDropPercentForMountStyle(mountStyle) {
  switch (mountStyle) {
    case MOUNT_STYLES.FLUSH:
      return 1.0;
    case MOUNT_STYLES.SPOT:
      return 1.2;
    case MOUNT_STYLES.LONG_PENDANT:
      return 12.0;
    case MOUNT_STYLES.WALL:
      return 0;
    case MOUNT_STYLES.SHORT_PENDANT:
    default:
      return 5.5;
  }
}

export function getLightingType(id) {
  return (
    LIGHTING_TYPES.find((item) => item.id === id) ||
    LIGHTING_TYPES.find((item) => item.id === "enarte_decide")
  );
}

/**
 * Resolve lighting type + mount geometry from product when customer picks "Let ENARTE Decide".
 */
export function resolveLightingType(lightingTypeId, product = {}) {
  let base;
  if (lightingTypeId && lightingTypeId !== "enarte_decide") {
    base = getLightingType(lightingTypeId);
  } else {
    const blob = `${product.title || ""} ${product.collection || ""}`.toLowerCase();
    if (blob.includes("أبليك") || blob.includes("wall")) {
      base = getLightingType("wall_light");
    } else if (blob.includes("spot") || blob.includes("سبوت")) {
      base = getLightingType("spot_light");
    } else if (blob.includes("led")) {
      base = getLightingType("led_chandelier");
    } else {
      base = getLightingType("chandelier");
    }
  }

  const mountStyle = inferMountStyle(product, base.id);
  const hangDropPercent = hangDropPercentForMountStyle(mountStyle);

  return {
    ...base,
    mountStyle,
    hangDropPercent,
    // Sharp: keep canopy at top of bitmap; hang length is mostly prompt-driven
    anchorY: base.hangFromCeiling ? 0 : base.anchorY,
  };
}
