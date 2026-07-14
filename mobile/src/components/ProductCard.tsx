import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { ProductCard as ProductCardType } from "../api/assistant";
import { useCart } from "../cart/CartContext";
import { colors, spacing } from "../theme";

type Props = {
  card: ProductCardType;
  onSelect?: (card: ProductCardType) => void;
  disabled?: boolean;
};

function variantNumericId(card: ProductCardType) {
  const raw =
    (card as any).variantNumericId ||
    (card as any).selectedVariantNumericId ||
    (card as any).variantId ||
    card.id;
  const match = String(raw || "").match(/(\d+)\s*$/);
  return match ? match[1] : null;
}

export default function ProductCard({ card, onSelect, disabled }: Props) {
  const router = useRouter();
  const { addLine } = useCart();
  const price =
    card.price != null && card.price !== ""
      ? `${card.price} ${card.currency || "JOD"}`.trim()
      : null;
  const numericId = variantNumericId(card);
  const handle =
    (card as any).handle ||
    String(card.url || "").split("/products/")[1]?.split("?")[0] ||
    null;

  return (
    <View style={styles.card}>
      {card.image ? (
        <Image source={{ uri: String(card.image) }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.imageEmpty]} />
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {card.title}
        </Text>
        {price ? <Text style={styles.price}>{price}</Text> : null}
        {card.matchReason ? (
          <Text style={styles.reason} numberOfLines={2}>
            {card.matchReason}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {onSelect ? (
            <Pressable
              style={[styles.btn, styles.btnPrimary, disabled && styles.btnDisabled]}
              disabled={disabled}
              onPress={() => onSelect(card)}
            >
              <Text style={styles.btnPrimaryText}>اختَر</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.btn, styles.btnPrimary, disabled && styles.btnDisabled]}
            disabled={disabled}
            onPress={async () => {
              let variantNumeric = numericId;
              let variantId = String((card as any).variantId || card.id);
              let price = String(card.price || "0");
              let resolvedHandle = handle;
              if (!variantNumeric) {
                try {
                  const { fetchProduct } = await import("../api/catalog");
                  const product = await fetchProduct(
                    handle ? { handle } : { id: String(card.id) },
                  );
                  variantNumeric = product.selectedVariantNumericId || null;
                  variantId = String(product.selectedVariantId || product.id);
                  price = String(product.price || price);
                  resolvedHandle = product.handle || resolvedHandle;
                } catch {
                  return;
                }
              }
              if (!variantNumeric) return;
              addLine({
                productId: String(card.id),
                productTitle: card.title,
                handle: resolvedHandle,
                image: card.image ? String(card.image) : null,
                variantId,
                variantNumericId: variantNumeric,
                price,
                currency: String(card.currency || "JOD"),
                url: card.url ? String(card.url) : null,
                quantity: 1,
              });
            }}
          >
            <Text style={styles.btnPrimaryText}>أضف للسلة</Text>
          </Pressable>
          {handle ? (
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() =>
                router.push({
                  pathname: "/product/[handle]",
                  params: { handle },
                })
              }
            >
              <Text style={styles.btnGhostText}>تفاصيل</Text>
            </Pressable>
          ) : card.url ? (
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() => Linking.openURL(String(card.url))}
            >
              <Text style={styles.btnGhostText}>عرض في المتجر</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    marginEnd: spacing.sm,
  },
  image: {
    width: "100%",
    height: 150,
    backgroundColor: colors.beige,
  },
  imageEmpty: {
    opacity: 0.7,
  },
  body: {
    padding: spacing.sm,
    gap: 4,
  },
  title: {
    color: colors.charcoal,
    fontWeight: "700",
    fontSize: 14,
    textAlign: "right",
  },
  price: {
    color: colors.goldDeep,
    fontWeight: "700",
    fontSize: 13,
    textAlign: "right",
  },
  reason: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
  actions: {
    marginTop: 6,
    gap: 6,
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  btnPrimary: {
    backgroundColor: colors.gold,
  },
  btnPrimaryText: {
    color: colors.charcoal,
    fontWeight: "700",
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.cream,
  },
  btnGhostText: {
    color: colors.goldDeep,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
