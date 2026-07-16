import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, type ReactNode } from "react";
import { Platform, StatusBar } from "react-native";
import "react-native-reanimated";
import { AuthProvider, useAuth } from "@/src/auth/AuthContext";
import { CartProvider } from "@/src/cart/CartContext";
import { NotificationsProvider } from "@/src/notifications/NotificationsContext";
import { colors } from "@/src/theme";

export { ErrorBoundary } from "expo-router";

// Hide splash ASAP — never leave the user on a perpetual splash/loading screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

function useRegisterWebServiceWorker() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/app/sw.js", { scope: "/app/" })
      .catch(() => {});
  }, []);
}

function AuthGate({ children }: { children: ReactNode }) {
  const { ready, hasEntered } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Fail-open: if storage is slow, still show the app after a short wait.
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (ready) {
      setBootDone(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  useEffect(() => {
    if (!bootDone) return;
    const root = segments[0];
    const onWelcome = root === "welcome";
    const onInstall = root === "install";

    if (!hasEntered && !onWelcome && !onInstall) {
      router.replace("/welcome");
    } else if (hasEntered && onWelcome) {
      router.replace("/(tabs)");
    }
  }, [bootDone, hasEntered, segments, router]);

  // Do NOT block the tree behind a spinner forever — that was stranding users.
  return <>{children}</>;
}

export default function RootLayout() {
  useRegisterWebServiceWorker();

  return (
    <AuthProvider>
      <CartProvider>
        <NotificationsProvider>
          <StatusBar barStyle="dark-content" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.ivory },
                headerTintColor: colors.charcoal,
                contentStyle: { backgroundColor: colors.ivory },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ headerShown: false }} />
              <Stack.Screen name="install" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="product/[handle]"
                options={{ title: "تفاصيل المنتج", presentation: "card" }}
              />
              <Stack.Screen
                name="order"
                options={{ title: "إتمام الطلب", presentation: "card" }}
              />
              <Stack.Screen
                name="checkout"
                options={{ title: "إتمام الشراء", presentation: "fullScreenModal" }}
              />
              <Stack.Screen
                name="try-viewer"
                options={{ title: "جرّبها بغرفتك", presentation: "fullScreenModal" }}
              />
              <Stack.Screen
                name="image-search"
                options={{ title: "ابحث بالصورة", presentation: "card" }}
              />
              <Stack.Screen
                name="notifications"
                options={{ title: "الإشعارات", presentation: "card" }}
              />
              <Stack.Screen
                name="settings"
                options={{ title: "الإعدادات", presentation: "card" }}
              />
            </Stack>
          </AuthGate>
        </NotificationsProvider>
      </CartProvider>
    </AuthProvider>
  );
}
