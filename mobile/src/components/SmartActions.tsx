import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { SmartAction } from "../api/assistant";
import { colors, spacing } from "../theme";

type Props = {
  actions: SmartAction[];
  disabled?: boolean;
  onPress: (action: SmartAction) => void;
};

export default function SmartActions({ actions, disabled, onPress }: Props) {
  if (!actions?.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {actions.map((action) => (
        <Pressable
          key={action.id}
          style={[styles.chip, disabled && styles.chipDisabled]}
          disabled={disabled}
          onPress={() => onPress(action)}
        >
          <Text style={styles.chipText}>{action.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
  },
  chip: {
    backgroundColor: colors.white,
    borderColor: colors.gold,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: colors.goldDeep,
    fontWeight: "700",
    fontSize: 13,
  },
});
