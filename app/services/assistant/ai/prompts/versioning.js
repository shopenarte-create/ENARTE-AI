/**
 * Prompt versioning — semver helpers + version lineage.
 */

export function makePromptVersionKey(promptId, version = "0.0.0") {
  return `${promptId}@${version}`;
}

export function parsePromptVersionKey(key) {
  const idx = String(key || "").lastIndexOf("@");
  if (idx <= 0) {
    return Object.freeze({ promptId: key || null, version: null });
  }
  return Object.freeze({
    promptId: key.slice(0, idx),
    version: key.slice(idx + 1),
  });
}

/**
 * Compare simple semver-ish strings (major.minor.patch). Returns -1 / 0 / 1.
 */
export function comparePromptVersions(a, b) {
  const parse = (v) =>
    String(v || "0")
      .split(".")
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) ? n : part;
      });

  const left = parse(a);
  const right = parse(b);
  const len = Math.max(left.length, right.length);

  for (let i = 0; i < len; i += 1) {
    const L = left[i] ?? 0;
    const R = right[i] ?? 0;
    if (L === R) continue;
    if (typeof L === "number" && typeof R === "number") {
      return L < R ? -1 : 1;
    }
    return String(L) < String(R) ? -1 : 1;
  }
  return 0;
}

export function pickLatestVersion(versions = []) {
  if (!versions.length) return null;
  return [...versions].sort(comparePromptVersions).at(-1);
}

export function isValidSemverLike(version) {
  return /^\d+(\.\d+){0,3}(-[a-zA-Z0-9.]+)?$/.test(String(version || ""));
}

/**
 * Build a lineage list for a prompt id (oldest → newest).
 */
export function buildVersionLineage(entries = []) {
  return Object.freeze(
    [...entries]
      .sort((a, b) => comparePromptVersions(a.version, b.version))
      .map((e) =>
        Object.freeze({
          promptId: e.promptId,
          version: e.version,
          status: e.status || null,
          contentReady: Boolean(e.contentReady),
        }),
      ),
  );
}
