import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CatalogCollection,
  CatalogProduct,
  fetchCollections,
  fetchProducts,
} from "@/src/api/catalog";
import { useCart } from "@/src/cart/CartContext";
import { SOCIAL } from "@/src/config/social";
import { useNotifications } from "@/src/notifications/NotificationsContext";
import { colors, radii, spacing } from "@/src/theme";
import { collectionEmoji, collectionLabel } from "@/src/utils/collectionLabel";

const CONTACT_WHATSAPP = SOCIAL.contactWhatsApp;
const CONTACT_PHONE = SOCIAL.contactPhoneTel;
const INSTALL_PHONE = SOCIAL.installPhoneTel;
const INSTALL_WHATSAPP = SOCIAL.installWhatsApp;

export default function HomeScreen() {
  const router = useRouter();
  const { count } = useCart();
  const { unreadCount } = useNotifications();
  const [collections, setCollections] = useState<CatalogCollection[]>([]);
  const [featured, setFeatured] = useState<CatalogProduct[]>([]);
  const [sale, setSale] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cols, products] = await Promise.all([
        fetchCollections(),
        fetchProducts({ first: 24 }),
      ]);
      setCollections(cols.slice(0, 10));
      const list = products.products || [];
      const discounted = list.filter((p) =>
        Boolean(
          p.variants?.some(
            (v) =>
              v.compareAtPrice &&
              v.priceAmount != null &&
              Number(v.compareAtPrice) > Number(v.priceAmount),
          ),
        ),
      );
      setSale((discounted.length ? discounted : list).slice(0, 8));
      setFeatured(list.slice(0, 8));
    } catch {
      setCollections([]);
      setFeatured([]);
      setSale([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openProduct(handle: string) {
    router.push({ pathname: "/product/[handle]", params: { handle } });
  }

  function openCollection(handle: string) {
    router.push({ pathname: "/shop", params: { collection: handle } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.settingsBtn} onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={22} color={colors.charcoal} />
          </Pressable>
          <Pressable style={styles.settingsBtn} onPress={() => router.push("/notifications")}>
            <Ionicons name="notifications-outline" size={22} color={colors.charcoal} />
            {unreadCount > 0 ? (
              <View style={styles.badgeDot}>
                <Text style={styles.badgeDotText}>
                  {unreadCount > 9 ? "9+" : String(unreadCount)}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={styles.topHint}>الإشعارات والإعدادات</Text>
        </View>

        {/* 1) Cover */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.brand}>ENARTE</Text>
          <Text style={styles.heroTag}>إضاءة فاخرة لمساحاتك</Text>
          <Text style={styles.heroTitle}>حيث تلتقي الإضاءة{"\n"}بالفخامة والجمال</Text>
          <Text style={styles.heroSub}>
            مجموعات حصرية من الثريات والإضاءة الفاخرة — تسوّق وجرّب وادفع داخل التطبيق.
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.btnGold} onPress={() => router.push("/shop")}>
              <Text style={styles.btnGoldText}>تسوق الآن</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => router.push("/cart")}>
              <Text style={styles.btnGhostText}>السلة ({count})</Text>
            </Pressable>
          </View>
        </View>

        {/* 2) Categories as icon cards */}
        <SectionTitle title="تسوق حسب الفئة" actionLabel="الكل" onAction={() => router.push("/shop")} />
        {loading ? (
          <ActivityIndicator color={colors.goldDeep} style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRow}
          >
            {collections.map((col) => {
              const label = collectionLabel(col.title, col.handle);
              return (
                <Pressable
                  key={col.id}
                  style={styles.catCard}
                  onPress={() => openCollection(col.handle)}
                >
                  {col.image ? (
                    <Image source={{ uri: col.image }} style={styles.catImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.catImage, styles.catFallback]}>
                      <Text style={styles.catEmoji}>
                        {collectionEmoji(col.title, col.handle)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.catOverlay}>
                    <Text style={styles.catLabel} numberOfLines={2}>
                      {label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* 3) Sale / offers */}
        <SectionTitle
          title="التصفية والخصومات"
          subtitle="عروض وقطع مختارة"
          actionLabel="المزيد"
          onAction={() => router.push("/shop")}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hRow}
        >
          {sale.map((p) => (
            <ProductTile key={`sale-${p.id}`} product={p} onPress={() => openProduct(p.handle)} badge="عرض" />
          ))}
        </ScrollView>

        {/* 4) Smart assistants */}
        <SectionTitle
          title="تجربة ENARTE الذكية"
          subtitle="ابحث، استشر، وجرّب الإضاءة قبل الشراء"
        />
        <View style={styles.smartCol}>
          <SmartCard
            title="ابحث بالصورة"
            body="ارفع صورة أي ثريا ونجد لك ما يشبهها داخل المتجر"
            cta="ابحث الآن"
            dark={false}
            onPress={() => router.push("/image-search")}
          />
          <SmartCard
            title="ENARTE AI"
            body="مساعدك الذكي لاختيار الإضاءة المثالية لمساحتك"
            cta="تحدث الآن"
            dark={false}
            onPress={() => router.push("/assistant")}
          />
          <SmartCard
            title="جرّبها بغرفتك"
            body="شاهد كيف ستبدو الإضاءة في مساحتك"
            cta="جرب الآن"
            dark
            onPress={() => router.push("/try")}
          />
        </View>

        {/* 5) Featured products */}
        <SectionTitle
          title="منتجات مميزة"
          actionLabel="عرض الكل"
          onAction={() => router.push("/shop")}
        />
        <View style={styles.featuredGrid}>
          {featured.slice(0, 4).map((p) => (
            <Pressable
              key={p.id}
              style={styles.featuredCard}
              onPress={() => openProduct(p.handle)}
            >
              {p.image ? (
                <Image source={{ uri: p.image }} style={styles.featuredImg} contentFit="cover" />
              ) : (
                <View style={[styles.featuredImg, styles.catFallback]} />
              )}
              <Text style={styles.featuredTitle} numberOfLines={2}>
                {p.title}
              </Text>
              <Text style={styles.featuredPrice}>
                {p.price ? `${p.price} ${p.currency || "JOD"}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 6) Preview & install */}
        <View style={styles.service}>
          <Text style={styles.serviceEyebrow}>خدمة ENARTE</Text>
          <Text style={styles.serviceTitle}>اطلب معاينة أو تركيب</Text>
          <Text style={styles.serviceBody}>
            فريق متخصص لمعاينة المساحة وتركيب الإضاءة باحتراف في الأردن.
          </Text>
          <View style={styles.serviceActions}>
            <Pressable style={styles.btnGold} onPress={() => Linking.openURL(INSTALL_PHONE)}>
              <Text style={styles.btnGoldText}>اتصال للتركيب</Text>
            </Pressable>
            <Pressable
              style={styles.btnWhatsApp}
              onPress={() => Linking.openURL(INSTALL_WHATSAPP)}
            >
              <Text style={styles.btnWhatsAppText}>واتساب التركيب</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => Linking.openURL(CONTACT_PHONE)}>
            <Text style={styles.serviceContactHint}>للتواصل العام: 079 240 4023</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(CONTACT_WHATSAPP)}>
            <Text style={styles.serviceContactHint}>واتساب التواصل: 079 240 4023</Text>
          </Pressable>
          <Text style={styles.serviceContactHint}>معاينة وتركيب: 00962782404023</Text>
          <View style={styles.socialRow}>
            <Pressable
              style={[styles.socialBtn, styles.socialFb]}
              onPress={() => Linking.openURL(SOCIAL.facebook)}
              accessibilityLabel="فيسبوك ENARTE"
            >
              <Ionicons name="logo-facebook" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={[styles.socialBtn, styles.socialIg]}
              onPress={() => Linking.openURL(SOCIAL.instagram)}
              accessibilityLabel="إنستغرام ENARTE"
            >
              <Ionicons name="logo-instagram" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SmartCard({
  title,
  body,
  cta,
  dark,
  onPress,
}: {
  title: string;
  body: string;
  cta: string;
  dark?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.smartCard, dark && styles.smartCardDark]}
      onPress={onPress}
    >
      <Text style={[styles.smartTitle, dark && styles.smartTitleDark]}>{title}</Text>
      <Text style={[styles.smartBody, dark && styles.smartBodyDark]}>{body}</Text>
      <View style={[styles.smartCta, dark && styles.smartCtaDark]}>
        <Text style={[styles.smartCtaText, dark && styles.smartCtaTextDark]}>{cta}</Text>
      </View>
    </Pressable>
  );
}

function ProductTile({
  product,
  onPress,
  badge,
}: {
  product: CatalogProduct;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      {product.image ? (
        <Image source={{ uri: product.image }} style={styles.tileImg} contentFit="cover" />
      ) : (
        <View style={[styles.tileImg, styles.catFallback]} />
      )}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.tileTitle} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={styles.tilePrice}>
        {product.price ? `${product.price} ${product.currency || "JOD"}` : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  scroll: { paddingBottom: 36 },
  topBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    position: "absolute",
    top: -4,
    left: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.goldDeep,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeDotText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  topHint: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  hero: {
    margin: spacing.md,
    backgroundColor: colors.charcoal,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: 8,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(196,163,90,0.2)",
    top: -50,
    left: -30,
  },
  brand: {
    fontSize: 32,
    letterSpacing: 6,
    fontWeight: "600",
    color: colors.gold,
    textAlign: "center",
  },
  heroTag: {
    color: "rgba(247,243,236,0.65)",
    textAlign: "center",
    fontSize: 12,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.cream,
    textAlign: "center",
  },
  heroSub: {
    color: "rgba(247,243,236,0.7)",
    textAlign: "center",
    lineHeight: 21,
    fontSize: 13,
  },
  heroActions: {
    marginTop: 10,
    flexDirection: "row-reverse",
    gap: 10,
  },
  btnGold: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnGoldText: { color: colors.charcoal, fontWeight: "800" },
  btnGhost: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnGhostText: { color: colors.gold, fontWeight: "800" },
  sectionHead: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  sectionSub: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
    marginTop: 2,
  },
  sectionAction: { color: colors.goldDeep, fontWeight: "700", fontSize: 13 },
  hRow: {
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  catCard: {
    width: 118,
    height: 140,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.line,
  },
  catImage: { width: "100%", height: "100%" },
  catFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.beige,
  },
  catEmoji: { fontSize: 34 },
  catOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    backgroundColor: "rgba(28,25,20,0.55)",
  },
  catLabel: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
  },
  tile: {
    width: 150,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  tileImg: { width: "100%", aspectRatio: 1, backgroundColor: colors.beige },
  tileTitle: {
    paddingHorizontal: 10,
    paddingTop: 8,
    fontWeight: "700",
    color: colors.charcoal,
    textAlign: "right",
    minHeight: 40,
    fontSize: 13,
  },
  tilePrice: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    color: colors.goldDeep,
    fontWeight: "800",
    textAlign: "right",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: colors.charcoal },
  smartCol: {
    marginHorizontal: spacing.md,
    gap: 12,
  },
  smartCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 6,
  },
  smartCardDark: {
    backgroundColor: colors.charcoal,
    borderColor: "rgba(196,163,90,0.35)",
  },
  smartTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  smartTitleDark: { color: colors.gold },
  smartBody: {
    color: colors.muted,
    textAlign: "right",
    lineHeight: 20,
    fontSize: 13,
  },
  smartBodyDark: { color: "rgba(247,243,236,0.7)" },
  smartCta: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: colors.beige,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smartCtaDark: { backgroundColor: colors.gold },
  smartCtaText: { color: colors.goldDeep, fontWeight: "800", fontSize: 13 },
  smartCtaTextDark: { color: colors.charcoal },
  featuredGrid: {
    marginHorizontal: spacing.md,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
  },
  featuredCard: {
    width: "48%",
    flexGrow: 1,
    maxWidth: "48%",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  featuredImg: { width: "100%", aspectRatio: 1, backgroundColor: colors.beige },
  featuredTitle: {
    paddingHorizontal: 10,
    paddingTop: 8,
    fontWeight: "700",
    color: colors.charcoal,
    textAlign: "right",
    minHeight: 40,
    fontSize: 13,
  },
  featuredPrice: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    color: colors.goldDeep,
    fontWeight: "800",
    textAlign: "right",
  },
  service: {
    margin: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.charcoal,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: 8,
  },
  serviceEyebrow: {
    color: colors.gold,
    fontWeight: "700",
    fontSize: 12,
    textAlign: "right",
  },
  serviceTitle: {
    color: colors.cream,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
  },
  serviceBody: {
    color: "rgba(247,243,236,0.7)",
    textAlign: "right",
    lineHeight: 22,
  },
  serviceActions: {
    marginTop: 8,
    flexDirection: "row-reverse",
    gap: 10,
  },
  serviceContactHint: {
    color: "rgba(247,243,236,0.75)",
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
  },
  socialRow: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 10,
    justifyContent: "center",
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  socialFb: { backgroundColor: "#1877F2" },
  socialIg: { backgroundColor: "#E4405F" },
  btnWhatsApp: {
    flex: 1,
    backgroundColor: "#25D366",
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnWhatsAppText: { color: "#fff", fontWeight: "800" },
});
