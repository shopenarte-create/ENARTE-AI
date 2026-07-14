/**
 * Shared placeholder workflow factory.
 * Same interface for every future feature — easy to replace `run` later.
 */

import { WORKFLOW_STATUS } from "../constants.js";
import { createPlaceholderWorkflowResult } from "../contracts/index.js";

/**
 * @param {object} spec
 * @param {string} spec.id
 * @param {string} [spec.phase]
 * @param {string[]} [spec.intents]
 * @param {string[]} [spec.capabilities]
 * @param {string} [spec.description]
 * @param {string} [spec.status]
 * @param {(ctx: object, input: object) => Promise<object>} [spec.run]
 */
export function createPlaceholderWorkflow(spec) {
  const {
    id,
    phase,
    intents,
    capabilities,
    description,
    status = WORKFLOW_STATUS.PLACEHOLDER,
    run,
  } = spec;

  return Object.freeze({
    id,
    status,
    phase: phase || "later",
    intents: Object.freeze([...(intents || [])]),
    capabilities: Object.freeze([...(capabilities || [])]),
    description: description || "",
    async run(ctx, input = {}) {
      if (typeof run === "function") {
        return run(ctx, input);
      }
      return createPlaceholderWorkflowResult(id);
    },
  });
}

/** @deprecated Use createPlaceholderWorkflow */
export function createWorkflowStub(spec) {
  return createPlaceholderWorkflow(spec);
}
