/**
 * Workflow registry — discovers independent workflow modules.
 * Adding a feature = add a workflow file + register it here.
 * Do not put cross-feature business logic in this file.
 */

import {
  createNotImplementedResult,
  defineWorkflow,
} from "../contracts/index.js";

import generalChat from "./general-chat.js";
import productSearch from "./product-search.js";
import imageSearch from "./image-search.js";
import roomAnalysis from "./room-analysis.js";
import virtualPlacement from "./virtual-placement.js";
import shopifyProductSearch from "./shopify-product-search.js";
import productRecommendations from "./product-recommendations.js";
import installation from "./installation.js";
import maintenance from "./maintenance.js";
import delivery from "./delivery.js";
import returns from "./returns.js";
import customChandeliers from "./custom-chandeliers.js";
import productSourcing from "./product-sourcing.js";
import suggestionsFeedback from "./suggestions-feedback.js";
import adminNotifications from "./admin-notifications.js";
import conversationLearning from "./conversation-learning.js";
import analytics from "./analytics.js";
import checkout from "./checkout.js";
import chandelier from "./chandelier.js";
import fan from "./fan.js";
import outdoorLighting from "./outdoor-lighting.js";
import siteInspection from "./site-inspection.js";
import describeLookingFor from "./describe-looking-for.js";
import aiAssistedChat from "./ai-assisted-chat.js";

/** @type {Map<string, import("../contracts/index.js").WorkflowDefinition>} */
const workflows = new Map();

export function registerWorkflow(definition) {
  const workflow = defineWorkflow(definition);
  workflows.set(workflow.id, workflow);
  return workflow;
}

export function getWorkflow(id) {
  return workflows.get(id) || null;
}

export function listWorkflows() {
  return [...workflows.values()].map((w) =>
    Object.freeze({
      id: w.id,
      status: w.status,
      intents: w.intents,
      capabilities: w.capabilities,
      description: w.description,
      phase: w.phase,
    }),
  );
}

export function findWorkflowsByIntent(intent) {
  if (!intent) return [];
  const needle = String(intent).toLowerCase();
  return [...workflows.values()].filter((w) =>
    w.intents.some((i) => i.toLowerCase() === needle),
  );
}

export async function runWorkflow(id, ctx, input = {}) {
  const workflow = workflows.get(id);
  if (!workflow) {
    return createNotImplementedResult(
      "workflow",
      id,
      `Workflow "${id}" is not registered.`,
    );
  }
  return workflow.run(ctx, input);
}

const WORKFLOW_MODULES = [
  generalChat,
  productSearch,
  imageSearch,
  roomAnalysis,
  virtualPlacement,
  shopifyProductSearch,
  productRecommendations,
  installation,
  maintenance,
  delivery,
  returns,
  customChandeliers,
  productSourcing,
  suggestionsFeedback,
  adminNotifications,
  conversationLearning,
  analytics,
  checkout,
  chandelier,
  fan,
  outdoorLighting,
  siteInspection,
  describeLookingFor,
  aiAssistedChat,
];

for (const module of WORKFLOW_MODULES) {
  registerWorkflow(module);
}
