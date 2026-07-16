import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme";

/** App entry — wait for auth before redirecting (avoids blank PWA shell). */
export default function Index() {
  const { ready, hasEntered } = useAuth();

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.goldDeep} size="large" />
      </View>
    );
  }

  if (hasEntered) return <Redirect href="/(tabs)" />;
  return <Redirect href="/welcome" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ivory,
  },
});
