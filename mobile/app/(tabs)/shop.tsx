import { Image } from "expo-image";
import { useRouter } from "expo-router";
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
import {
  CatalogCollection,
  CatalogProduct,
  fetchCollections,
  fetchProducts,
} from "@/src/api/catalog";
import { colors, spacing } from "@/src/theme";

export default function ShopScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<CatalogCollection[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [collection, setCollection] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextCollection?: string, q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [cols, catalog] = await Promise.all([
        fetchCollections(),
        fetchProducts({
          collection: nextCollection,
          q: q?.trim() || undefined,
          first: 30,
        }),
      ]);
      setCollections(cols);
      setProducts(catalog.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المتجر");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="ابحث عن منتج…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          textAlign="right"
          onSubmitEditing={() => load(collection, query)}
          returnKeyType="search"
        />
        <Pressable style={styles.searchBtn} onPress={() => load(collection, query)}>
          <Text style={styles.searchBtnText}>بحث</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={[{ id: "all", title: "الكل", handle: "" }, ...collections]}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => {
          const active =
            (!collection && !item.handle) || collection === item.handle;
          return (
            <Pressable
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                const next = item.handle || undefined;
                setCollection(next);
                load(next, query);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.title}
              </Text>
            </Pressable>
          );
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
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
            <Text style={styles.empty}>لا توجد منتجات مطابقة.</Text>
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
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.price}>
                {item.price ? `${item.price} ${item.currency || "JOD"}` : ""}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  searchRow: {
    flexDirection: "row-reverse",
    gap: spacing.sm,
    padding: spacing.md,
  },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.charcoal,
  },
  searchBtn: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  searchBtnText: { fontWeight: "800", color: colors.charcoal },
  chips: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginEnd: 8,
  },
  chipActive: { backgroundColor: colors.gold },
  chipText: { color: colors.goldDeep, fontWeight: "700" },
  chipTextActive: { color: colors.charcoal },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { padding: spacing.md, paddingBottom: 40 },
  gridRow: { gap: 12 },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    marginBottom: 12,
    maxWidth: "48%",
  },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.beige },
  imageEmpty: { opacity: 0.6 },
  title: {
    paddingHorizontal: 10,
    paddingTop: 8,
    fontWeight: "700",
    color: colors.charcoal,
    textAlign: "right",
    minHeight: 40,
  },
  price: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    color: colors.goldDeep,
    fontWeight: "800",
    textAlign: "right",
  },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  error: {
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
});
