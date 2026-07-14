/**
 * Knowledge cache — process-local, supports invalidation for hot reload.
 */

export function createKnowledgeCache({ maxEntries = 256 } = {}) {
  /** @type {Map<string, { value: any, storedAt: number }>} */
  const store = new Map();

  function makeKey(moduleId, options = {}) {
    const locale = options.locale || "und";
    const shop = options.shop || "_";
    const key = options.key || "_";
    return `${moduleId}::${locale}::${shop}::${key}`;
  }

  return Object.freeze({
    get(moduleId, options = {}) {
      const entry = store.get(makeKey(moduleId, options));
      return entry ? entry.value : undefined;
    },

    set(moduleId, options = {}, value) {
      const cacheKey = makeKey(moduleId, options);
      if (store.size >= maxEntries && !store.has(cacheKey)) {
        const first = store.keys().next().value;
        store.delete(first);
      }
      store.set(cacheKey, { value, storedAt: Date.now() });
      return value;
    },

    has(moduleId, options = {}) {
      return store.has(makeKey(moduleId, options));
    },

    invalidate(moduleId) {
      if (!moduleId) {
        store.clear();
        return;
      }
      for (const key of [...store.keys()]) {
        if (key.startsWith(`${moduleId}::`)) {
          store.delete(key);
        }
      }
    },

    clear() {
      store.clear();
    },

    size() {
      return store.size;
    },

    keys() {
      return [...store.keys()];
    },
  });
}
