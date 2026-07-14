import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { colors, spacing } from "@/src/theme";

export default function ProductDetailScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const { addLine } = useCart();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [variant, setVariant] = useState<CatalogVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProduct({ handle: String(handle) })
      .then((data) => {
        if (cancelled) return;
        setProduct(data);
        const first =
          data.variants?.find((v) => v.available) || data.variants?.[0] || null;
        setVariant(first);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "product_not_found");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const canAdd = useMemo(
    () => Boolean(variant?.numericId && variant.available !== false),
    [variant],
  );

  function onAdd() {
    if (!product || !variant?.numericId) return;
    addLine({
      productId: product.id,
      productTitle: product.title,
      handle: product.handle,
      image: product.image,
      variantId: variant.id,
      variantNumericId: variant.numericId,
      variantTitle: variant.title,
      price: variant.price || product.price || "0",
      currency: variant.currency || product.currency || "JOD",
      url: product.url,
      quantity: 1,
    });
    setAdded(true);
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
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {product.image ? (
            <Image source={{ uri: product.image }} style={styles.hero} contentFit="cover" />
          ) : (
            <View style={[styles.hero, styles.heroEmpty]} />
          )}
          <Text style={styles.title}>{product.title}</Text>
          <Text style={styles.price}>
            {variant?.price || product.price} {product.currency || "JOD"}
          </Text>
          {product.variants && product.variants.length > 1 ? (
            <View style={styles.variants}>
              {product.variants.map((item) => {
                const active = item.id === variant?.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.variantChip, active && styles.variantActive]}
                    onPress={() => setVariant(item)}
                  >
                    <Text
                      style={[
                        styles.variantText,
                        active && styles.variantTextActive,
                      ]}
                    >
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {product.description ? (
            <Text style={styles.desc}>{product.description}</Text>
          ) : null}

          <Pressable
            style={[styles.addBtn, !canAdd && styles.disabled]}
            disabled={!canAdd}
            onPress={onAdd}
          >
            <Text style={styles.addText}>
              {added ? "تمت الإضافة للسلة ✔" : "أضف إلى السلة"}
            </Text>
          </Pressable>
          <Pressable style={styles.cartLink} onPress={() => router.push("/cart")}>
            <Text style={styles.cartLinkText}>عرض السلة</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  hero: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: colors.beige,
  },
  heroEmpty: { opacity: 0.7 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.goldDeep,
    textAlign: "right",
  },
  desc: {
    color: colors.muted,
    lineHeight: 22,
    textAlign: "right",
  },
  variants: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  variantChip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  variantActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  variantText: { color: colors.ink, fontWeight: "600" },
  variantTextActive: { color: colors.charcoal, fontWeight: "800" },
  addBtn: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  addText: { color: colors.charcoal, fontWeight: "800", fontSize: 16 },
  cartLink: { alignItems: "center", paddingVertical: 8 },
  cartLinkText: { color: colors.goldDeep, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  error: { color: colors.danger },
});
