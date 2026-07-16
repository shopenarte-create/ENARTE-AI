import { Stack } from "expo-router";
import { useEffect, useState } from "react";
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

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallScreen() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [platformHint, setPlatformHint] = useState<"ios" | "android" | "other">(
    "other",
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatformHint("ios");
    else if (/Android/i.test(ua)) setPlatformHint("android");
    else setPlatformHint("other");

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) {
      window.location.replace("/app/");
      return;
    }

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMessage(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/app/sw.js", { scope: "/app/" })
        .catch(() => {});
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  async function onInstall() {
    if (Platform.OS !== "web") {
      setMessage("افتحوا هذه الصفحة من متصفح الهاتف للتثبيت.");
      return;
    }

    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        setDeferred(null);
        if (choice.outcome === "accepted") {
          setMessage("تم بدء التثبيت. ستجدون ENARTE على الشاشة الرئيسية.");
        } else {
          setMessage("تم إلغاء التثبيت. يمكنكم المحاولة مرة أخرى.");
        }
      } catch {
        setMessage("تعذر فتح نافذة التثبيت. استخدموا قائمة المتصفح.");
      }
      return;
    }

    if (platformHint === "ios") {
      setMessage(
        "على الآيفون: اضغطوا مشاركة □↑ ثم «إضافة إلى الشاشة الرئيسية».",
      );
      return;
    }

    if (platformHint === "android") {
      setMessage(
        "افتحوا قائمة Chrome ⋮ ثم اختاروا «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",
      );
      // Nudge Chrome: leave and return sometimes helps surface the menu item.
      return;
    }

    setMessage("افتحوا الرابط من هاتفكم لتثبيت التطبيق على الشاشة الرئيسية.");
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

          <Pressable style={styles.btnPrimary} onPress={onInstall}>
            <Text style={styles.btnPrimaryText}>
              {deferred ? "تثبيت على الهاتف" : "تثبيت على الهاتف"}
            </Text>
          </Pressable>

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

          {platformHint === "ios" ? (
            <View style={styles.hint}>
              <Text style={styles.hintTitle}>على الآيفون (Safari)</Text>
              <Text style={styles.hintBody}>
                1) اضغطوا زر المشاركة □↑{"\n"}
                2) اختاروا «إضافة إلى الشاشة الرئيسية»{"\n"}
                3) ثم اضغطوا «إضافة»
              </Text>
            </View>
          ) : null}

          {platformHint === "android" ? (
            <View style={styles.hint}>
              <Text style={styles.hintTitle}>على الأندرويد (Chrome)</Text>
              <Text style={styles.hintBody}>
                1) اضغطوا زر «تثبيت على الهاتف» أعلاه إن ظهرت نافذة التثبيت{"\n"}
                2) أو من القائمة ⋮ اختاروا «تثبيت التطبيق» / «إضافة إلى الشاشة
                الرئيسية»
              </Text>
            </View>
          ) : null}

          <Text style={styles.foot}>
            متوفر حالياً كتطبيق ويب قابل للتثبيت. روابط Google Play و App Store
            ستُضاف لاحقاً.
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
