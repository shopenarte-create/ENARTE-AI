import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CatalogProduct,
  CatalogVariant,
  fetchProduct,
} from "@/src/api/catalog";
import { useCart } from "@/src/cart/CartContext";
import { SOCIAL } from "@/src/config/social";
import { colors, radii, spacing } from "@/src/theme";

const WAITLIST_KEY = "enarte_stock_waitlist_v1";

function variantNumericId(variant: CatalogVariant | null | undefined) {
  if (!variant) return null;
  if (variant.numericId) return String(variant.numericId);
  const match =
    String(variant.id || "").match(/ProductVariant\/(\d+)/) ||
    String(variant.id || "").match(/^(\d+)$/);
  return match ? match[1] : null;
}

export default function ProductDetailScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const { addLine } = useCart();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [variant, setVariant] = useState<CatalogVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAdded(false);
    setNotifyDone(false);
    setHint(null);
    fetchProduct({ handle: String(handle) })
      .then((data) => {
        if (cancelled) return;
        setProduct(data);
        const first =
          data.variants?.find((v) => v.available && variantNumericId(v)) ||
          data.variants?.find((v) => variantNumericId(v)) ||
          data.variants?.[0] ||
          null;
        setVariant(first);
      })
      .catch(() => {
        if (!cancelled) {
          setError("تعذر تحميل المنتج — تحقق من الاتصال وأعد المحاولة.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  useEffect(() => {
    setAdded(false);
    setNotifyDone(false);
    setHint(null);
  }, [variant?.id]);

  const numericId = useMemo(() => variantNumericId(variant), [variant]);
  const outOfStock = Boolean(
    variant ? variant.available === false : product && product.available === false,
  );
  const canAdd = Boolean(numericId) && !outOfStock;

  async function onAdd() {
    if (!product || !variant || !numericId || outOfStock) return;
    addLine({
      productId: product.id,
      productTitle: product.title,
      handle: product.handle,
      image: product.image,
      variantId: variant.id || numericId,
      variantNumericId: numericId,
      variantTitle: variant.title,
      price: variant.price || product.price || "0",
      currency: variant.currency || product.currency || "JOD",
      url: product.url,
      quantity: 1,
    });
    setAdded(true);
    setHint(null);
  }

  async function onBuyNow() {
    if (!product || !variant || !numericId || outOfStock) return;
    await onAdd();
    router.push("/order");
  }

  async function onNotifyWhenAvailable() {
    if (!product) return;
    const entry = {
      productId: product.id,
      handle: product.handle,
      title: product.title,
      variantId: variant?.id || null,
      variantTitle: variant?.title || null,
      at: new Date().toISOString(),
    };
    try {
      const raw = await AsyncStorage.getItem(WAITLIST_KEY);
      const list = raw ? (JSON.parse(raw) as typeof entry[]) : [];
      const next = [
        entry,
        ...list.filter(
          (row) =>
            !(
              row.productId === entry.productId &&
              row.variantId === entry.variantId
            ),
        ),
      ].slice(0, 40);
      await AsyncStorage.setItem(WAITLIST_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }

    const variantBit =
      variant?.title && variant.title !== "Default Title"
        ? ` — المقاس/الخيار: ${variant.title}`
        : "";
    const message = encodeURIComponent(
      `مرحباً ENARTE، أرجو إبلاغي عند توفر المنتج:\n${product.title}${variantBit}\nالرابط: ${product.url || `https://enarteshop.com/products/${product.handle}`}`,
    );
    await Linking.openURL(`${SOCIAL.contactWhatsApp}?text=${message}`);
    setNotifyDone(true);
    setHint("تم تسجيل طلبكم — سنبلغكم عبر واتساب عند التوفر.");
  }

  function onTryInRoom() {
    if (!product) return;
    router.push({
      pathname: "/try",
      params: {
        entry: "product",
        productId: product.id,
        title: product.title,
        image: product.image || "",
        url: product.url || "",
        handle: product.handle,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: product?.title || "المنتج" }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.goldDeep} />
        </View>
      ) : error || !product ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error || "المنتج غير موجود"}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => router.replace(`/product/${handle}`)}
          >
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.wrap}>
          <ScrollView contentContainerStyle={styles.content}>
            {product.image ? (
              <Image source={{ uri: product.image }} style={styles.hero} contentFit="cover" />
            ) : (
              <View style={[styles.hero, styles.heroEmpty]} />
            )}
            <Text style={styles.brandMark}>ENARTE</Text>
            <Text style={styles.title}>{product.title}</Text>
            <Text style={styles.price}>
              {variant?.price || product.price} {product.currency || "JOD"}
            </Text>

            {outOfStock ? (
              <View style={styles.oosBanner}>
                <Text style={styles.oosText}>نفذ المخزون</Text>
              </View>
            ) : (
              <Text style={styles.inStock}>متوفر</Text>
            )}

            {product.variants && product.variants.length > 1 ? (
              <View style={styles.variants}>
                {product.variants.map((item) => {
                  const active = item.id === variant?.id;
                  const oos = item.available === false;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.variantChip,
                        active && styles.variantActive,
                        oos && styles.variantOos,
                      ]}
                      onPress={() => setVariant(item)}
                    >
                      <Text
                        style={[
                          styles.variantText,
                          active && styles.variantTextActive,
                          oos && styles.variantTextOos,
                        ]}
                      >
                        {item.title}
                        {oos ? " · نفذ" : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {product.description ? (
              <Text style={styles.desc}>{product.description}</Text>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.tryBtn} onPress={onTryInRoom}>
              <Text style={styles.tryText}>جرّبها بغرفتك</Text>
            </Pressable>

            {outOfStock ? (
              <Pressable style={styles.notifyBtn} onPress={onNotifyWhenAvailable}>
                <Text style={styles.notifyText}>
                  {notifyDone ? "تم التسجيل ✔ — أبلغني عند التوفر" : "أبلغني عند التوفر"}
                </Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={[styles.buyBtn, !canAdd && styles.disabled]}
                  disabled={!canAdd}
                  onPress={onBuyNow}
                >
                  <Text style={styles.buyText}>اشتري الآن</Text>
                </Pressable>
                <Pressable
                  style={[styles.addBtn, !canAdd && styles.disabled]}
                  disabled={!canAdd}
                  onPress={onAdd}
                >
                  <Text style={styles.addText}>
                    {added ? "تمت الإضافة ✔" : "أضف إلى السلة"}
                  </Text>
                </Pressable>
              </>
            )}

            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            {added && !outOfStock ? (
              <Pressable style={styles.cartLink} onPress={() => router.push("/cart")}>
                <Text style={styles.cartLinkText}>عرض السلة والدفع</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  wrap: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: 12,
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 24 },
  hero: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.xl,
    backgroundColor: colors.beige,
  },
  heroEmpty: { opacity: 0.7 },
  brandMark: {
    color: colors.goldDeep,
    letterSpacing: 3,
    fontWeight: "700",
    fontSize: 12,
    textAlign: "right",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
    lineHeight: 32,
  },
  price: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.goldDeep,
    textAlign: "right",
  },
  oosBanner: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(138,47,47,0.12)",
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  oosText: {
    color: colors.danger,
    fontWeight: "800",
    fontSize: 14,
  },
  inStock: {
    color: colors.success,
    fontWeight: "700",
    textAlign: "right",
    fontSize: 13,
  },
  desc: {
    color: colors.ink,
    textAlign: "right",
    lineHeight: 24,
  },
  variants: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  variantChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  variantActive: {
    borderColor: colors.goldDeep,
    backgroundColor: "rgba(196,163,90,0.15)",
  },
  variantOos: {
    borderColor: "rgba(138,47,47,0.35)",
  },
  variantText: { color: colors.charcoal, fontWeight: "600" },
  variantTextActive: { color: colors.goldDeep, fontWeight: "800" },
  variantTextOos: { color: colors.danger },
  actions: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.md,
    gap: 10,
    backgroundColor: colors.white,
  },
  tryBtn: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  tryText: { color: colors.goldDeep, fontWeight: "800" },
  buyBtn: {
    backgroundColor: colors.charcoal,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  buyText: { color: colors.cream, fontWeight: "800", fontSize: 16 },
  addBtn: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  addText: { color: colors.charcoal, fontWeight: "800", fontSize: 16 },
  notifyBtn: {
    backgroundColor: colors.charcoal,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  notifyText: { color: colors.cream, fontWeight: "800", fontSize: 16 },
  disabled: { opacity: 0.45 },
  hint: { color: colors.muted, textAlign: "center", fontSize: 12, lineHeight: 18 },
  cartLink: { alignItems: "center", paddingVertical: 4 },
  cartLinkText: { color: colors.goldDeep, fontWeight: "800" },
  error: { color: colors.danger, textAlign: "center", fontWeight: "700" },
  retryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { fontWeight: "800", color: colors.charcoal },
});
