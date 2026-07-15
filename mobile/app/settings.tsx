import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth/AuthContext";
import { openShopifyAccountAuth } from "@/src/auth/socialAuth";
import { STORE_URL } from "@/src/config";
import { SOCIAL } from "@/src/config/social";
import { colors, radii, spacing } from "@/src/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const {
    mode,
    displayName,
    email,
    provider,
    isGuest,
    markSignedIn,
    signOut,
  } = useAuth();

  async function openAccount(kind: "login" | "register") {
    await openShopifyAccountAuth(kind);
    await markSignedIn({
      displayName: kind === "register" ? "عميل جديد" : displayName || "عميل ENARTE",
      provider: "shopify",
      email,
    });
    router.replace("/(tabs)");
  }

  async function onSignOut() {
    await signOut();
    router.replace("/welcome");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "الإعدادات" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>ENARTE</Text>
        <Text style={styles.pageTitle}>إعدادات التطبيق</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="person-outline" size={20} color={colors.goldDeep} />
            <Text style={styles.cardTitle}>الحساب</Text>
          </View>
          <Text style={styles.aboutBody}>
            {isGuest
              ? "أنت متصفح حالياً كزائر. يمكنك إنشاء حساب أو تسجيل الدخول في أي وقت."
              : `مسجّل كـ ${displayName || "عميل ENARTE"}${
                  email ? `\n${email}` : ""
                }${
                  provider && provider !== "shopify" && provider !== "guest"
                    ? `\nعبر ${provider === "google" ? "Google" : "Facebook"}`
                    : ""
                }`}
          </Text>
          {isGuest || mode === "account" ? (
            <View style={{ gap: 8 }}>
              {isGuest ? (
                <>
                  <Pressable style={styles.accountBtn} onPress={() => openAccount("register")}>
                    <Text style={styles.accountBtnText}>إنشاء حساب</Text>
                  </Pressable>
                  <Pressable style={styles.accountBtnOutline} onPress={() => openAccount("login")}>
                    <Text style={styles.accountBtnOutlineText}>تسجيل الدخول</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={styles.accountBtnOutline} onPress={() => openAccount("login")}>
                    <Text style={styles.accountBtnOutlineText}>إدارة الحساب في المتجر</Text>
                  </Pressable>
                  <Pressable style={styles.accountBtnGhost} onPress={onSignOut}>
                    <Text style={styles.accountBtnGhostText}>تسجيل الخروج / الدخول كزائر</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="notifications-outline" size={20} color={colors.goldDeep} />
            <Text style={styles.cardTitle}>الإشعارات</Text>
          </View>
          <Text style={styles.aboutBody}>
            استقبل تنبيهات عن العروض المتوفرة والمنتجات المضافة حديثاً، وراجعها من
            مركز الإشعارات.
          </Text>
          <Pressable style={styles.linkRow} onPress={() => router.push("/notifications")}>
            <Text style={styles.linkText}>فتح مركز الإشعارات</Text>
            <Ionicons name="chevron-back" size={18} color={colors.goldDeep} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="sparkles-outline" size={20} color={colors.goldDeep} />
            <Text style={styles.cardTitle}>عنا</Text>
          </View>
          <Text style={styles.aboutBody}>
            إنارتي هي وجهتك الأولى للإضاءة والديكور في الأردن — حلول عصرية للمنازل
            والمكاتب والحدائق والمساحات التجارية، بجودة راقية وتصميم أنيق وخدمة
            استثنائية.
          </Text>
          <Pressable style={styles.linkRow} onPress={() => router.push("/shop")}>
            <Text style={styles.linkText}>تسوق الأقسام</Text>
            <Ionicons name="chevron-back" size={18} color={colors.goldDeep} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="call-outline" size={20} color={colors.goldDeep} />
            <Text style={styles.cardTitle}>اتصل بنا</Text>
          </View>

          <ContactRow
            icon="call"
            label="للتواصل معنا"
            value={SOCIAL.contactPhoneDisplay}
            onPress={() => Linking.openURL(SOCIAL.contactPhoneTel)}
          />
          <ContactRow
            icon="logo-whatsapp"
            label="واتساب التواصل"
            value={SOCIAL.contactPhoneDisplay}
            onPress={() => Linking.openURL(SOCIAL.contactWhatsApp)}
          />
          <ContactRow
            icon="construct-outline"
            label="للمعاينة والتركيب"
            value={SOCIAL.installPhoneDisplay}
            onPress={() => Linking.openURL(SOCIAL.installPhoneTel)}
          />
          <ContactRow
            icon="logo-whatsapp"
            label="واتساب المعاينة والتركيب"
            value={SOCIAL.installPhoneDisplay}
            onPress={() => Linking.openURL(SOCIAL.installWhatsApp)}
          />
          <ContactRow
            icon="mail-outline"
            label="البريد"
            value="info@enarteshop.com"
            onPress={() => Linking.openURL(SOCIAL.email)}
          />
          <ContactRow
            icon="location-outline"
            label="العنوان"
            value={SOCIAL.address}
          />
          <ContactRow
            icon="globe-outline"
            label="الموقع الإلكتروني"
            value="enarteshop.com"
            onPress={() => Linking.openURL(STORE_URL)}
          />

          <View style={styles.socialRow}>
            <Pressable
              style={[styles.socialBtn, styles.socialFb]}
              onPress={() => Linking.openURL(SOCIAL.facebook)}
              accessibilityLabel="فيسبوك ENARTE"
            >
              <Ionicons name="logo-facebook" size={22} color="#fff" />
            </Pressable>
            <Pressable
              style={[styles.socialBtn, styles.socialIg]}
              onPress={() => Linking.openURL(SOCIAL.instagram)}
              accessibilityLabel="إنستغرام ENARTE"
            >
              <Ionicons name="logo-instagram" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.version}>ENARTE Mobile · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.goldDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="open-outline" size={16} color={colors.muted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  brand: {
    textAlign: "center",
    letterSpacing: 5,
    fontWeight: "600",
    color: colors.goldDeep,
    fontSize: 22,
  },
  pageTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: colors.charcoal,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 12,
  },
  cardHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.charcoal,
  },
  aboutBody: {
    color: colors.muted,
    lineHeight: 24,
    textAlign: "right",
    fontSize: 14,
  },
  linkRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  linkText: { color: colors.goldDeep, fontWeight: "800" },
  accountBtn: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  accountBtnText: { color: colors.charcoal, fontWeight: "800" },
  accountBtnOutline: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  accountBtnOutlineText: { color: colors.goldDeep, fontWeight: "800" },
  accountBtnGhost: {
    paddingVertical: 10,
    alignItems: "center",
  },
  accountBtnGhostText: { color: colors.muted, fontWeight: "700" },
  socialRow: {
    flexDirection: "row-reverse",
    gap: 12,
    marginTop: 8,
    justifyContent: "center",
  },
  socialBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  socialFb: { backgroundColor: "#1877F2" },
  socialIg: { backgroundColor: "#E4405F" },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(196,163,90,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
  },
  rowValue: {
    color: colors.charcoal,
    fontWeight: "700",
    textAlign: "right",
    fontSize: 14,
  },
  version: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
});
