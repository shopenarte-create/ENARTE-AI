import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "@/src/cart/CartContext";
import { colors, spacing } from "@/src/theme";

export default function CartScreen() {
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

  async function checkout() {
    if (!checkoutUrl) return;
    await WebBrowser.openBrowserAsync(checkoutUrl);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>السلة ({count})</Text>
        {!lines.length ? (
          <Text style={styles.empty}>سلتك فارغة — تصفّح المتجر وأضف منتجات.</Text>
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
          <Text style={styles.subtotal}>
            المجموع: {subtotal.toFixed(2)} {currency}
          </Text>
          <Pressable style={styles.checkout} onPress={checkout}>
            <Text style={styles.checkoutText}>إتمام الشراء</Text>
          </Pressable>
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
    fontSize: 22,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
  },
  thumb: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.beige },
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
    width: 28,
    height: 28,
    borderRadius: 8,
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
  subtotal: {
    fontWeight: "800",
    fontSize: 16,
    color: colors.charcoal,
    textAlign: "right",
  },
  checkout: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  checkoutText: { fontWeight: "800", color: colors.charcoal, fontSize: 16 },
  clear: { textAlign: "center", color: colors.muted, fontWeight: "600" },
});
