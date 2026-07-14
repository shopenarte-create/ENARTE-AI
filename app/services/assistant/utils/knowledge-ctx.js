/**
 * Build Knowledge Manager options from workflow context.
 */

export function knowledgeOptsFromCtx(ctx, locale) {
  const resolved =
    locale || ctx?.locale || ctx?.config?.runtime?.defaultLocale || "ar";
  return {
    locale: resolved,
    manager: ctx?.knowledge
      ? { get: (id, opts) => ctx.knowledge.get(id, opts) }
      : undefined,
  };
}
