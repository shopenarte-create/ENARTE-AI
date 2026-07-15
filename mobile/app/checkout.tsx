import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { useCart } from "@/src/cart/CartContext";
import { colors, radii, spacing } from "@/src/theme";

/**
 * Checkout stays inside the app via WebView (top-level navigation).
 * Note: X-Frame-Options DENY only blocks iframes — not an in-app WebView.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const { clear } = useCart();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const checkoutUrl = useMemo(() => {
    try {
      return url ? decodeURIComponent(String(url)) : "";
    } catch {
      return String(url || "");
    }
  }, [url]);

  function looksLikeThankYou(navUrl: string) {
    const u = navUrl.toLowerCase();
    return (
      u.includes("/thank") ||
      u.includes("thank_you") ||
      u.includes("/orders/") ||
      u.includes("checkout/thank") ||
      (u.includes("/checkouts/") && u.includes("thank_you"))
    );
  }

  function onNavChange(nav: WebViewNavigation) {
    if (nav.url && looksLikeThankYou(nav.url)) {
      setDone(true);
    }
  }

  async function openExternalFallback() {
    if (!checkoutUrl) return;
    await WebBrowser.openBrowserAsync(checkoutUrl, {
      enableBarCollapsing: true,
      toolbarColor: colors.ivory,
      controlsColor: colors.charcoal,
      dismissButtonStyle: "close",
    });
  }

  if (!checkoutUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "إتمام الشراء" }} />
        <View style={styles.center}>
          <Text style={styles.error}>رابط الدفع غير متوفر</Text>
          <Pressable style={styles.btn} onPress={() => router.back()}>
            <Text style={styles.btnText}>رجوع للسلة</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "تم الطلب" }} />
        <View style={styles.center}>
          <Text style={styles.brand}>ENARTE</Text>
          <Text style={styles.title}>شكراً لطلبكم</Text>
          <Text style={styles.body}>
            اكتمل الدفع داخل التطبيق. يمكنكم متابعة التسوق الآن.
          </Text>
          <Pressable
            style={styles.btn}
            onPress={() => {
              clear();
              router.replace("/shop");
            }}
          >
            <Text style={styles.btnText}>متابعة التسوق</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "الدفع داخل التطبيق",
          headerBackTitle: "السلة",
        }}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.goldDeep} />
          <Text style={styles.loaderText}>جاري تحميل صفحة الدفع داخل التطبيق…</Text>
        </View>
      ) : null}

      {loadError ? (
        <View style={styles.center}>
          <Text style={styles.error}>{loadError}</Text>
          <Pressable
            style={styles.btn}
            onPress={() => {
              setLoadError(null);
              setLoading(true);
              webRef.current?.reload();
            }}
          >
            <Text style={styles.btnText}>إعادة المحاولة</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={openExternalFallback}>
            <Text style={styles.btnSecondaryText}>فتح في المتصفح</Text>
          </Pressable>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>الرجوع للسلة</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: checkoutUrl }}
          style={styles.web}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={onNavChange}
          onError={() => {
            setLoading(false);
            setLoadError("تعذر تحميل صفحة الدفع داخل التطبيق.");
          }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) {
              setLoadError("خادم الدفع غير متاح حالياً. حاول لاحقاً.");
            }
          }}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          userAgent={
            Platform.OS === "android"
              ? "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EnarteApp/1.0"
              : undefined
          }
        />
      )}

      <View style={styles.bar}>
        <Pressable
          style={styles.barBtn}
          onPress={() => {
            clear();
            router.replace("/shop");
          }}
        >
          <Text style={styles.barBtnText}>تم الشراء</Text>
        </Pressable>
        <Pressable style={styles.barGhost} onPress={() => router.back()}>
          <Text style={styles.barGhostText}>إلغاء</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  web: { flex: 1, backgroundColor: colors.white },
  loader: {
    position: "absolute",
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.ivory,
  },
  loaderText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  brand: {
    fontSize: 28,
    letterSpacing: 5,
    fontWeight: "600",
    color: colors.goldDeep,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "center",
  },
  body: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 24,
  },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 22,
    width: "100%",
    alignItems: "center",
  },
  btnText: { fontWeight: "800", color: colors.charcoal, fontSize: 15 },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 22,
    width: "100%",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  btnSecondaryText: { fontWeight: "800", color: colors.goldDeep },
  link: { color: colors.goldDeep, fontWeight: "700" },
  error: { color: colors.danger, textAlign: "center", fontWeight: "700" },
  bar: {
    flexDirection: "row-reverse",
    gap: 10,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  barBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  barBtnText: { fontWeight: "800", color: colors.charcoal },
  barGhost: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  barGhostText: { color: colors.muted, fontWeight: "700" },
});
