/**
 * Dev-only one-tap storefront unlock for mobile testing.
 * Server logic lives in dev-mobile-test.server.js (Node-only).
 */
export async function loader(args) {
  const { handleDevMobileTestLoader } = await import(
    "../utils/dev-mobile-test.server.js"
  );
  return handleDevMobileTestLoader(args);
}
