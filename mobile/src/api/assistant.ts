import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_LOCALE, SHOP_DOMAIN } from "../config";
import { apiFetch } from "./client";

export type SmartAction = {
  id: string;
  label: string;
};

export type ProductCard = {
  id: string;
  title: string;
  image?: string | null;
  price?: string | number | null;
  currency?: string | null;
  url?: string | null;
  collection?: string | null;
  matchReason?: string | null;
  rank?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  type?: string;
  content?: string;
  actions?: SmartAction[];
  cards?: ProductCard[];
  meta?: Record<string, unknown>;
};

type SessionResponse = {
  ok: boolean;
  session?: { id: string };
  messages?: ChatMessage[];
  actions?: SmartAction[];
  error?: string;
  note?: string;
};

type MessageResponse = {
  ok: boolean;
  transcript?: ChatMessage[];
  messages?: ChatMessage[];
  userMessage?: ChatMessage;
  supportOffer?: boolean;
  error?: string;
};

function sessionStorageKey(shop: string) {
  return `enarte_assistant_session:${String(shop || "default").toLowerCase()}`;
}

export async function readStoredSessionId(shop = SHOP_DOMAIN) {
  try {
    return (await AsyncStorage.getItem(sessionStorageKey(shop))) || null;
  } catch {
    return null;
  }
}

export async function storeSessionId(shop: string, id: string | null) {
  try {
    const key = sessionStorageKey(shop);
    if (id) await AsyncStorage.setItem(key, id);
    else await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function listActions(locale = DEFAULT_LOCALE) {
  const data = await apiFetch<{ ok: boolean; actions: SmartAction[] }>(
    `/api/assistant/actions?locale=${encodeURIComponent(locale)}`,
  );
  return data.actions || [];
}

export async function startSession({
  shop = SHOP_DOMAIN,
  locale = DEFAULT_LOCALE,
  resume = true,
}: {
  shop?: string;
  locale?: string;
  resume?: boolean;
} = {}) {
  if (resume) {
    const storedId = await readStoredSessionId(shop);
    if (storedId) {
      try {
        const resumed = await apiFetch<SessionResponse>(
          `/api/assistant/sessions?id=${encodeURIComponent(storedId)}`,
        );
        if (resumed.ok && resumed.session?.id) {
          await storeSessionId(shop, resumed.session.id);
          return resumed;
        }
      } catch {
        await storeSessionId(shop, null);
      }
    }
  }

  const created = await apiFetch<SessionResponse>("/api/assistant/sessions", {
    method: "POST",
    body: JSON.stringify({ shop, locale, channel: "mobile" }),
  });

  if (created.ok && created.session?.id) {
    await storeSessionId(shop, created.session.id);
  }
  return created;
}

export async function sendMessage(input: {
  sessionId: string;
  message?: string;
  actionId?: string;
  locale?: string;
  shop?: string;
  image?: { mimeType?: string; dataUrl?: string; base64?: string } | null;
  selectedProduct?: ProductCard | null;
  escalate?: boolean;
}) {
  return apiFetch<MessageResponse>("/api/assistant/messages", {
    method: "POST",
    body: JSON.stringify({
      sessionId: input.sessionId,
      message: input.message,
      actionId: input.actionId,
      locale: input.locale || DEFAULT_LOCALE,
      shop: input.shop || SHOP_DOMAIN,
      image: input.image || undefined,
      selectedProduct: input.selectedProduct || undefined,
      escalate: Boolean(input.escalate),
    }),
  });
}
