import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
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
  searchCatalogByImage,
  type ImageSearchProduct,
} from "@/src/api/image-search";
import { SOCIAL } from "@/src/config/social";
import { colors, radii, spacing } from "@/src/theme";

type Picked = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export default function ImageSearchScreen() {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ImageSearchProduct[]>([]);
  const [modeNote, setModeNote] = useState<string | null>(null);
  const [sourcing, setSourcing] = useState<string | null>(null);

  async function pick(fromCamera: boolean) {
    setError(null);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("يلزم إذن الكاميرا أو الصور للمتابعة.");
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.82,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.82,
        });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
      fileName: asset.fileName || "query.jpg",
    });
    setProducts([]);
    setModeNote(null);
    setSourcing(null);
  }

  async function runSearch() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    setProducts([]);
    setModeNote(null);
    setSourcing(null);
    try {
      const data = await searchCatalogByImage({
        uri: picked.uri,
        mimeType: picked.mimeType,
        fileName: picked.fileName,
      });
      if (!data.ok && !data.products?.length) {
        setError(data.message || data.error || "تعذر البحث في الكتالوج.");
        return;
      }
      const list = data.products || [];
      setProducts(list);
      if (data.mode === "match") {
        setModeNote("نتائج مطابقة أو قريبة جداً من صورة الثريا.");
      } else if (data.mode === "similar" || list.length) {
        setModeNote("لم نجد تطابقاً حرفياً — هذه أقرب الثريات في متجر ENARTE.");
      } else {
        setModeNote("لم نعثر على منتج مشابه في الكتالوج حالياً.");
      }
      if (data.showSourcingOffer && data.sourcingMessage) {
        setSourcing(data.sourcingMessage);
      } else if (!list.length) {
        setSourcing(
          "يمكننا محاولة تأمين طلبك خلال ثلاثة أيام عبر واتساب.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الاتصال بالخادم.");
    } finally {
      setBusy(false);
    }
  }

  function openProduct(product: ImageSearchProduct) {
    const handle =
      product.handle ||
      String(product.url || "").split("/products/")[1]?.split("?")[0] ||
      null;
    if (handle) {
      router.push(`/product/${handle}`);
      return;
    }
    if (product.url) Linking.openURL(String(product.url));
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "ابحث بالصورة" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>كتالوج ENARTE</Text>
        <Text style={styles.title}>ابحث عن ثريا بالصورة</Text>
        <Text style={styles.sub}>
          ارفع صورة واضحة لثريا أو إضاءة — نعرض منتجات مشابهة من متجر ENARTE فقط،
          وليس من المحادثة.
        </Text>

        <View style={styles.previewBox}>
          {picked ? (
            <Image source={{ uri: picked.uri }} style={styles.preview} contentFit="cover" />
          ) : (
            <Text style={styles.previewEmpty}>اختر صورة المنتج أو الثريا</Text>
          )}
        </View>

        <View style={styles.row}>
          <Pressable style={styles.btnSecondary} onPress={() => pick(false)} disabled={busy}>
            <Ionicons name="images-outline" size={18} color={colors.charcoal} />
            <Text style={styles.btnSecondaryText}>المعرض</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => pick(true)} disabled={busy}>
            <Ionicons name="camera-outline" size={18} color={colors.charcoal} />
            <Text style={styles.btnSecondaryText}>الكاميرا</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.btnPrimary, (!picked || busy) && styles.disabled]}
          disabled={!picked || busy}
          onPress={runSearch}
        >
          {busy ? (
            <ActivityIndicator color={colors.charcoal} />
          ) : (
            <Text style={styles.btnPrimaryText}>ابحث في المتجر</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {modeNote ? <Text style={styles.modeNote}>{modeNote}</Text> : null}

        {products.map((product) => (
          <Pressable
            key={String(product.id)}
            style={styles.card}
            onPress={() => openProduct(product)}
          >
            {product.image ? (
              <Image source={{ uri: String(product.image) }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]} />
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {product.title}
              </Text>
              {product.price != null && product.price !== "" ? (
                <Text style={styles.cardPrice}>
                  {product.price} {product.currency || "JOD"}
                </Text>
              ) : null}
              {product.matchReason ? (
                <Text style={styles.cardReason} numberOfLines={2}>
                  {product.matchReason}
                </Text>
              ) : null}
              <Text style={styles.cardCta}>عرض المنتج</Text>
            </View>
          </Pressable>
        ))}

        {sourcing ? (
          <View style={styles.sourcing}>
            <Text style={styles.sourcingText}>{sourcing}</Text>
            <Pressable
              style={styles.whatsappBtn}
              onPress={() => Linking.openURL(SOCIAL.contactWhatsApp)}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={styles.whatsappText}>تواصل عبر واتساب</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  eyebrow: {
    color: colors.goldDeep,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "right",
    fontSize: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  sub: {
    color: colors.muted,
    lineHeight: 24,
    textAlign: "right",
  },
  previewBox: {
    height: 220,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { width: "100%", height: "100%" },
  previewEmpty: { color: colors.muted, fontWeight: "600" },
  row: { flexDirection: "row-reverse", gap: 10 },
  btnSecondary: {
    flex: 1,
    flexDirection: "row-reverse",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingVertical: 14,
  },
  btnSecondaryText: { color: colors.charcoal, fontWeight: "700" },
  btnPrimary: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnPrimaryText: { color: colors.charcoal, fontWeight: "800", fontSize: 16 },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, textAlign: "right", fontWeight: "600" },
  modeNote: {
    color: colors.ink,
    textAlign: "right",
    fontWeight: "600",
    lineHeight: 22,
  },
  card: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  thumb: { width: 96, height: 108, backgroundColor: colors.beige },
  thumbEmpty: { backgroundColor: colors.beige },
  cardBody: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, gap: 4 },
  cardTitle: {
    color: colors.charcoal,
    fontWeight: "800",
    textAlign: "right",
    fontSize: 15,
  },
  cardPrice: {
    color: colors.goldDeep,
    fontWeight: "800",
    textAlign: "right",
  },
  cardReason: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
  cardCta: {
    marginTop: 4,
    color: colors.goldDeep,
    fontWeight: "700",
    textAlign: "right",
    fontSize: 13,
  },
  sourcing: {
    backgroundColor: colors.charcoal,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 12,
  },
  sourcingText: {
    color: "rgba(247,243,236,0.9)",
    textAlign: "right",
    lineHeight: 22,
  },
  whatsappBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#25D366",
    borderRadius: radii.md,
    paddingVertical: 12,
  },
  whatsappText: { color: "#fff", fontWeight: "800" },
});
