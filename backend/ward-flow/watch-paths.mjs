// @ts-check
/**
 * The maintained redeploy watch contract for the Railway `ward-flow-backend` service. Keep the
 * hosted setting in sync after an authorised change; source alone does not prove current settings.
 * Every engine bundle input must be watched (checked by backend.test.mjs, audit F-07), as must root
 * npm policy and lifecycle inputs consumed by the recorded root install (docs/hosting.md).
 * Packages under node_modules come from the two lockfiles listed here.
 */
export const BACKEND_WATCH_PATHS = Object.freeze([
  "/backend/ward-flow/**",
  "/src/components/ward-management/**",
  "/src/lib/**",
  "/package.json",
  "/package-lock.json",
  "/tsconfig.json",
  "/.npmrc",
  "/scripts/check-node-engine.cjs",
  "/scripts/check-installed-lock-parity.mjs",
  "/scripts/dependency-inventory-policy.mjs",
  "/scripts/install-git-hooks.mjs",
  // Supported root version selectors; an explicit provider override can supersede them.
  "/.nvmrc",
  "/.node-version",
]);

/**
 * True when a repository path (no leading slash) is under one of the watch paths.
 * @param {string} path
 */
export function watched(path, patterns = BACKEND_WATCH_PATHS) {
  return patterns.some((pattern) =>
    pattern.endsWith("/**") ? `/${path}`.startsWith(pattern.slice(0, -2)) : `/${path}` === pattern,
  );
}
