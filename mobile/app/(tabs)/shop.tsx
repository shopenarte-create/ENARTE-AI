import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  CatalogCollection,
  CatalogProduct,
  fetchCollections,
  fetchProducts,
} from "@/src/api/catalog";
import { colors, radii, spacing } from "@/src/theme";
import { collectionLabel } from "@/src/utils/collectionLabel";

export default function ShopScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ collection?: string }>();
  const [collections, setCollections] = useState<CatalogCollection[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [collection, setCollection] = useState<string | undefined>(
    params.collection ? String(params.collection) : undefined,
  );
  const [query, setQuery] = useState("");
  const [loadingCols, setLoadingCols] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCollections = useCallback(async () => {
    setLoadingCols(true);
    setError(null);
    try {
      const cols = await fetchCollections();
      setCollections(cols);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network_error");
      setCollections([]);
    } finally {
      setLoadingCols(false);
    }
  }, []);

  const loadProducts = useCallback(async (handle: string, q?: string) => {
    setLoadingProducts(true);
    setError(null);
    try {
      const catalog = await fetchProducts({
        collection: handle,
        q: q?.trim() || undefined,
        first: 40,
      });
      setProducts(catalog.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network_error");
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    const initial = params.collection ? String(params.collection) : undefined;
    if (initial) {
      setCollection(initial);
      loadProducts(initial);
    }
  }, [params.collection, loadProducts]);

  function openSection(handle: string) {
    setCollection(handle);
    setQuery("");
    loadProducts(handle);
  }

  function backToSections() {
    setCollection(undefined);
    setProducts([]);
    setQuery("");
    setError(null);
  }

  const activeTitle = collection
    ? collectionLabel(
        collections.find((c) => c.handle === collection)?.title || collection,
        collection,
      )
    : "المتجر";

  // Section browser (no "All" icon — only real product departments)
  if (!collection) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.header}>
          <Pressable style={styles.settingsBtn} onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={22} color={colors.charcoal} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>ENARTE</Text>
            <Text style={styles.heading}>أقسام المنتجات</Text>
            <Text style={styles.sub}>اختَر القسم لعرض المنتجات</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error === "network_error" ? "تعذر الاتصال — أعد المحاولة" : error}</Text>
            <Pressable style={styles.retry} onPress={loadCollections}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : null}

        {loadingCols ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.goldDeep} />
          </View>
        ) : (
          <FlatList
            data={collections}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={
              <Text style={styles.empty}>لا توجد أقسام حالياً.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.sectionCard}
                onPress={() => openSection(item.handle)}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.sectionImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.sectionImage, styles.sectionFallback]} />
                )}
                <View style={styles.sectionOverlay}>
                  <Text style={styles.sectionTitle} numberOfLines={2}>
                    {collectionLabel(item.title, item.handle)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // Products inside a department
  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={backToSections}>
          <Ionicons name="arrow-forward" size={20} color={colors.charcoal} />
          <Text style={styles.backText}>الأقسام</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>ENARTE</Text>
          <Text style={styles.heading}>{activeTitle}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="ابحث داخل القسم…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          textAlign="right"
          onSubmitEditing={() => collection && loadProducts(collection, query)}
          returnKeyType="search"
        />
        <Pressable
          style={styles.searchBtn}
          onPress={() => collection && loadProducts(collection, query)}
        >
          <Text style={styles.searchBtnText}>بحث</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorInline}>{error === "network_error" ? "تعذر تحميل المنتجات" : error}</Text> : null}

      {loadingProducts ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.goldDeep} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={
            <Text style={styles.empty}>لا توجد منتجات في هذا القسم.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/product/[handle]",
                  params: { handle: item.handle },
                })
              }
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, styles.imageEmpty]} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.price}>
                  {item.price ? `${item.price} ${item.currency || "JOD"}` : ""}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
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
  backBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  backText: { fontWeight: "700", color: colors.charcoal },
  brand: {
    color: colors.goldDeep,
    letterSpacing: 4,
    fontWeight: "700",
    fontSize: 12,
    textAlign: "right",
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  sub: { color: colors.muted, textAlign: "right", fontSize: 13 },
  searchRow: {
    flexDirection: "row-reverse",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.charcoal,
  },
  searchBtn: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchBtnText: { fontWeight: "800", color: colors.charcoal },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { padding: spacing.md, paddingBottom: 40 },
  gridRow: { gap: 12 },
  sectionCard: {
    flex: 1,
    maxWidth: "48%",
    height: 150,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sectionImage: { width: "100%", height: "100%" },
  sectionFallback: { backgroundColor: colors.beige },
  sectionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    backgroundColor: "rgba(28,25,20,0.58)",
  },
  sectionTitle: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    fontSize: 14,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    overflow: "hidden",
    marginBottom: 12,
    maxWidth: "48%",
    borderWidth: 1,
    borderColor: colors.line,
  },
  image: { width: "100%", aspectRatio: 0.92, backgroundColor: colors.beige },
  imageEmpty: { opacity: 0.6 },
  cardBody: { padding: 12, gap: 4 },
  title: {
    fontWeight: "700",
    color: colors.charcoal,
    textAlign: "right",
    minHeight: 40,
    fontSize: 14,
    lineHeight: 20,
  },
  price: {
    color: colors.goldDeep,
    fontWeight: "800",
    textAlign: "right",
  },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  errorBox: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(138,47,47,0.08)",
    gap: 10,
    alignItems: "center",
  },
  error: { color: colors.danger, textAlign: "center" },
  errorInline: {
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.md,
    marginBottom: 6,
  },
  retry: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: { fontWeight: "800", color: colors.charcoal },
});
