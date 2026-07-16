import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

// Web-only root HTML for static export.
// NOTE: Do not put JS in <script dangerouslySetInnerHTML> here — Expo may
// emit it as <style> and break service-worker registration.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#1c1914" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ENARTE" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/app/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/app/apple-touch-icon.png" />
        <link rel="icon" href="/app/favicon.ico" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #f7f3ec;
}
`;
