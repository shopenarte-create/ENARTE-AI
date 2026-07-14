import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { I18nManager, StatusBar } from "react-native";
import "react-native-reanimated";
import { CartProvider } from "@/src/cart/CartContext";
import { colors } from "@/src/theme";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
    SplashScreen.hideAsync();
  }, []);

  return (
    <CartProvider>
      <StatusBar barStyle="dark-content" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.ivory },
          headerTintColor: colors.charcoal,
          contentStyle: { backgroundColor: colors.ivory },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="product/[handle]"
          options={{ title: "تفاصيل المنتج", presentation: "card" }}
        />
      </Stack>
    </CartProvider>
  );
}
