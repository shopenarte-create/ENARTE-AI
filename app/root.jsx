import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Syne:wght@700;800&display=swap",
  },
];

export default function App() {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content="#eef3f8" />
        <Meta />
        <Links />
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{margin:0;min-height:100%;background:linear-gradient(180deg,#eef3f8 0%,#f7f1e8 48%,#e8eef4 100%);color:#1c2d3a}#enarte-boot-shell{min-height:100dvh;display:grid;place-items:center;padding:1rem;font-family:system-ui,sans-serif}#enarte-boot-shell .card{width:min(100%,28rem);border-radius:1.25rem;padding:1.25rem;background:rgba(247,241,232,.85);border:1px solid rgba(28,45,58,.08)}#enarte-boot-shell .line{height:.75rem;border-radius:999px;margin:.55rem 0;background:rgba(28,45,58,.1)}`,
          }}
        />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
