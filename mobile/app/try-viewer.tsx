import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBrowser } from "@/src/components/AppBrowser";
import { colors, radii, spacing } from "@/src/theme";

export default function TryViewerScreen() {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const tryUrl = useMemo(() => {
    try {
      return url ? decodeURIComponent(String(url)) : "";
    } catch {
      return String(url || "");
    }
  }, [url]);
  const [loading, setLoading] = useState(true);

  if (!tryUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "تجربة الإضاءة" }} />
        <View style={styles.center}>
          <Text style={styles.error}>رابط التجربة غير متوفر</Text>
          <Pressable style={styles.btn} onPress={() => router.back()}>
            <Text style={styles.btnText}>رجوع</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "جرّبها بغرفتك", headerBackTitle: "رجوع" }} />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.goldDeep} />
          <Text style={styles.loaderText}>جاري فتح الاستوديو داخل التطبيق…</Text>
        </View>
      ) : null}
      <AppBrowser
        source={{ uri: tryUrl }}
        style={styles.web}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  web: { flex: 1, backgroundColor: colors.charcoal },
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
  loaderText: { color: colors.muted, fontSize: 13 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  btnText: { fontWeight: "800", color: colors.charcoal },
  error: { color: colors.danger },
});
