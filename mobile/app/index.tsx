import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";

/** App entry — never sit on a blank/loading route. */
export default function Index() {
  const { hasEntered } = useAuth();
  if (hasEntered) return <Redirect href="/(tabs)" />;
  return <Redirect href="/welcome" />;
}
