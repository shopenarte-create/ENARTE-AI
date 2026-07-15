import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNotifications,
  type AppNotification,
} from "@/src/notifications/NotificationsContext";
import { colors, radii, spacing } from "@/src/theme";

function kindMeta(kind: AppNotification["kind"]) {
  if (kind === "offer") {
    return { icon: "pricetag" as const, label: "عرض", color: "#9a7b3c" };
  }
  if (kind === "new_product") {
    return { icon: "sparkles" as const, label: "جديد", color: "#2f6b4f" };
  }
  return { icon: "notifications" as const, label: "تنبيه", color: colors.muted };
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ar-JO", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    items,
    unreadCount,
    syncing,
    markRead,
    markAllRead,
    clearAll,
    syncCatalogAlerts,
    prefs,
    permissionGranted,
    requestPermission,
    setPrefs,
    nativeSupported,
  } = useNotifications();

  const ordered = useMemo(
    () => [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [items],
  );

  async function openItem(item: AppNotification) {
    await markRead(item.id);
    if (item.handle) {
      router.push({ pathname: "/product/[handle]", params: { handle: item.handle } });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "الإشعارات" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>ENARTE</Text>
        <Text style={styles.pageTitle}>مركز الإشعارات</Text>
        <Text style={styles.sub}>
          تنبيهات عن العروض المتوفرة والمنتجات المضافة حديثاً إلى المتجر.
        </Text>

        <View style={styles.toolbar}>
          <Pressable style={styles.toolBtn} onPress={() => syncCatalogAlerts()} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator color={colors.goldDeep} size="small" />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color={colors.goldDeep} />
                <Text style={styles.toolBtnText}>تحديث</Text>
              </>
            )}
          </Pressable>
          {unreadCount > 0 ? (
            <Pressable style={styles.toolBtn} onPress={() => markAllRead()}>
              <Text style={styles.toolBtnText}>تعليممييز الكل كمقروء</Text>
            </Pressable>
          ) : null}
          {ordered.length ? (
            <Pressable style={styles.toolBtnGhost} onPress={() => clearAll()}>
              <Text style={styles.toolBtnGhostText}>مسح</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.prefsCard}>
          <Text style={styles.prefsTitle}>إعدادات التنبيه</Text>
          <PrefRow
            label="تفعيل الإشعارات"
            value={prefs.enabled}
            onToggle={async (next) => {
              if (next && permissionGranted !== true) await requestPermission();
              await setPrefs({ enabled: next });
            }}
          />
          <PrefRow
            label="العروض والخصومات"
            value={prefs.offers}
            onToggle={(next) => setPrefs({ offers: next })}
          />
          <PrefRow
            label="المنتجات الجديدة"
            value={prefs.newProducts}
            onToggle={(next) => setPrefs({ newProducts: next })}
          />
          {permissionGranted === false && nativeSupported ? (
            <Pressable style={styles.permissionBtn} onPress={() => requestPermission()}>
              <Text style={styles.permissionText}>السماح بإشعارات الجهاز</Text>
            </Pressable>
          ) : null}
          {!nativeSupported ? (
            <Text style={styles.expoGoNote}>
              في Expo Go تظهر التنبيهات داخل مركز الإشعارات فقط (بدون إشعار نظام
              Android).
            </Text>
          ) : null}
        </View>

        {!ordered.length ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={36} color={colors.goldDeep} />
            <Text style={styles.emptyTitle}>لا إشعارات بعد</Text>
            <Text style={styles.emptyBody}>
              عندما يتوفر عرض جديد أو يُضاف منتج إلى المتجر، سيظهر هنا ويصلك تنبيه على
              الجهاز.
            </Text>
          </View>
        ) : (
          ordered.map((item) => {
            const meta = kindMeta(item.kind);
            return (
              <Pressable
                key={item.id}
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => openItem(item)}
              >
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.kind, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBodyText} numberOfLines={3}>
                    {item.body}
                  </Text>
                </View>
                {!item.read ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PrefRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (next: boolean) => void | Promise<void>;
}) {
  return (
    <Pressable style={styles.prefRow} onPress={() => onToggle(!value)}>
      <Text style={styles.prefLabel}>{label}</Text>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 48 },
  brand: {
    textAlign: "center",
    letterSpacing: 5,
    fontWeight: "600",
    color: colors.goldDeep,
    fontSize: 22,
  },
  pageTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: colors.charcoal,
  },
  sub: {
    textAlign: "center",
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 4,
  },
  toolbar: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  toolBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 72,
    justifyContent: "center",
  },
  toolBtnText: { color: colors.goldDeep, fontWeight: "700", fontSize: 13 },
  toolBtnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolBtnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  prefsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 10,
  },
  prefsTitle: {
    textAlign: "right",
    fontWeight: "800",
    color: colors.charcoal,
    fontSize: 15,
  },
  prefRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  prefLabel: { color: colors.ink, fontWeight: "600", textAlign: "right" },
  switch: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#d6d0c6",
    padding: 3,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: colors.gold },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  knobOn: { alignSelf: "flex-end" },
  permissionBtn: {
    marginTop: 4,
    backgroundColor: colors.charcoal,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  permissionText: { color: colors.cream, fontWeight: "800" },
  expoGoNote: {
    color: colors.muted,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 12,
  },
  emptyTitle: { fontWeight: "800", fontSize: 17, color: colors.charcoal },
  emptyBody: {
    textAlign: "center",
    color: colors.muted,
    lineHeight: 22,
  },
  card: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    alignItems: "flex-start",
  },
  cardUnread: {
    borderColor: "rgba(196,163,90,0.55)",
    backgroundColor: "#fffcf5",
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.beige,
  },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 2 },
  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kind: { fontWeight: "800", fontSize: 12 },
  when: { color: colors.muted, fontSize: 11 },
  cardTitle: {
    textAlign: "right",
    fontWeight: "800",
    color: colors.charcoal,
    fontSize: 15,
  },
  cardBodyText: {
    textAlign: "right",
    color: colors.muted,
    lineHeight: 20,
    fontSize: 13,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.goldDeep,
    marginTop: 6,
  },
});
