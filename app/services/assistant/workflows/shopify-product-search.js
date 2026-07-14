import { createWorkflowStub } from "./_stub.js";

export default createWorkflowStub({
  id: "shopify_product_search",
  phase: "phase2",
  intents: ["shopify_search"],
  capabilities: ["catalog.search"],
  description: "Shopify catalog search workflow.",
});
