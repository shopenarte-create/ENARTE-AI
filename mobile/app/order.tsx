import { Stack, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CLIQ_PAYMENT,
  CUSTOMER_ACK_AR,
  JORDAN_GOVERNORATES,
  PAYMENT_METHODS,
  orderErrorMessage,
  type PaymentMethod,
  submitMobileOrder,
} from "@/src/api/orders";
import { useCart } from "@/src/cart/CartContext";
import { colors, radii, spacing } from "@/src/theme";

export default function OrderScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const notesRef = useRef<TextInputType>(null);
  const { lines, count, subtotal, currency, clear, checkoutUrl } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    orderId: string;
    customerMessage: string;
    paymentMethod: PaymentMethod;
  } | null>(null);

  const canSubmit = useMemo(() => {
    return (
      lines.length > 0 &&
      name.trim().length >= 2 &&
      phone.replace(/\D/g, "").length >= 9 &&
      Boolean(governorate) &&
      Boolean(paymentMethod)
    );
  }, [lines.length, name, phone, governorate, paymentMethod]);

  function scrollFieldIntoView() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }

  async function onSubmit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await submitMobileOrder({
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          governorate,
          address: address.trim(),
        },
        items: lines,
        paymentMethod,
        note: note.trim(),
      });
      if (!data.ok || !data.orderId) {
        setError(data.message || data.error || "تعذر إرسال الطلب");
        return;
      }
      setDone({
        orderId: data.orderId,
        customerMessage: data.customerMessage || CUSTOMER_ACK_AR,
        paymentMethod: data.paymentMethod || paymentMethod,
      });
      clear();
    } catch (err) {
      setError(orderErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!lines.length && !done) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={{ title: "إتمام الطلب" }} />
        <View style={styles.center}>
          <Text style={styles.empty}>السلة فارغة</Text>
          <Pressable style={styles.btnPrimary} onPress={() => router.push("/shop")}>
            <Text style={styles.btnPrimaryText}>تصفّح المتجر</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    const isCliq = done.paymentMethod === "cliq";
    const isOnline = done.paymentMethod === "online";
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Stack.Screen options={{ title: "تم استلام الطلب" }} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>ENARTE</Text>
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>تم استلام طلبكم</Text>
            <Text style={styles.successBody}>{done.customerMessage}</Text>
            <Text style={styles.orderId}>رقم الطلب: {done.orderId}</Text>
            <Text style={styles.payChosen}>
              طريقة الدفع:{" "}
              {PAYMENT_METHODS.find((p) => p.id === done.paymentMethod)?.title ||
                done.paymentMethod}
            </Text>
          </View>

          {isCliq ? (
            <View style={styles.cliqCard}>
              <Text style={styles.cliqTitle}>حوّل عبر كليك (CliQ)</Text>
              <Text style={styles.cliqLabel}>الرقم</Text>
              <Text style={styles.cliqValue} selectable>
                {CLIQ_PAYMENT.phone}
              </Text>
              <Text style={styles.cliqLabel}>اسم الحساب</Text>
              <Text style={styles.cliqValue}>{CLIQ_PAYMENT.accountName}</Text>
              <Text style={styles.cliqHint}>
                بعد التحويل سنتواصل معكم لتأكيد الاستلام وموعد التسليم.
              </Text>
            </View>
          ) : null}

          {isOnline && checkoutUrl ? (
            <Pressable
              style={styles.btnPrimary}
              onPress={() =>
                router.push({
                  pathname: "/checkout",
                  params: { url: encodeURIComponent(checkoutUrl) },
                })
              }
            >
              <Text style={styles.btnPrimaryText}>متابعة للدفع الإلكتروني</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.btnGhost}
            onPress={() => router.replace("/shop")}
          >
            <Text style={styles.btnGhostText}>متابعة التسوق</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen options={{ title: "بيانات الطلب" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>إتمام الشراء</Text>
          <Text style={styles.sub}>
            {count} منتج — المجموع {subtotal.toFixed(2)} {currency}
          </Text>
          <Text style={styles.hint}>
            أدخلوا بياناتكم واختاروا طريقة الدفع. نستلم الطلب في المتجر ونبدأ
            التجهيز ثم نتواصل معكم للتسليم.
          </Text>

          <Text style={styles.label}>الاسم الكامل *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="مثال: أحمد محمد"
            placeholderTextColor={colors.muted}
            textAlign="right"
            returnKeyType="next"
          />

          <Text style={styles.label}>رقم الهاتف *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="07XXXXXXXX"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            textAlign="right"
          />

          <Text style={styles.label}>المحافظة *</Text>
          <View style={styles.govGrid}>
            {JORDAN_GOVERNORATES.map((g) => {
              const active = governorate === g;
              return (
                <Pressable
                  key={g}
                  style={[styles.govChip, active && styles.govChipActive]}
                  onPress={() => setGovernorate(g)}
                >
                  <Text style={[styles.govText, active && styles.govTextActive]}>{g}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>تفاصيل العنوان (اختياري)</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={address}
            onChangeText={setAddress}
            placeholder="المنطقة / الشارع / أقرب معلم"
            placeholderTextColor={colors.muted}
            textAlign="right"
            multiline
            onFocus={scrollFieldIntoView}
          />

          <Text style={styles.label}>طريقة الدفع *</Text>
          <View style={styles.payList}>
            {PAYMENT_METHODS.map((method, index) => {
              const active = paymentMethod === method.id;
              return (
                <Pressable
                  key={method.id}
                  style={[styles.payOption, active && styles.payOptionActive]}
                  onPress={() => setPaymentMethod(method.id)}
                >
                  <View style={styles.payRow}>
                    <View style={[styles.radio, active && styles.radioActive]} />
                    <View style={styles.payTexts}>
                      <Text style={[styles.payTitle, active && styles.payTitleActive]}>
                        {index + 1}. {method.title}
                      </Text>
                      <Text style={styles.payDetail}>{method.detail}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>ملاحظات (اختياري)</Text>
          <TextInput
            ref={notesRef}
            style={[styles.input, styles.area]}
            value={note}
            onChangeText={setNote}
            placeholder="لون الإضاءة، موعد التركيب..."
            placeholderTextColor={colors.muted}
            textAlign="right"
            multiline
            onFocus={scrollFieldIntoView}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.btnPrimary, (!canSubmit || busy) && styles.disabled]}
            disabled={!canSubmit || busy}
            onPress={onSubmit}
          >
            {busy ? (
              <ActivityIndicator color={colors.charcoal} />
            ) : (
              <Text style={styles.btnPrimaryText}>تأكيد واستلام الطلب</Text>
            )}
          </Pressable>

          <View style={styles.keyboardSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: 10, paddingBottom: 24 },
  keyboardSpacer: { height: 220 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: 16,
  },
  brand: {
    textAlign: "center",
    letterSpacing: 5,
    fontWeight: "600",
    color: colors.goldDeep,
    fontSize: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "right",
  },
  sub: { color: colors.muted, textAlign: "right", marginBottom: 4 },
  hint: {
    color: colors.ink,
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 8,
    fontSize: 13,
  },
  label: {
    textAlign: "right",
    fontWeight: "700",
    color: colors.charcoal,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.charcoal,
    fontSize: 15,
  },
  area: { minHeight: 80, textAlignVertical: "top" },
  govGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  govChip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  govChipActive: {
    borderColor: colors.goldDeep,
    backgroundColor: "rgba(196,163,90,0.18)",
  },
  govText: { color: colors.charcoal, fontWeight: "600" },
  govTextActive: { color: colors.goldDeep, fontWeight: "800" },
  payList: { gap: 8 },
  payOption: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 14,
  },
  payOptionActive: {
    borderColor: colors.goldDeep,
    backgroundColor: "rgba(196,163,90,0.12)",
  },
  payRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.line,
    marginTop: 2,
  },
  radioActive: {
    borderColor: colors.goldDeep,
    backgroundColor: colors.gold,
  },
  payTexts: { flex: 1, gap: 4 },
  payTitle: {
    textAlign: "right",
    fontWeight: "700",
    color: colors.charcoal,
    fontSize: 15,
  },
  payTitleActive: { color: colors.goldDeep },
  payDetail: {
    textAlign: "right",
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  btnPrimary: {
    marginTop: 12,
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnPrimaryText: { color: colors.charcoal, fontWeight: "800", fontSize: 16 },
  btnGhost: { paddingVertical: 14, alignItems: "center" },
  btnGhostText: { color: colors.muted, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  error: { color: colors.danger, textAlign: "right", fontWeight: "700" },
  empty: { color: colors.muted, fontSize: 16 },
  successCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: 10,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "center",
  },
  successBody: {
    color: colors.ink,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 15,
  },
  orderId: {
    textAlign: "center",
    color: colors.goldDeep,
    fontWeight: "800",
    marginTop: 4,
  },
  payChosen: {
    textAlign: "center",
    color: colors.muted,
    fontWeight: "600",
    marginTop: 4,
  },
  cliqCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.goldDeep,
    padding: spacing.lg,
    gap: 6,
  },
  cliqTitle: {
    textAlign: "center",
    fontWeight: "800",
    fontSize: 17,
    color: colors.charcoal,
    marginBottom: 8,
  },
  cliqLabel: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  cliqValue: {
    textAlign: "center",
    color: colors.charcoal,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 6,
  },
  cliqHint: {
    textAlign: "center",
    color: colors.ink,
    lineHeight: 22,
    marginTop: 6,
    fontSize: 13,
  },
});
