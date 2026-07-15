/**
 * Platform-safe browser surface.
 * - Native: react-native-webview
 * - Web: iframe (same-origin / allow-framed pages) or open fallback
 */
import { useEffect } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { WebView, type WebViewNavigation, type WebViewProps } from "react-native-webview";

type Props = WebViewProps & {
  /** When true on web and the page may block iframes, open top-level instead. */
  preferExternalOnWeb?: boolean;
  onNavigationStateChange?: (nav: WebViewNavigation) => void;
};

export function AppBrowser({
  source,
  style,
  preferExternalOnWeb = false,
  onLoadEnd,
  onLoadStart,
  onNavigationStateChange,
  ...rest
}: Props) {
  const uri =
    source && typeof source === "object" && "uri" in source
      ? String(source.uri || "")
      : "";

  useEffect(() => {
    if (Platform.OS !== "web" || !preferExternalOnWeb || !uri) return;
    // Shopify checkout blocks iframes — open in the same browser tab.
    if (typeof window !== "undefined") {
      window.location.assign(uri);
    } else {
      Linking.openURL(uri).catch(() => {});
    }
  }, [preferExternalOnWeb, uri]);

  if (Platform.OS === "web") {
    if (preferExternalOnWeb) {
      return <View style={[styles.fill, style]} />;
    }
    return (
      <View style={[styles.fill, style]}>
        {/* @ts-expect-error - iframe is valid on RN web */}
        <iframe
          title="enarte-browser"
          src={uri}
          style={styles.iframe}
          onLoad={() => onLoadEnd?.({} as never)}
        />
      </View>
    );
  }

  return (
    <WebView
      source={source}
      style={style}
      onLoadEnd={onLoadEnd}
      onLoadStart={onLoadStart}
      onNavigationStateChange={onNavigationStateChange}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: "100%", height: "100%" },
  iframe: {
    borderWidth: 0,
    width: "100%",
    height: "100%",
    flex: 1,
  } as never,
});
