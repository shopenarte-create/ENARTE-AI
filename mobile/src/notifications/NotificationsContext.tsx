import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { fetchProducts, type CatalogProduct } from "../api/catalog";
import {
  canUseNativeNotifications,
  getDevicePermissionGranted,
  presentLocalNotification,
  requestDevicePermission,
} from "./deviceNotify";

const INBOX_KEY = "enarte_notifications_inbox_v1";
const SEEN_KEY = "enarte_notifications_seen_v1";
const OFFER_KEY = "enarte_notifications_offers_v1";
const PREFS_KEY = "enarte_notifications_prefs_v1";

export type AppNotificationKind = "offer" | "new_product" | "info";

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  handle?: string | null;
  image?: string | null;
  productId?: string | null;
};

export type NotificationPrefs = {
  enabled: boolean;
  offers: boolean;
  newProducts: boolean;
};

type SeenState = {
  seeded: boolean;
  productIds: string[];
};

type OfferState = {
  seeded: boolean;
  offerIds: string[];
};

type Ctx = {
  ready: boolean;
  items: AppNotification[];
  unreadCount: number;
  prefs: NotificationPrefs;
  permissionGranted: boolean | null;
  syncing: boolean;
  nativeSupported: boolean;
  requestPermission: () => Promise<boolean>;
  setPrefs: (patch: Partial<NotificationPrefs>) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  syncCatalogAlerts: () => Promise<void>;
};

const defaultPrefs: NotificationPrefs = {
  enabled: true,
  offers: true,
  newProducts: true,
};

const NotificationsContext = createContext<Ctx | null>(null);

function isOnOffer(product: CatalogProduct) {
  return Boolean(
    product.variants?.some((v) => {
      const compare = Number.parseFloat(String(v.compareAtPrice || ""));
      const price = Number(v.priceAmount ?? Number.parseFloat(String(v.price || "")));
      return Number.isFinite(compare) && Number.isFinite(price) && compare > price;
    }),
  );
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [prefs, setPrefsState] = useState<NotificationPrefs>(defaultPrefs);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    canUseNativeNotifications() ? null : false,
  );
  const [syncing, setSyncing] = useState(false);
  const syncLock = useRef(false);
  const itemsRef = useRef<AppNotification[]>([]);
  const prefsRef = useRef(prefs);
  const permissionRef = useRef(permissionGranted);
  const nativeSupported = canUseNativeNotifications();

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    permissionRef.current = permissionGranted;
  }, [permissionGranted]);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.read).length,
    [items],
  );

  const persistInbox = useCallback(async (next: AppNotification[]) => {
    const clipped = next.slice(0, 80);
    itemsRef.current = clipped;
    setItems(clipped);
    await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(clipped));
  }, []);

  const requestPermission = useCallback(async () => {
    if (!nativeSupported) {
      setPermissionGranted(false);
      return false;
    }
    const granted = await requestDevicePermission();
    setPermissionGranted(granted);
    return granted;
  }, [nativeSupported]);

  const setPrefs = useCallback(async (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefsState(next);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      const next = itemsRef.current.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      await persistInbox(next);
    },
    [persistInbox],
  );

  const markAllRead = useCallback(async () => {
    const next = itemsRef.current.map((n) => ({ ...n, read: true }));
    await persistInbox(next);
  }, [persistInbox]);

  const clearAll = useCallback(async () => {
    await persistInbox([]);
  }, [persistInbox]);

  const syncCatalogAlerts = useCallback(async () => {
    if (syncLock.current) return;
    syncLock.current = true;
    setSyncing(true);
    try {
      const data = await fetchProducts({ first: 40 });
      const products = data.products || [];
      const productIds = products.map((p) => p.id);
      const offerProducts = products.filter(isOnOffer);
      const offerIds = offerProducts.map((p) => p.id);

      const seenRaw = await AsyncStorage.getItem(SEEN_KEY);
      const offerRaw = await AsyncStorage.getItem(OFFER_KEY);
      const seen: SeenState = seenRaw
        ? JSON.parse(seenRaw)
        : { seeded: false, productIds: [] };
      const offers: OfferState = offerRaw
        ? JSON.parse(offerRaw)
        : { seeded: false, offerIds: [] };

      if (!seen.seeded) {
        await AsyncStorage.setItem(
          SEEN_KEY,
          JSON.stringify({ seeded: true, productIds }),
        );
        await AsyncStorage.setItem(
          OFFER_KEY,
          JSON.stringify({ seeded: true, offerIds }),
        );

        const currentPrefs = prefsRef.current;
        if (
          currentPrefs.enabled &&
          currentPrefs.offers &&
          offerProducts.length > 0 &&
          itemsRef.current.length === 0
        ) {
          const sample = offerProducts[0];
          const now = new Date().toISOString();
          const intro: AppNotification = {
            id: `offer-summary:${now}`,
            kind: "offer",
            title: "عروض متوفرة الآن",
            body:
              offerProducts.length === 1
                ? `عرض على «${sample.title}» — اطّلع عليه من التطبيق`
                : `${offerProducts.length} عروض متوفرة حالياً، منها «${sample.title}»`,
            createdAt: now,
            read: false,
            handle: sample.handle,
            image: sample.image || null,
            productId: sample.id,
          };
          await persistInbox([intro]);
          if (nativeSupported) {
            await presentLocalNotification(intro.title, intro.body, {
              screen: "notifications",
            });
          }
        }
        return;
      }

      const known = new Set(seen.productIds || []);
      const knownOffers = new Set(offers.offerIds || []);
      const created: AppNotification[] = [];
      const now = new Date().toISOString();
      const currentPrefs = prefsRef.current;

      if (currentPrefs.enabled && currentPrefs.newProducts) {
        const fresh = products.filter((p) => !known.has(p.id)).slice(0, 5);
        for (const product of fresh) {
          created.push({
            id: `new:${product.id}:${now}`,
            kind: "new_product",
            title: "منتج جديد في ENARTE",
            body: `أُضيف «${product.title}» إلى المتجر`,
            createdAt: now,
            read: false,
            handle: product.handle,
            image: product.image || null,
            productId: product.id,
          });
        }
      }

      if (currentPrefs.enabled && currentPrefs.offers) {
        const freshOffers = offerProducts
          .filter((p) => !knownOffers.has(p.id))
          .slice(0, 5);
        for (const product of freshOffers) {
          created.push({
            id: `offer:${product.id}:${now}`,
            kind: "offer",
            title: "عرض جديد متوفر",
            body: `خصم على «${product.title}» — تصفّح العرض الآن`,
            createdAt: now,
            read: false,
            handle: product.handle,
            image: product.image || null,
            productId: product.id,
          });
        }
      }

      if (created.length) {
        await persistInbox([...created, ...itemsRef.current].slice(0, 80));

        if (currentPrefs.enabled && nativeSupported) {
          const granted =
            permissionRef.current === true
              ? true
              : await requestPermission();
          if (granted) {
            const offerCount = created.filter((n) => n.kind === "offer").length;
            const newCount = created.filter((n) => n.kind === "new_product").length;
            const title =
              offerCount && newCount
                ? "جديد في ENARTE"
                : offerCount
                  ? "عروض ENARTE"
                  : "منتجات جديدة";
            const body =
              offerCount && newCount
                ? `${newCount} منتج جديد و${offerCount} عرض متوفر`
                : offerCount
                  ? created.find((n) => n.kind === "offer")?.body ||
                    `${offerCount} عرض جديد`
                  : created.find((n) => n.kind === "new_product")?.body ||
                    `${newCount} منتج جديد`;
            await presentLocalNotification(title, body, {
              screen: "notifications",
              count: created.length,
            });
          }
        }
      }

      await AsyncStorage.setItem(
        SEEN_KEY,
        JSON.stringify({
          seeded: true,
          productIds: Array.from(new Set([...known, ...productIds])).slice(-200),
        }),
      );
      await AsyncStorage.setItem(
        OFFER_KEY,
        JSON.stringify({
          seeded: true,
          offerIds: Array.from(new Set([...knownOffers, ...offerIds])).slice(-200),
        }),
      );
    } catch {
      // Inbox stays usable offline.
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, [nativeSupported, persistInbox, requestPermission]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const timeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
          Promise.race([
            p,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
          ]);

        const [inboxRaw, prefsRaw] = await Promise.all([
          timeout(AsyncStorage.getItem(INBOX_KEY), 800, null),
          timeout(AsyncStorage.getItem(PREFS_KEY), 800, null),
        ]);
        if (!alive) return;
        if (inboxRaw) {
          const parsed = JSON.parse(inboxRaw) as AppNotification[];
          itemsRef.current = parsed;
          setItems(parsed);
        }
        if (prefsRaw) {
          const next = { ...defaultPrefs, ...JSON.parse(prefsRaw) };
          prefsRef.current = next;
          setPrefsState(next);
        }

        if (nativeSupported) {
          const granted = await timeout(getDevicePermissionGranted(), 1200, false);
          if (alive) setPermissionGranted(granted);
        } else if (alive) {
          setPermissionGranted(false);
        }
      } catch {
        // ignore
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [nativeSupported]);

  useEffect(() => {
    if (!ready) return;
    void syncCatalogAlerts();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncCatalogAlerts();
    });
    return () => sub.remove();
  }, [ready, syncCatalogAlerts]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      items,
      unreadCount,
      prefs,
      permissionGranted,
      syncing,
      nativeSupported,
      requestPermission,
      setPrefs,
      markRead,
      markAllRead,
      clearAll,
      syncCatalogAlerts,
    }),
    [
      ready,
      items,
      unreadCount,
      prefs,
      permissionGranted,
      syncing,
      nativeSupported,
      requestPermission,
      setPrefs,
      markRead,
      markAllRead,
      clearAll,
      syncCatalogAlerts,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
