import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STORE_URL } from "../config";

export type CartLine = {
  productId: string;
  productTitle: string;
  handle?: string | null;
  image?: string | null;
  variantId: string;
  variantNumericId: string;
  variantTitle?: string | null;
  price: string;
  currency: string;
  quantity: number;
  url?: string | null;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  currency: string;
  addLine: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
  checkoutUrl: string | null;
};

const STORAGE_KEY = "enarte_mobile_cart_v1";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines, ready]);

  const addLine = useCallback(
    (line: Omit<CartLine, "quantity"> & { quantity?: number }) => {
      const qty = Math.max(1, Number(line.quantity) || 1);
      setLines((prev) => {
        const idx = prev.findIndex((item) => item.variantId === line.variantId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            quantity: next[idx].quantity + qty,
          };
          return next;
        }
        return [...prev, { ...line, quantity: qty }];
      });
    },
    [],
  );

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((line) =>
          line.variantId === variantId
            ? { ...line, quantity: Math.max(0, quantity) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((line) => line.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce(
      (sum, line) => sum + Number(line.price || 0) * line.quantity,
      0,
    );
    const currency = lines[0]?.currency || "JOD";
    const parts = lines
      .map((line) =>
        line.variantNumericId
          ? `${line.variantNumericId}:${line.quantity}`
          : null,
      )
      .filter(Boolean);
    const checkoutUrl = parts.length
      ? `${STORE_URL}/cart/${parts.join(",")}`
      : null;

    return {
      lines,
      count,
      subtotal,
      currency,
      addLine,
      setQuantity,
      removeLine,
      clear,
      checkoutUrl,
    };
  }, [lines, addLine, setQuantity, removeLine, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
