/**
 * Knowledge module registry.
 */

/** @type {Map<string, import("../contracts.js").KnowledgeModuleDefinition>} */
const modules = new Map();

export function registerKnowledgeModule(definition) {
  if (!definition?.id) {
    throw new Error("Knowledge module requires an id.");
  }
  modules.set(definition.id, Object.freeze({ ...definition }));
  return definition.id;
}

export function getKnowledgeModule(id) {
  return modules.get(id) || null;
}

export function listKnowledgeModules() {
  return [...modules.values()];
}

export function resetKnowledgeModules() {
  modules.clear();
}
