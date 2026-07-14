/**
 * Schema barrel — Sprint 1 knowledge document shapes + validation.
 */

export {
  createDocumentMeta,
  createDefaultSyncHook,
  createKnowledgeDocument,
} from "./envelope.js";

export {
  createAssistantPersonalityContent,
  createBusinessRulesContent,
  createServicesContent,
  createDeliveryContent,
  createFaqContent,
  CONTENT_FACTORIES,
  CONTENT_REQUIRED_KEYS,
} from "./content.js";

export {
  validateKnowledgeEnvelope,
  validateModuleContent,
  validateKnowledgeDocument,
  assertValidKnowledgeDocument,
} from "./validators.js";
