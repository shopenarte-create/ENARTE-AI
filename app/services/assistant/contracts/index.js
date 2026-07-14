/**
 * Shared contract helpers for assistant workflows, capabilities, and adapters.
 * Phase 1: shapes + validation only — no domain behavior.
 */

import {
  ADAPTER_STATUS,
  CAPABILITY_STATUS,
  MODULE_STATUS,
  WORKFLOW_STATUS,
} from "../constants.js";


/**
 * @typedef {object} AssistantContext
 * @property {string} shop
 * @property {string} [conversationId]
 * @property {string} [locale]
 * @property {string} [channel]
 * @property {object} [config]
 * @property {object} [knowledge] KnowledgeClient — use get/query/bundle only
 * @property {object} [metadata]
 */

/**
 * @typedef {object} WorkflowDefinition
 * @property {string} id
 * @property {string} status
 * @property {string[]} intents
 * @property {string[]} capabilities
 * @property {string} description
 * @property {(ctx: AssistantContext, input: object) => Promise<object>} run
 */

/**
 * @typedef {object} CapabilityDefinition
 * @property {string} id
 * @property {string} status
 * @property {string} description
 * @property {string[]} [dependsOn]
 * @property {(ctx: AssistantContext, input: object) => Promise<object>} invoke
 */

/**
 * @typedef {object} AdapterDefinition
 * @property {string} id
 * @property {string} status
 * @property {string} description
 * @property {object} [api]
 */

/**
 * @typedef {object} ExtensionPort
 * @property {string} id
 * @property {string} status
 * @property {string} description
 * @property {string[]} attachesTo
 */

export function createNotImplementedResult(kind, id, note) {
  return Object.freeze({
    ok: false,
    kind,
    id,
    status: MODULE_STATUS.NOT_IMPLEMENTED,
    note:
      note ||
      `${kind} "${id}" is registered for architecture only — not implemented yet.`,
  });
}

/**
 * Standard workflow result shape (all workflows must return this interface).
 *
 * @param {object} partial
 * @param {string} partial.workflowId
 * @param {boolean} [partial.ok]
 * @param {string} [partial.status]
 * @param {string} [partial.action] e.g. reply | delegate | placeholder | clarify | out_of_domain
 * @param {string|null} [partial.message] canned/engine message (never LLM in Phase 2)
 * @param {object|null} [partial.route]
 * @param {object} [partial.data]
 * @param {string} [partial.note]
 */
export function createWorkflowResult(partial = {}) {
  if (!partial.workflowId) {
    throw new Error("createWorkflowResult requires workflowId.");
  }

  return Object.freeze({
    ok: Boolean(partial.ok),
    kind: "workflow",
    workflowId: partial.workflowId,
    status: partial.status || MODULE_STATUS.NOT_IMPLEMENTED,
    action: partial.action || "placeholder",
    message: partial.message ?? null,
    route: partial.route ? Object.freeze({ ...partial.route }) : null,
    delegated: partial.delegated
      ? Object.freeze({ ...partial.delegated })
      : null,
    data: Object.freeze({ ...(partial.data || {}) }),
    note: partial.note || null,
  });
}

export function createPlaceholderWorkflowResult(workflowId, note) {
  return createWorkflowResult({
    ok: true,
    workflowId,
    status: WORKFLOW_STATUS.PLACEHOLDER,
    action: "placeholder",
    message: null,
    note:
      note ||
      `Workflow "${workflowId}" received the request. Implementation arrives in a later phase.`,
  });
}

export function defineWorkflow(definition) {
  if (!definition?.id) {
    throw new Error("Workflow definition requires an id.");
  }

  const status = definition.status || WORKFLOW_STATUS.NOT_IMPLEMENTED;

  return Object.freeze({
    id: definition.id,
    status,
    intents: Object.freeze([...(definition.intents || [])]),
    capabilities: Object.freeze([...(definition.capabilities || [])]),
    description: definition.description || "",
    phase: definition.phase || "later",
    knowledgeSources: Object.freeze([...(definition.knowledgeSources || [])]),
    async run(ctx, input = {}) {
      if (typeof definition.run === "function") {
        return definition.run(ctx, input);
      }
      return createNotImplementedResult("workflow", definition.id);
    },
  });
}

export function defineCapability(definition) {
  if (!definition?.id) {
    throw new Error("Capability definition requires an id.");
  }

  return Object.freeze({
    id: definition.id,
    status: definition.status || CAPABILITY_STATUS.NOT_IMPLEMENTED,
    description: definition.description || "",
    dependsOn: Object.freeze([...(definition.dependsOn || [])]),
    async invoke(ctx, input = {}) {
      if (typeof definition.invoke === "function") {
        return definition.invoke(ctx, input);
      }
      return createNotImplementedResult("capability", definition.id);
    },
  });
}

export function defineAdapter(definition) {
  if (!definition?.id) {
    throw new Error("Adapter definition requires an id.");
  }

  return Object.freeze({
    id: definition.id,
    status: definition.status || ADAPTER_STATUS.STUB,
    description: definition.description || "",
    api: definition.api || Object.freeze({}),
  });
}

export function defineExtensionPort(definition) {
  if (!definition?.id) {
    throw new Error("Extension port requires an id.");
  }

  return Object.freeze({
    id: definition.id,
    status: definition.status || MODULE_STATUS.PLANNED,
    description: definition.description || "",
    attachesTo: Object.freeze([...(definition.attachesTo || [])]),
  });
}
