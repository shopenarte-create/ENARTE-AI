import { Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { pingApi } from "@/src/api/try-handoff";
import { API_BASE_URL, STORE_URL } from "@/src/config";
import { useCart } from "@/src/cart/CartContext";
import { colors, spacing } from "@/src/theme";

export default function HomeScreen() {
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const { count } = useCart();

  useEffect(() => {
    pingApi()
      .then((data) => setApiOk(Boolean(data?.success || data?.pong)))
      .catch(() => setApiOk(false));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.hero}>
        <Text style={styles.brand}>ENARTE</Text>
        <Text style={styles.heading}>تسوق + مساعد ذكي في تطبيق واحد</Text>
        <Text style={styles.sub}>
          تصفّح المنتجات، أضف إلى السلة، وادفع عبر Shopify — مع ENARTE AI لتجربة الإضاءة
          والبحث بالصورة.
        </Text>

        <View style={styles.ctaCol}>
          <Link href="/shop" asChild>
            <Pressable style={styles.ctaPrimary}>
              <Text style={styles.ctaPrimaryText}>تسوق الآن</Text>
            </Pressable>
          </Link>
          <Link href="/assistant" asChild>
            <Pressable style={styles.ctaSecondary}>
              <Text style={styles.ctaSecondaryText}>تحدث مع المساعد</Text>
            </Pressable>
          </Link>
          <Link href="/try" asChild>
            <Pressable style={styles.ctaSecondary}>
              <Text style={styles.ctaSecondaryText}>جرب الإضاءة في غرفتك</Text>
            </Pressable>
          </Link>
          <Link href="/cart" asChild>
            <Pressable style={styles.ctaGhost}>
              <Text style={styles.ctaGhostText}>السلة ({count})</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>حالة الاتصال</Text>
        <Text style={styles.statusLine}>
          API:{" "}
          {apiOk === null ? "جاري التحقق…" : apiOk ? "متصل ✔" : "غير متصل"}
        </Text>
        <Pressable onPress={() => Linking.openURL(STORE_URL)}>
          <Text style={styles.statusHint}>{STORE_URL}</Text>
        </Pressable>
        <Text style={styles.statusHint} numberOfLines={1}>
          {API_BASE_URL}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ivory,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  brand: {
    fontSize: 34,
    letterSpacing: 4,
    fontWeight: "600",
    color: colors.charcoal,
    textAlign: "center",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.charcoal,
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.muted,
    textAlign: "center",
  },
  ctaCol: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  ctaPrimary: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaPrimaryText: {
    color: colors.charcoal,
    fontWeight: "800",
    fontSize: 16,
  },
  ctaSecondary: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaSecondaryText: {
    color: colors.goldDeep,
    fontWeight: "800",
    fontSize: 16,
  },
  ctaGhost: {
    paddingVertical: 10,
    alignItems: "center",
  },
  ctaGhostText: {
    color: colors.muted,
    fontWeight: "600",
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 4,
  },
  statusTitle: {
    fontWeight: "700",
    color: colors.charcoal,
    textAlign: "right",
  },
  statusLine: {
    color: colors.ink,
    textAlign: "right",
  },
  statusHint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "left",
  },
});
