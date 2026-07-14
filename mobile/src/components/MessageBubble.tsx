import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ChatMessage, ProductCard as ProductCardType, SmartAction } from "../api/assistant";
import { colors, spacing } from "../theme";
import ProductCard from "./ProductCard";
import SmartActions from "./SmartActions";

type Props = {
  message: ChatMessage;
  busy?: boolean;
  onAction?: (action: SmartAction) => void;
  onSelectProduct?: (card: ProductCardType) => void;
};

export default function MessageBubble({
  message,
  busy,
  onAction,
  onSelectProduct,
}: Props) {
  const isUser = message.role === "user";
  const content = String(message.content || "").trim();

  if (message.type === "product_cards" && message.cards?.length) {
    return (
      <View style={styles.block}>
        {content ? <Text style={styles.assistantText}>{content}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {message.cards.map((card) => (
            <ProductCard
              key={card.id}
              card={card}
              disabled={busy}
              onSelect={onSelectProduct}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {content ? (
          <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
            {content}
          </Text>
        ) : null}
        {!isUser && message.actions?.length ? (
          <View style={styles.actionsWrap}>
            <SmartActions
              actions={message.actions}
              disabled={busy}
              onPress={(action) => onAction?.(action)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    marginBottom: spacing.sm,
    flexDirection: "row",
  },
  rowUser: {
    justifyContent: "flex-start",
  },
  rowAssistant: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleUser: {
    backgroundColor: colors.gold,
  },
  bubbleAssistant: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
  },
  textUser: {
    color: colors.charcoal,
    fontWeight: "600",
  },
  textAssistant: {
    color: colors.ink,
  },
  assistantText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
    marginBottom: 4,
  },
  actionsWrap: {
    marginTop: spacing.sm,
  },
});
