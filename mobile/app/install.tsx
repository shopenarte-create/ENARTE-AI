import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/src/theme";

/** Direct Android APK download (sideload). */
const ANDROID_APK_URL = (
  process.env.EXPO_PUBLIC_ANDROID_APK_URL ||
  "https://enarte-ai-production.up.railway.app/download/enarte.apk"
).trim();

function detectPlatform(): "ios" | "android" | "other" {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function InstallScreen() {
  const platform = useMemo(() => detectPlatform(), []);
  const [apkAvailable, setApkAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(ANDROID_APK_URL, { method: "HEAD", cache: "no-store" });
        if (!cancelled) setApkAvailable(res.ok);
      } catch {
        if (!cancelled) setApkAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function startAndroidDownload() {
    if (Platform.OS !== "web") return;
    if (!apkAvailable) {
      setMessage(
        "ملف التطبيق قيد التجهيز. بعد رفع نسخة Android سيبدأ التحميل مباشرة من هذا الزر.",
      );
      return;
    }
    setMessage("جاري بدء التحميل… بعد انتهاء التنزيل افتحوا الملف وثبّتوه.");
    // Force download / open installer
    window.location.assign(ANDROID_APK_URL);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "top"]}>
      <Stack.Screen options={{ title: "حمّل التطبيق", headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>ENARTE</Text>
        <View style={styles.card}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.icon}
          />
          <Text style={styles.title}>حمّل تطبيق ENARTE</Text>
          <Text style={styles.sub}>
            حمّل التطبيق الآن لتصلك آخر العروض والخصومات والموديلات الحديثة
          </Text>

          {platform === "android" || platform === "other" ? (
            <Pressable style={styles.btnPrimary} onPress={startAndroidDownload}>
              <Text style={styles.btnPrimaryText}>
                {apkAvailable === false
                  ? "التحميل المباشر قريباً"
                  : "تحميل التطبيق للأندرويد"}
              </Text>
            </Pressable>
          ) : null}

          {platform === "ios" ? (
            <View style={styles.hint}>
              <Text style={styles.hintTitle}>آيفون</Text>
              <Text style={styles.hintBody}>
                تحميل آيفون يتطلب نشر التطبيق على App Store. حالياً يمكنكم فتح
                النسخة من المتصفح أو إضافتها للشاشة الرئيسية من Safari.
              </Text>
            </View>
          ) : null}

          <Pressable
            style={styles.btnSecondary}
            onPress={() => {
              if (Platform.OS === "web") window.location.assign("/app/");
            }}
          >
            <Text style={styles.btnSecondaryText}>فتح التطبيق في المتصفح</Text>
          </Pressable>

          <Pressable onPress={() => Linking.openURL("https://enarteshop.com")}>
            <Text style={styles.link}>العودة للمتجر</Text>
          </Pressable>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.foot}>
            التحميل المباشر = ملف تطبيق Android (APK). بعد التحميل قد يطلب الهاتف
            السماح بتثبيت تطبيقات من هذا المصدر.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.charcoal },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
    alignItems: "center",
  },
  brand: {
    letterSpacing: 6,
    color: colors.gold,
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 16,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: 12,
    alignItems: "center",
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "center",
  },
  sub: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 15,
    marginBottom: 4,
  },
  btnPrimary: {
    width: "100%",
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  btnPrimaryText: { color: colors.charcoal, fontWeight: "800", fontSize: 16 },
  btnSecondary: {
    width: "100%",
    backgroundColor: colors.charcoal,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  link: {
    color: colors.goldDeep,
    fontWeight: "700",
    marginTop: 4,
    paddingVertical: 8,
  },
  message: {
    width: "100%",
    backgroundColor: "rgba(196,163,90,0.16)",
    borderRadius: radii.md,
    padding: 12,
    color: colors.charcoal,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "700",
  },
  hint: {
    width: "100%",
    backgroundColor: colors.ivory,
    borderRadius: radii.md,
    padding: 14,
    gap: 6,
  },
  hintTitle: {
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  hintBody: {
    color: colors.ink,
    textAlign: "right",
    lineHeight: 24,
    fontSize: 14,
  },
  foot: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 20,
    marginTop: 4,
  },
});
