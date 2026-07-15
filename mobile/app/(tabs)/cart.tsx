import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "@/src/cart/CartContext";
import { SOCIAL } from "@/src/config/social";
import { colors, radii, spacing } from "@/src/theme";

export default function CartScreen() {
  const router = useRouter();
  const {
    lines,
    count,
    subtotal,
    currency,
    setQuantity,
    removeLine,
    clear,
    checkoutUrl,
  } = useCart();

  function checkout() {
    // Order form first (name/phone/governorate), then optional electronic payment.
    router.push("/order");
  }

  async function orderViaWhatsApp() {
    const items = lines
      .map(
        (line, i) =>
          `${i + 1}) ${line.productTitle}${
            line.variantTitle && line.variantTitle !== "Default Title"
              ? ` (${line.variantTitle})`
              : ""
          } × ${line.quantity} — ${line.price} ${line.currency}`,
      )
      .join("\n");
    const message = encodeURIComponent(
      `طلب جديد من تطبيق ENARTE\n\n${items}\n\nالمجموع: ${subtotal.toFixed(2)} ${currency}\n\nأرغب بإتمام الطلب${
        checkoutUrl ? `\nرابط السلة: ${checkoutUrl}` : ""
      }`,
    );
    await Linking.openURL(`${SOCIAL.contactWhatsApp}?text=${message}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>سلتك</Text>
        <Text style={styles.sub}>{count} منتج — الدفع عبر المتجر أو واتساب</Text>

        {!lines.length ? (
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>سلتك فارغة</Text>
            <Pressable style={styles.shopBtn} onPress={() => router.push("/shop")}>
              <Text style={styles.shopBtnText}>تصفّح المتجر</Text>
            </Pressable>
          </View>
        ) : (
          lines.map((line) => (
            <View key={line.variantId} style={styles.row}>
              {line.image ? (
                <Image source={{ uri: line.image }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={2}>
                  {line.productTitle}
                </Text>
                {line.variantTitle && line.variantTitle !== "Default Title" ? (
                  <Text style={styles.variant}>{line.variantTitle}</Text>
                ) : null}
                <Text style={styles.price}>
                  {line.price} {line.currency}
                </Text>
                <View style={styles.qtyRow}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => setQuantity(line.variantId, line.quantity - 1)}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.qty}>{line.quantity}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => setQuantity(line.variantId, line.quantity + 1)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                  <Pressable onPress={() => removeLine(line.variantId)}>
                    <Text style={styles.remove}>حذف</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {lines.length ? (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.subtotal}>
              {subtotal.toFixed(2)} {currency}
            </Text>
            <Text style={styles.totalLabel}>المجموع</Text>
          </View>
          <Pressable style={styles.checkout} onPress={checkout}>
            <Text style={styles.checkoutText}>إتمام الشراء</Text>
          </Pressable>
          <Pressable style={styles.whatsapp} onPress={orderViaWhatsApp}>
            <Text style={styles.whatsappText}>اطلب عبر واتساب الآن</Text>
          </Pressable>
          <Text style={styles.payHint}>
            إذا لم تظهر بطاقة/خيارات الدفع في صفحة Shopify، فعّلوها من لوحة التحكم
            (Settings → Payments) أو استخدموا واتساب أعلاه.
          </Text>
          <Pressable onPress={clear}>
            <Text style={styles.clear}>تفريغ السلة</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 24 },
  heading: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  sub: { color: colors.muted, textAlign: "right", marginTop: -6 },
  emptyBox: { alignItems: "center", marginTop: 48, gap: 16 },
  empty: { color: colors.muted, fontSize: 16 },
  shopBtn: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  shopBtnText: { fontWeight: "800", color: colors.charcoal },
  row: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  thumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: colors.beige },
  thumbEmpty: { opacity: 0.6 },
  meta: { flex: 1, gap: 4 },
  title: { fontWeight: "700", color: colors.charcoal, textAlign: "right" },
  variant: { color: colors.muted, textAlign: "right", fontSize: 12 },
  price: { color: colors.goldDeep, fontWeight: "800", textAlign: "right" },
  qtyRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.beige,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontWeight: "800", color: colors.charcoal, fontSize: 16 },
  qty: { fontWeight: "700", minWidth: 18, textAlign: "center" },
  remove: { color: colors.danger, fontWeight: "700", marginStart: 8 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { color: colors.muted, fontWeight: "600" },
  subtotal: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.charcoal,
  },
  checkout: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  checkoutText: { fontWeight: "800", color: colors.charcoal, fontSize: 16 },
  whatsapp: {
    backgroundColor: "#25D366",
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  whatsappText: { fontWeight: "800", color: "#fff", fontSize: 15 },
  payHint: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
  },
  disabled: { opacity: 0.45 },
  clear: { textAlign: "center", color: colors.muted, fontWeight: "600" },
});
