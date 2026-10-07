// Next.js calls register() once when a server instance starts, before it serves
// any requests.
export async function register() {
  // Only the Node.js server runtime needs the guard below. The Edge runtime
  // doesn't build production bundles the way this check validates.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.NODE_ENV !== "production") return;

  // Playwright validates a real production build, but its runner must remain an
  // isolated test profile. Permit that combination only for the runner's
  // isolated output directory.
  //
  // src/proxy.ts `shouldBlockProductionMockups` relies on this refusal: it only
  // lets mockups through when PLAYWRIGHT_OFFLINE_MODE and NEXT_PUBLIC_MOCKUPS_ENABLED
  // are both set, and trusts that this function has already refused to start any
  // process where that combination doesn't also mean the isolated test profile.
  if (process.env.PLAYWRIGHT_OFFLINE_MODE === "true") {
    const isolatedOutput = /^\.next-playwright\/[a-z0-9-]+\/dist$/i.test(process.env.NEXT_DIST_DIR ?? "");
    if (isolatedOutput) return;
    throw new Error("Refusing to start: invalid isolated Playwright offline environment.");
  }
}
