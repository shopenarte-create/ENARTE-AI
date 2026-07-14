import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import AssistantChatApp from "../components/assistant/AssistantChatApp.jsx";

/**
 * Embedded app home: ENARTE AI Assistant chat entry.
 * Welcome + Smart Actions first — never auto-open the camera.
 * Product try-in-room remains at /try.
 */
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const shop =
    url.searchParams.get("shop") ||
    process.env.ASSISTANT_DEFAULT_SHOP ||
    process.env.SHOP ||
    "enarte-ai-dev.myshopify.com";
  const locale = url.searchParams.get("locale") || "ar";
  return { shop, locale };
};

export default function Index() {
  const { shop, locale } = useLoaderData();
  return <AssistantChatApp shop={shop} locale={locale} />;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
