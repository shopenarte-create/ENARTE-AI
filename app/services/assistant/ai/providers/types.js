/**
 * AI provider interface helpers.
 * Providers never talk to Decision Engine — only the AI Adapter does.
 */

import { AI_PROVIDER_STATUS } from "../constants.js";

/**
 * @typedef {object} AiProviderDefinition
 * @property {string} id
 * @property {string} status
 * @property {string} description
 * @property {string[]} [supports] AI_CAPABILITY_KIND values
 * @property {() => boolean} [isAvailable]
 * @property {(request: object, options?: object) => Promise<object>} [invoke]
 */

export function defineAiProvider(definition) {
  if (!definition?.id) {
    throw new Error("defineAiProvider requires id.");
  }

  return Object.freeze({
    id: definition.id,
    status: definition.status || AI_PROVIDER_STATUS.PLANNED,
    description: definition.description || "",
    supports: Object.freeze([...(definition.supports || [])]),
    isAvailable:
      typeof definition.isAvailable === "function"
        ? definition.isAvailable
        : () => false,
    invoke:
      typeof definition.invoke === "function"
        ? definition.invoke
        : async () => {
            throw new Error(`Provider "${definition.id}" invoke not implemented.`);
          },
  });
}
