import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useCart } from "@/src/cart/CartContext";
import { colors } from "@/src/theme";

function TabLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
  );
}

export default function TabLayout() {
  const { count } = useCart();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.goldDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerStyle: { backgroundColor: colors.ivory },
        headerTitleStyle: { fontWeight: "700", color: colors.charcoal },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarLabel: ({ color }) => (
            <TabLabel label="الرئيسية" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "المتجر",
          tabBarLabel: ({ color }) => (
            <TabLabel label="المتجر" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "المساعد",
          tabBarLabel: ({ color }) => (
            <TabLabel label="المساعد" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="try"
        options={{
          title: "جرب الإضاءة",
          tabBarLabel: ({ color }) => (
            <TabLabel label="جرب" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "السلة",
          tabBarBadge: count > 0 ? count : undefined,
          tabBarLabel: ({ color }) => (
            <TabLabel label="السلة" color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
