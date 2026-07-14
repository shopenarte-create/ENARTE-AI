import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChatMessage,
  ProductCard as ProductCardType,
  SmartAction,
  sendMessage,
  startSession,
} from "@/src/api/assistant";
import { DEFAULT_LOCALE, SHOP_DOMAIN } from "@/src/config";
import Composer from "@/src/components/Composer";
import MessageBubble from "@/src/components/MessageBubble";
import { colors, spacing } from "@/src/theme";

function humanizeError(code: string) {
  const map: Record<string, string> = {
    invalid_json: "حصل خلل بالاتصال — أعد الإرسال من فضلك.",
    session_not_found: "انتهت الجلسة — نبدأ محادثة جديدة.",
    network_error: "مشكلة بالشبكة — تحقق من الاتصال.",
    send_failed: "تعذر إرسال الرسالة — حاول مرة أخرى.",
    shop_required: "إعداد المتجر غير مكتمل.",
  };
  return map[code] || "حدث خطأ غير متوقع.";
}

export default function AssistantScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const boot = useCallback(async () => {
    setBooting(true);
    setError(null);
    try {
      const data = await startSession({
        shop: SHOP_DOMAIN,
        locale: DEFAULT_LOCALE,
        resume: true,
      });
      if (!data.ok || !data.session?.id) {
        setError(humanizeError(data.error || "session_failed"));
        return;
      }
      setSessionId(data.session.id);
      setMessages(data.messages || []);
    } catch (err) {
      setError(humanizeError(err instanceof Error ? err.message : "network_error"));
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  const scrollEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const send = useCallback(
    async (payload: {
      message?: string;
      actionId?: string;
      selectedProduct?: ProductCardType | null;
      image?: { mimeType?: string; dataUrl?: string } | null;
    }) => {
      if (!sessionId || busy) return;
      setBusy(true);
      setError(null);

      const optimistic: ChatMessage = {
        id: `optimistic_${Date.now()}`,
        role: "user",
        content:
          payload.message ||
          (payload.actionId
            ? "تم اختيار إجراء"
            : payload.image
              ? "تم إرسال صورة"
              : ""),
        meta: { optimistic: true },
      };
      if (optimistic.content) {
        setMessages((prev) => [...prev, optimistic]);
        scrollEnd();
      }

      try {
        let data = await sendMessage({
          sessionId,
          locale: DEFAULT_LOCALE,
          shop: SHOP_DOMAIN,
          ...payload,
        });

        if (data.error === "session_not_found") {
          const fresh = await startSession({
            shop: SHOP_DOMAIN,
            locale: DEFAULT_LOCALE,
            resume: false,
          });
          if (fresh.ok && fresh.session?.id) {
            setSessionId(fresh.session.id);
            data = await sendMessage({
              sessionId: fresh.session.id,
              locale: DEFAULT_LOCALE,
              shop: SHOP_DOMAIN,
              ...payload,
            });
          }
        }

        if (data.transcript) {
          setMessages(data.transcript);
        } else {
          setMessages((prev) => {
            const withoutOptimistic = prev.filter((m) => !m.meta?.optimistic);
            return [
              ...withoutOptimistic,
              ...(data.userMessage ? [data.userMessage] : []),
              ...(data.messages || []),
            ];
          });
        }

        if (!data.ok && !data.messages?.length && !data.transcript) {
          setError(humanizeError(data.error || "send_failed"));
        }
        setDraft("");
        scrollEnd();
      } catch (err) {
        setMessages((prev) => prev.filter((m) => !m.meta?.optimistic));
        setError(humanizeError(err instanceof Error ? err.message : "network_error"));
      } finally {
        setBusy(false);
        scrollEnd();
      }
    },
    [sessionId, busy, scrollEnd],
  );

  const onPickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("يلزم إذن الوصول للصور.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.75,
      base64: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    const dataUrl = asset.base64
      ? `data:${mimeType};base64,${asset.base64}`
      : undefined;
    if (!dataUrl) {
      setError("تعذر قراءة الصورة.");
      return;
    }
    await send({ image: { mimeType, dataUrl } });
  }, [send]);

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.goldDeep} size="large" />
        <Text style={styles.hint}>جاري فتح مستشار ENARTE…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item, index) => item.id || `msg_${index}`}
        contentContainerStyle={styles.list}
        onContentSizeChange={scrollEnd}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            busy={busy}
            onAction={(action: SmartAction) => send({ actionId: action.id })}
            onSelectProduct={(card) => send({ selectedProduct: card })}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>ابدأ المحادثة أو اختَر إجراءً ذكياً.</Text>
        }
      />
      <Composer
        value={draft}
        onChange={setDraft}
        disabled={busy || !sessionId}
        onSend={() => send({ message: draft.trim() })}
        onPickImage={onPickImage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ivory,
    gap: spacing.md,
  },
  hint: {
    color: colors.muted,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  empty: {
    textAlign: "center",
    color: colors.muted,
    marginTop: spacing.xl,
  },
  errorBox: {
    backgroundColor: "rgba(138,47,47,0.08)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    textAlign: "right",
  },
});
