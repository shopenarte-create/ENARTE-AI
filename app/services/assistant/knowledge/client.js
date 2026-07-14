/**
 * Knowledge client — the ONLY interface workflows should use.
 *
 * Backed by the Knowledge Manager (validate + cache + hot reload).
 * Workflows must not import placeholders, providers, or raw schemas.
 */

import {
  getKnowledgeManager,
  ensureKnowledgeReady,
} from "./manager.js";
import { KNOWLEDGE_MODULE_IDS, SPRINT1_KNOWLEDGE_MODULE_IDS } from "./constants.js";
import { listKnowledgeModules } from "./modules/registry.js";

/**
 * @param {object} [scope]
 * @param {string} [scope.shop]
 * @param {string} [scope.locale]
 * @param {ReturnType<import("./manager.js").createKnowledgeManager>} [scope.manager]
 */
export function createKnowledgeClient(scope = {}) {
  const manager = scope.manager || getKnowledgeManager();
  const base = Object.freeze({
    shop: scope.shop || null,
    locale: scope.locale || null,
  });

  return Object.freeze({
    /** Stable list of module ids available to workflows. */
    modules: KNOWLEDGE_MODULE_IDS,
    sprint1Modules: SPRINT1_KNOWLEDGE_MODULE_IDS,

    listModules() {
      return listKnowledgeModules().map((m) =>
        Object.freeze({
          id: m.id,
          description: m.description,
          status: m.status,
        }),
      );
    },

    async ready(options = {}) {
      return ensureKnowledgeReady({
        shop: base.shop,
        locale: base.locale,
        ...options,
      });
    },

    /**
     * Request one knowledge module via Knowledge Manager.
     * @param {string} moduleId
     * @param {object} [options]
     */
    async get(moduleId, options = {}) {
      return manager.get(moduleId, {
        shop: base.shop,
        locale: base.locale,
        ...options,
      });
    },

    /**
     * Query a module (filters / key) via Knowledge Manager.
     * @param {object} query
     */
    async query(query = {}) {
      return manager.query({
        shop: base.shop,
        locale: base.locale,
        ...query,
      });
    },

    /**
     * Load a set of modules (defaults to Sprint 1 set).
     * @param {string[]} [moduleIds]
     * @param {object} [options]
     */
    async bundle(moduleIds, options = {}) {
      return manager.bundle(moduleIds || [...SPRINT1_KNOWLEDGE_MODULE_IDS], {
        shop: base.shop,
        locale: base.locale,
        ...options,
      });
    },

    /** Structural validation only — no business evaluation. */
    validate(documentOrModuleId) {
      return manager.validate(documentOrModuleId);
    },

    async reload(moduleId, options = {}) {
      return manager.reload(moduleId, {
        shop: base.shop,
        locale: base.locale,
        ...options,
      });
    },

    getManagerStatus() {
      return manager.getStatus();
    },
  });
}
