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
import type { SocialProvider } from "./socialAuth";

export type AuthMode = "guest" | "account";

type AuthState = {
  mode: AuthMode | null;
  displayName?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  provider?: SocialProvider | null;
};

type AuthContextValue = {
  ready: boolean;
  mode: AuthMode | null;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  provider: SocialProvider | null;
  isGuest: boolean;
  hasEntered: boolean;
  continueAsGuest: () => Promise<void>;
  markSignedIn: (profile: {
    displayName?: string | null;
    email?: string | null;
    photoUrl?: string | null;
    provider?: SocialProvider | null;
  }) => Promise<void>;
  signOut: () => Promise<void>;
};

const STORAGE_KEY = "enarte_mobile_auth_v2";
const LEGACY_KEY = "enarte_mobile_auth_v1";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AuthState>({ mode: null });

  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    // Never block app boot if storage hangs.
    const watchdog = setTimeout(finish, 1200);

    (async () => {
      try {
        const raw = await Promise.race([
          AsyncStorage.getItem(STORAGE_KEY),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
        ]);

        if (cancelled) return;

        if (raw) {
          const parsed = JSON.parse(raw) as AuthState;
          if (parsed?.mode === "guest" || parsed?.mode === "account") {
            setState({
              mode: parsed.mode,
              displayName: parsed.displayName || null,
              email: parsed.email || null,
              photoUrl: parsed.photoUrl || null,
              provider:
                parsed.provider ||
                (parsed.mode === "guest" ? "guest" : "shopify"),
            });
          }
        } else {
          const legacy = await Promise.race([
            AsyncStorage.getItem(LEGACY_KEY),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
          ]);
          if (legacy && !cancelled) {
            const parsed = JSON.parse(legacy) as AuthState;
            if (parsed?.mode === "guest" || parsed?.mode === "account") {
              setState({
                mode: parsed.mode,
                displayName: parsed.displayName || null,
                provider: parsed.mode === "guest" ? "guest" : "shopify",
              });
            }
          }
        }
      } catch {
        // ignore corrupt/unavailable storage
      } finally {
        clearTimeout(watchdog);
        finish();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
  }, []);

  const persist = useCallback(async (next: AuthState) => {
    setState(next);
    try {
      if (!next.mode) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // keep in-memory state even if persistence fails
    }
  }, []);

  const continueAsGuest = useCallback(async () => {
    await persist({
      mode: "guest",
      displayName: "زائر",
      provider: "guest",
      email: null,
      photoUrl: null,
    });
  }, [persist]);

  const markSignedIn = useCallback(
    async (profile: {
      displayName?: string | null;
      email?: string | null;
      photoUrl?: string | null;
      provider?: SocialProvider | null;
    }) => {
      await persist({
        mode: "account",
        displayName: profile.displayName?.trim() || "عميل ENARTE",
        email: profile.email || null,
        photoUrl: profile.photoUrl || null,
        provider: profile.provider || "shopify",
      });
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    await persist({
      mode: null,
      displayName: null,
      email: null,
      photoUrl: null,
      provider: null,
    });
  }, [persist]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      mode: state.mode,
      displayName: state.displayName || null,
      email: state.email || null,
      photoUrl: state.photoUrl || null,
      provider: state.provider || null,
      isGuest: state.mode === "guest",
      hasEntered: Boolean(state.mode),
      continueAsGuest,
      markSignedIn,
      signOut,
    }),
    [ready, state, continueAsGuest, markSignedIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
