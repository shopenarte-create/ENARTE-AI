/**
 * Token usage tracking — in-memory aggregates for Sprint 6 architecture.
 */

const store = {
  byProvider: new Map(),
  byCapability: new Map(),
  totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0, requests: 0 },
};

function bump(map, key, usage) {
  const prev = map.get(key) || {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    requests: 0,
  };
  map.set(key, {
    promptTokens: prev.promptTokens + (usage.promptTokens || 0),
    completionTokens: prev.completionTokens + (usage.completionTokens || 0),
    totalTokens: prev.totalTokens + (usage.totalTokens || 0),
    requests: prev.requests + 1,
  });
}

/**
 * @param {object} input
 * @param {string} [input.providerId]
 * @param {string} [input.kind]
 * @param {object} [input.usage]
 */
export function recordTokenUsage(input = {}) {
  const usage = input.usage || {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  store.totals.promptTokens += usage.promptTokens || 0;
  store.totals.completionTokens += usage.completionTokens || 0;
  store.totals.totalTokens += usage.totalTokens || 0;
  store.totals.requests += 1;

  if (input.providerId) bump(store.byProvider, input.providerId, usage);
  if (input.kind) bump(store.byCapability, input.kind, usage);

  return getTokenUsageSnapshot();
}

export function getTokenUsageSnapshot() {
  return Object.freeze({
    totals: Object.freeze({ ...store.totals }),
    byProvider: Object.freeze(
      Object.fromEntries(
        [...store.byProvider.entries()].map(([k, v]) => [k, Object.freeze({ ...v })]),
      ),
    ),
    byCapability: Object.freeze(
      Object.fromEntries(
        [...store.byCapability.entries()].map(([k, v]) => [
          k,
          Object.freeze({ ...v }),
        ]),
      ),
    ),
  });
}

export function resetTokenUsage() {
  store.byProvider.clear();
  store.byCapability.clear();
  store.totals = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    requests: 0,
  };
}
