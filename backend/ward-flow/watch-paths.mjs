// @ts-check
/**
 * The hosted backend's redeploy watch paths, as set on the Railway `ward-flow-backend` service
 * (docs/hosting.md). Railway rebuilds only when a pushed change touches one of these, so every file
 * the engine bundle is built from must sit under one; backend.test.mjs checks that against the
 * bundle itself (audit F-07). Packages under node_modules come from the two lockfiles listed here.
 */
export const BACKEND_WATCH_PATHS = Object.freeze([
  "/backend/ward-flow/**",
  "/src/components/ward-management/**",
  "/src/lib/**",
  "/package.json",
  "/package-lock.json",
  "/tsconfig.json",
]);

/** True when a repository path (no leading slash) is under one of the watch paths. */
export function watched(path, patterns = BACKEND_WATCH_PATHS) {
  return patterns.some((pattern) =>
    pattern.endsWith("/**") ? `/${path}`.startsWith(pattern.slice(0, -2)) : `/${path}` === pattern,
  );
}
