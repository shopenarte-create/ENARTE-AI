import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useCart } from "@/src/cart/CartContext";
import { colors } from "@/src/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  focused,
  color,
}: {
  name: IconName;
  focused: boolean;
  color: string;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

function TabLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={[styles.label, { color }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const { count } = useCart();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.goldDeep,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
        headerStyle: { backgroundColor: colors.ivory },
        headerTitleStyle: { fontWeight: "700", color: colors.charcoal },
        headerShadowVisible: false,
        headerTitleAlign: "center",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ENARTE",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} focused={focused} color={color} />
          ),
          tabBarLabel: ({ color }) => <TabLabel label="الرئيسية" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "المتجر",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "grid" : "grid-outline"}
              focused={focused}
              color={color}
            />
          ),
          tabBarLabel: ({ color }) => <TabLabel label="المتجر" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "المساعد",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              focused={focused}
              color={color}
            />
          ),
          tabBarLabel: ({ color }) => <TabLabel label="المساعد" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="try"
        options={{
          title: "جرّبها بغرفتك",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "camera" : "camera-outline"}
              focused={focused}
              color={color}
            />
          ),
          tabBarLabel: ({ color }) => <TabLabel label="جرّب" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "السلة",
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.goldDeep,
            color: "#fff",
            fontSize: 10,
          },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? "bag-handle" : "bag-handle-outline"}
              focused={focused}
              color={color}
            />
          ),
          tabBarLabel: ({ color }) => <TabLabel label="السلة" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
    elevation: 8,
    shadowColor: "#1c1914",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  item: {
    paddingTop: 2,
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: "rgba(196,163,90,0.16)",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
});
