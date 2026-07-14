import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, spacing } from "../theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onPickImage?: () => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function Composer({
  value,
  onChange,
  onSend,
  onPickImage,
  disabled,
  placeholder = "اكتب رسالتك…",
}: Props) {
  return (
    <View style={styles.wrap}>
      {onPickImage ? (
        <Pressable
          style={[styles.iconBtn, disabled && styles.disabled]}
          disabled={disabled}
          onPress={onPickImage}
        >
          <Text style={styles.iconBtnText}>صورة</Text>
        </Pressable>
      ) : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        editable={!disabled}
        multiline
        textAlign="right"
      />
      <Pressable
        style={[styles.send, disabled && styles.disabled]}
        disabled={disabled || !value.trim()}
        onPress={onSend}
      >
        <Text style={styles.sendText}>إرسال</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cream,
    color: colors.charcoal,
    fontSize: 15,
  },
  send: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendText: {
    color: colors.charcoal,
    fontWeight: "800",
  },
  iconBtn: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: colors.cream,
  },
  iconBtnText: {
    color: colors.goldDeep,
    fontWeight: "700",
    fontSize: 12,
  },
  disabled: {
    opacity: 0.45,
  },
});
