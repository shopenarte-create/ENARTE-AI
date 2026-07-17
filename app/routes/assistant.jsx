/**
 * Customer route: /assistant
 * Always starts with chat (welcome + Smart Actions). Never opens the camera.
 * Camera/upload are only offered after “Recommend Lighting for My Room”
 * (or Search by Image), and only on an explicit customer tap.
 */

import { useLoaderData } from "react-router";
import AssistantChatApp from "../components/assistant/AssistantChatApp.jsx";

export const meta = () => [
  { title: "ENARTE AI Assistant" },
  {
    name: "description",
    content: "ENARTE lighting sales assistant",
  },
];

export async function loader({ request }) {
  const url = new URL(request.url);
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
  const trainKey = url.searchParams.get("train") || null;

  return { shop, locale, action, continueChat, trainKey };
}

export default function AssistantRoute() {
  const { shop, locale, action, continueChat, trainKey } = useLoaderData();
  return (
    <AssistantChatApp
      shop={shop}
      locale={locale}
      initialAction={action}
      continueChat={continueChat}
      trainKey={trainKey}
    />
  );
}
