/**
 * Cost tracking — architecture for estimated spend per provider/model.
 * Rates are configurable; defaults are zero until models are wired.
 */

const store = {
  byProvider: new Map(),
  byModel: new Map(),
  totals: { currency: "USD", amount: 0, requests: 0 },
};

/** @type {Map<string, { inputPer1k: number, outputPer1k: number, currency: string }>} */
const rateCards = new Map();

/**
 * Register or update a model rate card (USD per 1k tokens by default).
 * Sprint 6: optional; amounts stay 0 without usage.
 */
export function registerModelRate(modelId, rates = {}) {
  if (!modelId) throw new Error("registerModelRate requires modelId.");
  rateCards.set(
    modelId,
    Object.freeze({
      inputPer1k: Number(rates.inputPer1k) || 0,
      outputPer1k: Number(rates.outputPer1k) || 0,
      currency: rates.currency || "USD",
    }),
  );
  return rateCards.get(modelId);
}

export function estimateCost({ model, usage } = {}) {
  const rates = model ? rateCards.get(model) : null;
  if (!rates || !usage) {
    return Object.freeze({
      currency: "USD",
      amount: 0,
      model: model || null,
      estimated: false,
    });
  }

  const amount =
    ((usage.promptTokens || 0) / 1000) * rates.inputPer1k +
    ((usage.completionTokens || 0) / 1000) * rates.outputPer1k;

  return Object.freeze({
    currency: rates.currency,
    amount: Number(amount.toFixed(6)),
    model,
    estimated: true,
  });
}

export function recordCost(input = {}) {
  const cost =
    input.cost ||
    estimateCost({ model: input.model, usage: input.usage });

  store.totals.amount += cost.amount || 0;
  store.totals.requests += 1;
  store.totals.currency = cost.currency || store.totals.currency;

  const bump = (map, key) => {
    if (!key) return;
    const prev = map.get(key) || { amount: 0, requests: 0, currency: cost.currency };
    map.set(key, {
      amount: prev.amount + (cost.amount || 0),
      requests: prev.requests + 1,
      currency: cost.currency || prev.currency,
    });
  };

  bump(store.byProvider, input.providerId);
  bump(store.byModel, cost.model || input.model);

  return getCostSnapshot();
}

export function getCostSnapshot() {
  return Object.freeze({
    totals: Object.freeze({ ...store.totals }),
    byProvider: Object.freeze(
      Object.fromEntries(
        [...store.byProvider.entries()].map(([k, v]) => [k, Object.freeze({ ...v })]),
      ),
    ),
    byModel: Object.freeze(
      Object.fromEntries(
        [...store.byModel.entries()].map(([k, v]) => [k, Object.freeze({ ...v })]),
      ),
    ),
    rateCards: Object.freeze(
      Object.fromEntries(
        [...rateCards.entries()].map(([k, v]) => [k, v]),
      ),
    ),
  });
}

export function resetCostTracking() {
  store.byProvider.clear();
  store.byModel.clear();
  store.totals = { currency: "USD", amount: 0, requests: 0 };
}
