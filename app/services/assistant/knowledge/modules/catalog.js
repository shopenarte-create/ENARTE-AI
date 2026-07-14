/**
 * Knowledge module definitions — empty schemas only (no ENARTE content).
 */

import {
  KNOWLEDGE_MODULE_ID,
  KNOWLEDGE_PROVIDER_KIND,
  KNOWLEDGE_STATUS,
} from "../constants.js";
import { defineKnowledgeModule } from "../contracts.js";
import {
  createAssistantPersonalityContent,
  createBusinessRulesContent,
  createServicesContent,
  createDeliveryContent,
  createFaqContent,
} from "../schemas/content.js";

const DEFAULT_PREFERRED = Object.freeze([
  KNOWLEDGE_PROVIDER_KIND.MEMORY,
  KNOWLEDGE_PROVIDER_KIND.DATABASE,
  KNOWLEDGE_PROVIDER_KIND.JSON,
  KNOWLEDGE_PROVIDER_KIND.SHOPIFY,
  KNOWLEDGE_PROVIDER_KIND.CMS,
  KNOWLEDGE_PROVIDER_KIND.AI,
  KNOWLEDGE_PROVIDER_KIND.NULL,
]);

export const productsModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.PRODUCTS,
  description: "Product domain knowledge (catalog facts, categories, attributes).",
  status: KNOWLEDGE_STATUS.EMPTY,
  preferredProviders: DEFAULT_PREFERRED,
  schema: {
    categories: [],
    attributes: [],
    collections: [],
  },
});

export const servicesModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.SERVICES,
  description:
    "Service offerings catalog (ENARTE-provided; never hardcode in workflows).",
  status: KNOWLEDGE_STATUS.READY,
  preferredProviders: DEFAULT_PREFERRED,
  schema: createServicesContent(),
});

export const deliveryModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.DELIVERY,
  description:
    "Delivery knowledge (ENARTE-provided; never hardcode in workflows).",
  status: KNOWLEDGE_STATUS.READY,
  preferredProviders: [
    KNOWLEDGE_PROVIDER_KIND.MEMORY,
    KNOWLEDGE_PROVIDER_KIND.DATABASE,
    KNOWLEDGE_PROVIDER_KIND.CMS,
    KNOWLEDGE_PROVIDER_KIND.JSON,
    KNOWLEDGE_PROVIDER_KIND.SHOPIFY,
    KNOWLEDGE_PROVIDER_KIND.AI,
    KNOWLEDGE_PROVIDER_KIND.NULL,
  ],
  schema: createDeliveryContent(),
});

export const installationModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.INSTALLATION,
  description: "Installation knowledge (steps, requirements, guidance).",
  status: KNOWLEDGE_STATUS.EMPTY,
  preferredProviders: DEFAULT_PREFERRED,
  schema: {
    guides: [],
    requirements: [],
  },
});

export const maintenanceModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.MAINTENANCE,
  description: "Maintenance and care knowledge.",
  status: KNOWLEDGE_STATUS.EMPTY,
  preferredProviders: DEFAULT_PREFERRED,
  schema: {
    guides: [],
    tips: [],
  },
});

export const sourcingModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.SOURCING,
  description: "Product sourcing knowledge.",
  status: KNOWLEDGE_STATUS.EMPTY,
  preferredProviders: DEFAULT_PREFERRED,
  schema: {
    channels: [],
    policies: [],
  },
});

export const faqModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.FAQ,
  description: "Frequently asked questions knowledge.",
  status: KNOWLEDGE_STATUS.PLACEHOLDER,
  preferredProviders: DEFAULT_PREFERRED,
  schema: createFaqContent(),
});

export const businessRulesModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.BUSINESS_RULES,
  description:
    "Business rules and policy knowledge (ENARTE-provided; never hardcode in workflows).",
  status: KNOWLEDGE_STATUS.READY,
  preferredProviders: DEFAULT_PREFERRED,
  schema: createBusinessRulesContent(),
});

export const assistantPersonalityModule = defineKnowledgeModule({
  id: KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY,
  description:
    "Assistant personality, tone, and specialization messaging (ENARTE-provided).",
  status: KNOWLEDGE_STATUS.READY,
  preferredProviders: [
    KNOWLEDGE_PROVIDER_KIND.MEMORY,
    KNOWLEDGE_PROVIDER_KIND.CMS,
    KNOWLEDGE_PROVIDER_KIND.JSON,
    KNOWLEDGE_PROVIDER_KIND.DATABASE,
    KNOWLEDGE_PROVIDER_KIND.AI,
    KNOWLEDGE_PROVIDER_KIND.NULL,
  ],
  schema: createAssistantPersonalityContent(),
});

export const ALL_KNOWLEDGE_MODULES = Object.freeze([
  productsModule,
  servicesModule,
  deliveryModule,
  installationModule,
  maintenanceModule,
  sourcingModule,
  faqModule,
  businessRulesModule,
  assistantPersonalityModule,
]);
