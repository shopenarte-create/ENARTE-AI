import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth/AuthContext";
import {
  openShopifyAccountAuth,
  type SocialProvider,
} from "@/src/auth/socialAuth";
import { colors, radii, spacing } from "@/src/theme";

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const router = useRouter();
  const { ready, hasEntered, continueAsGuest, markSignedIn } = useAuth();
  const [busy, setBusy] = useState<
    "google" | "facebook" | "shopify" | "guest" | null
  >(null);
  const awaitingReturn = useRef<SocialProvider | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const provider = awaitingReturn.current;
      if (!provider || provider === "guest") return;
      awaitingReturn.current = null;
      void (async () => {
        await markSignedIn({
          displayName:
            provider === "google"
              ? "عميل Google"
              : provider === "facebook"
                ? "عميل Facebook"
                : "عميل ENARTE",
          provider,
        });
        setBusy(null);
        router.replace("/(tabs)");
      })();
    });
    return () => sub.remove();
  }, [markSignedIn, router]);

  if (ready && hasEntered) {
    return <Redirect href="/(tabs)" />;
  }

  async function enterApp(provider: SocialProvider) {
    awaitingReturn.current = null;
    await markSignedIn({
      displayName:
        provider === "google"
          ? "عميل Google"
          : provider === "facebook"
            ? "عميل Facebook"
            : provider === "guest"
              ? "زائر"
              : "عميل ENARTE",
      provider,
    });
    setBusy(null);
    router.replace("/(tabs)");
  }

  async function openStoreThenEnter(provider: "google" | "facebook" | "shopify") {
    setBusy(provider === "shopify" ? "shopify" : provider);
    awaitingReturn.current = provider;
    try {
      await openShopifyAccountAuth("login");
      // Browser sheet closed — enter even if AppState already fired.
      if (awaitingReturn.current === provider) {
        await enterApp(provider);
      }
    } catch {
      awaitingReturn.current = null;
      setBusy(null);
    }
  }

  async function onGuest() {
    setBusy("guest");
    try {
      await continueAsGuest();
      router.replace("/(tabs)");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <View style={styles.glow} />
        <Text style={styles.brand}>ENARTE</Text>
        <Text style={styles.tag}>إضاءة فاخرة لمساحاتك</Text>
        <Text style={styles.title}>مرحباً بك</Text>
        <Text style={styles.sub}>
          سجّل عبر Google أو Facebook أو البريد، أو ادخل كزائر مباشرة.
        </Text>

        <Pressable
          style={[styles.btnGoogle, busy && styles.disabled]}
          disabled={Boolean(busy)}
          onPress={() => openStoreThenEnter("google")}
        >
          {busy === "google" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#fff" />
              <Text style={styles.btnGoogleText}>المتابعة عبر Google</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.btnFacebook, busy && styles.disabled]}
          disabled={Boolean(busy)}
          onPress={() => openStoreThenEnter("facebook")}
        >
          {busy === "facebook" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-facebook" size={18} color="#fff" />
              <Text style={styles.btnFacebookText}>المتابعة عبر Facebook</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.btnSecondary, busy && styles.disabled]}
          disabled={Boolean(busy)}
          onPress={() => openStoreThenEnter("shopify")}
        >
          {busy === "shopify" ? (
            <ActivityIndicator color={colors.goldDeep} />
          ) : (
            <Text style={styles.btnSecondaryText}>تسجيل الدخول بالبريد</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.btnPrimary, busy && styles.disabled]}
          disabled={Boolean(busy)}
          onPress={onGuest}
        >
          {busy === "guest" ? (
            <ActivityIndicator color={colors.charcoal} />
          ) : (
            <Text style={styles.btnPrimaryText}>الدخول كزائر الآن</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          إذا ظهرت صفحة المتجر: أكمل الدخول ثم أغلقها — أو استخدم «الدخول كزائر
          الآن» للوصول للتطبيق مباشرة.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.charcoal,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.ivory,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(196,163,90,0.18)",
    top: -50,
    left: -40,
  },
  brand: {
    fontSize: 34,
    letterSpacing: 6,
    fontWeight: "600",
    color: colors.goldDeep,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  tag: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "center",
  },
  sub: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  btnPrimary: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  btnPrimaryText: { color: colors.charcoal, fontWeight: "800", fontSize: 16 },
  btnGoogle: {
    backgroundColor: "#4285F4",
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 10,
  },
  btnGoogleText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnFacebook: {
    backgroundColor: "#1877F2",
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 10,
  },
  btnFacebookText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnSecondary: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondaryText: { color: colors.goldDeep, fontWeight: "800", fontSize: 15 },
  hint: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 18,
  },
  disabled: { opacity: 0.55 },
});
