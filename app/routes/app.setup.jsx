import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

const API_KEY = "fcbe2a40342d41df221ad481f548d23b";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const shopHandle = shop.replace(".myshopify.com", "");

  return {
    shop,
    openAppUrl: `https://admin.shopify.com/store/${shopHandle}/apps/${API_KEY}`,
    installUrl: `https://admin.shopify.com/oauth/install?client_id=${API_KEY}`,
    embedUrl: `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${API_KEY}/enarte-try-embed`,
    productBlockUrl: `https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${API_KEY}/try-now&target=newAppsSection`,
  };
};

export default function SetupPage() {
  const data = useLoaderData();

  return (
    <s-page heading="Enable ENARTE on product pages">
      <s-section heading="Why App embeds is empty">
        <s-paragraph>
          Theme App Extensions only appear under App embeds after the app
          version that contains them is installed/updated on this store.
        </s-paragraph>
      </s-section>

      <s-section heading="Step 1 — Open / update ENARTE-AI on this store">
        <s-paragraph>
          Click below, approve any new permissions, then wait until the app
          home loads.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button href={data.openAppUrl} target="_blank">
            Open ENARTE-AI app
          </s-button>
          <s-button href={data.installUrl} target="_blank" variant="secondary">
            Reinstall / update app
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Step 2 — Open App embeds">
        <s-unordered-list>
          <s-list-item>Online Store → Themes → Customize</s-list-item>
          <s-list-item>Theme settings (left) → App embeds</s-list-item>
          <s-list-item>
            Find <strong>ENARTE Try Now</strong> → toggle ON → Save
          </s-list-item>
        </s-unordered-list>
        <s-button href={data.embedUrl} target="_blank">
          Open App embeds (deep link)
        </s-button>
      </s-section>

      <s-section heading="Optional — App block on product template">
        <s-button href={data.productBlockUrl} target="_blank" variant="secondary">
          Add ENARTE Try Now block to product page
        </s-button>
      </s-section>

      <s-section heading="Store">
        <s-paragraph>{data.shop}</s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
