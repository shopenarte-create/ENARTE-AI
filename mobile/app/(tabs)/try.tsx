import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { uploadRoomHandoff, webTryUrl } from "@/src/api/try-handoff";
import { colors, radii, spacing } from "@/src/theme";

type Picked = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export default function TryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    entry?: string;
    productId?: string;
    title?: string;
    image?: string;
    url?: string;
    handle?: string;
  }>();

  const lockedProduct = useMemo(() => {
    if (params.entry !== "product" || !params.productId) return null;
    return {
      productId: String(params.productId),
      title: params.title ? String(params.title) : null,
      image: params.image ? String(params.image) : null,
      url: params.url ? String(params.url) : null,
    };
  }, [params]);

  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(fromCamera: boolean) {
    setError(null);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("يلزم إذن الكاميرا/الصور للمتابعة.");
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
      fileName: asset.fileName || "room.jpg",
    });
  }

  async function upload() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await uploadRoomHandoff({
        uri: picked.uri,
        mimeType: picked.mimeType,
        fileName: picked.fileName,
        entry: lockedProduct ? "product" : "home",
        productId: lockedProduct?.productId,
        productImage: lockedProduct?.image,
        title: lockedProduct?.title,
        url: lockedProduct?.url,
      });
      if (!data.success || !data.handoffId) {
        setError(data.error || "تعذر حفظ صورة الغرفة.");
        return;
      }
      router.push({
        pathname: "/try-viewer",
        params: {
          url: encodeURIComponent(
            webTryUrl(data.handoffId, {
              entry: lockedProduct ? "product" : "home",
              productId: lockedProduct?.productId,
              title: lockedProduct?.title,
              image: lockedProduct?.image,
              url: lockedProduct?.url,
            }),
          ),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "network_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>تجربة ENARTE</Text>
        <Text style={styles.title}>جرّبها بغرفتك</Text>
        <Text style={styles.sub}>
          {lockedProduct
            ? `سنركّب «${lockedProduct.title || "هذا المنتج"}» على صورة غرفتك داخل التطبيق.`
            : "ارفع صورة للغرفة وأكمل التجربة التفاعلية داخل التطبيق — بدون الحاجة لفتح الموقع."}
        </Text>

        {lockedProduct ? (
          <View style={styles.productCard}>
            {lockedProduct.image ? (
              <Image
                source={{ uri: lockedProduct.image }}
                style={styles.productThumb}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.productThumb, styles.thumbEmpty]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productLabel}>منتج محدد</Text>
              <Text style={styles.productTitle} numberOfLines={2}>
                {lockedProduct.title || "منتج ENARTE"}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.previewBox}>
          {picked ? (
            <Image source={{ uri: picked.uri }} style={styles.preview} contentFit="cover" />
          ) : (
            <Text style={styles.previewEmpty}>ارفع صورة غرفة واضحة وكاملة</Text>
          )}
        </View>

        <View style={styles.row}>
          <Pressable style={styles.btnSecondary} onPress={() => pick(false)} disabled={busy}>
            <Text style={styles.btnSecondaryText}>من المعرض</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => pick(true)} disabled={busy}>
            <Text style={styles.btnSecondaryText}>الكاميرا</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.btnPrimary, (!picked || busy) && styles.disabled]}
          disabled={!picked || busy}
          onPress={upload}
        >
          {busy ? (
            <ActivityIndicator color={colors.charcoal} />
          ) : (
            <Text style={styles.btnPrimaryText}>ابدأ التجربة داخل التطبيق</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
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
  productCard: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    alignItems: "center",
  },
  productThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.beige,
  },
  thumbEmpty: { opacity: 0.6 },
  productLabel: {
    color: colors.goldDeep,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  productTitle: {
    color: colors.charcoal,
    fontWeight: "800",
    textAlign: "right",
  },
  previewBox: {
    height: 260,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { width: "100%", height: "100%" },
  previewEmpty: { color: colors.muted, paddingHorizontal: 24, textAlign: "center" },
  row: { flexDirection: "row-reverse", gap: spacing.sm },
  btnPrimary: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnPrimaryText: { color: colors.charcoal, fontWeight: "800", fontSize: 16 },
  btnSecondary: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnSecondaryText: { color: colors.goldDeep, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  error: { color: colors.danger, textAlign: "right" },
});
