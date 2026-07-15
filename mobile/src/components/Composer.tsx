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
        blurOnSubmit={false}
        returnKeyType="default"
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.cream,
    color: colors.charcoal,
    fontSize: 16,
    textAlignVertical: "top",
  },
  send: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    paddingVertical: 14,
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
