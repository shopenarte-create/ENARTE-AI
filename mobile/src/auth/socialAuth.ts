import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { STORE_URL } from "../config";
import { colors } from "../theme";

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = "google" | "facebook" | "shopify" | "guest";

export type SignedInProfile = {
  provider: SocialProvider;
  displayName: string;
  email?: string | null;
  photoUrl?: string | null;
};

const GOOGLE_WEB =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "";
const GOOGLE_IOS =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || "";
const GOOGLE_ANDROID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || "";

export function hasGoogleOAuthConfig() {
  return Boolean(GOOGLE_WEB || GOOGLE_IOS || GOOGLE_ANDROID);
}

export function useGoogleAuthRequest() {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "enarte",
    path: "auth",
  });

  const placeholder = "000000000000-placeholder.apps.googleusercontent.com";

  return Google.useAuthRequest({
    webClientId: GOOGLE_WEB || placeholder,
    iosClientId: GOOGLE_IOS || undefined,
    androidClientId: GOOGLE_ANDROID || undefined,
    redirectUri,
    scopes: ["openid", "profile", "email"],
  });
}

export async function fetchGoogleProfile(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("google_profile_failed");
  }
  const data = (await res.json()) as {
    name?: string;
    email?: string;
    picture?: string;
  };
  return {
    provider: "google" as const,
    displayName: data.name || data.email || "عميل Google",
    email: data.email || null,
    photoUrl: data.picture || null,
  } satisfies SignedInProfile;
}

export function shopifyLoginUrl(locale = "ar") {
  return `${STORE_URL}/account/login?locale=${encodeURIComponent(locale)}`;
}

export function shopifyRegisterUrl(locale = "ar") {
  return `${STORE_URL}/account/register?locale=${encodeURIComponent(locale)}`;
}

/**
 * Opens store login in an in-app browser sheet.
 * Resolves when the user closes the sheet (Shopify never redirects to app scheme).
 */
export async function openShopifyAccountAuth(
  kind: "login" | "register" = "login",
) {
  const url = kind === "login" ? shopifyLoginUrl() : shopifyRegisterUrl();
  const result = await WebBrowser.openBrowserAsync(url, {
    enableBarCollapsing: true,
    dismissButtonStyle: "close",
    showInRecents: true,
    toolbarColor: colors.ivory,
    controlsColor: colors.charcoal,
  });
  return result;
}

export async function openExternal(url: string) {
  const can = await Linking.canOpenURL(url);
  if (can) await Linking.openURL(url);
}
