import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { uploadRoomHandoff, webTryUrl } from "@/src/api/try-handoff";
import { STORE_URL } from "@/src/config";
import { colors, spacing } from "@/src/theme";

type Picked = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export default function TryScreen() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoffId, setHandoffId] = useState<string | null>(null);

  async function pick(fromCamera: boolean) {
    setError(null);
    setHandoffId(null);
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
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
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
        entry: "home",
      });
      if (!data.success || !data.handoffId) {
        setError(data.error || "تعذر حفظ صورة الغرفة.");
        return;
      }
      setHandoffId(data.handoffId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.content}>
        <Text style={styles.title}>جرب الإضاءة في غرفتك</Text>
        <Text style={styles.sub}>
          ارفع صورة للغرفة، ثم أكمل التجربة التفاعلية لمشاهدة الإضاءة قبل الشراء.
        </Text>

        <View style={styles.previewBox}>
          {picked ? (
            <Image source={{ uri: picked.uri }} style={styles.preview} contentFit="cover" />
          ) : (
            <Text style={styles.previewEmpty}>لا توجد صورة بعد</Text>
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
            <Text style={styles.btnPrimaryText}>رفع صورة الغرفة</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {handoffId ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>تم حفظ الصورة</Text>
            <Text style={styles.successBody}>
              افتح تجربة التركيب التفاعلية لإكمال اختيار الإضاءة على صورتك.
            </Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => Linking.openURL(webTryUrl(handoffId))}
            >
              <Text style={styles.btnPrimaryText}>متابعة التجربة</Text>
            </Pressable>
            <Pressable
              style={styles.linkBtn}
              onPress={() => Linking.openURL(STORE_URL)}
            >
              <Text style={styles.linkText}>تصفح المنتجات في المتجر</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  sub: {
    color: colors.muted,
    lineHeight: 22,
    textAlign: "right",
  },
  previewBox: {
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  previewEmpty: {
    color: colors.muted,
  },
  row: {
    flexDirection: "row-reverse",
    gap: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: colors.charcoal,
    fontWeight: "800",
    fontSize: 16,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: colors.goldDeep,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.45,
  },
  error: {
    color: colors.danger,
    textAlign: "right",
  },
  successCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  successTitle: {
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  successBody: {
    color: colors.muted,
    textAlign: "right",
    lineHeight: 22,
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: 6,
  },
  linkText: {
    color: colors.goldDeep,
    fontWeight: "700",
  },
});
