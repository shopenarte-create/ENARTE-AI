import { useLoaderData } from "react-router";
import { redirect } from "react-router";
import AssistantChatApp from "../../components/assistant/AssistantChatApp.jsx";

/**
 * True embedded Admin App Bridge params — NOT App Proxy.
 * App Proxy always includes `shop` (+ signature / path_prefix). Redirecting
 * those requests to /app causes "error in the third-party application".
 */
const EMBEDDED_ADMIN_PARAMS = ["host", "id_token", "embedded", "session"];

/**
 * Public entry = ENARTE AI Assistant chat (welcome + Smart Actions).
 * Never opens the camera on start. Try-in-room / placement stays on /try.
 */
export const meta = () => [
  { title: "ENARTE AI Assistant" },
  {
    name: "description",
    content: "ENARTE lighting sales assistant",
  },
];

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const isAppProxy = Boolean(url.searchParams.get("path_prefix"));
  const isEmbeddedAdmin =
    !isAppProxy &&
    EMBEDDED_ADMIN_PARAMS.some((param) => url.searchParams.has(param));

  if (isEmbeddedAdmin) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  const shop =
    url.searchParams.get("shop") ||
    process.env.ASSISTANT_DEFAULT_SHOP ||
    process.env.SHOP ||
    "jb8xus-wn.myshopify.com";
  const locale = url.searchParams.get("locale") || "ar";
  const action = url.searchParams.get("action") || null;
  const continueChat =
    url.searchParams.get("continue") === "1" ||
    url.searchParams.get("continue") === "true";

  return { shop, locale, action, continueChat };
};

export default function Index() {
  const { shop, locale, action, continueChat } = useLoaderData();
  return (
    <AssistantChatApp
      shop={shop}
      locale={locale}
      initialAction={action}
      continueChat={continueChat}
    />
  );
}
