/**
 * Feature 3 switch. Shared mode is on only when `DATABASE_URL` is set; unset, every shared route
 * answers 404 and the app is the per-browser prototype it was before. No value here ever reaches
 * the browser except the boolean `enabled` and the build id.
 */

/** Shortest access code accepted. Shorter, and shared mode refuses to serve rather than guess. */
export const SHARED_ACCESS_CODE_MIN_LENGTH = 16;

export type SharedConfig =
  | { enabled: false }
  | { enabled: true; ready: false; reason: "access-code-missing" }
  | {
      enabled: true;
      ready: true;
      databaseUrl: string;
      accessCode: string;
      typedTextAllowed: boolean;
      buildId: string;
    };

export function sharedBuildId(env: Record<string, string | undefined> = process.env): string {
  return env.RAILWAY_GIT_COMMIT_SHA?.trim() || "local";
}

export function readSharedConfig(env: Record<string, string | undefined> = process.env): SharedConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) return { enabled: false };
  const accessCode = env.WARD_FLOW_SHARED_ACCESS_CODE?.trim() ?? "";
  if (accessCode.length < SHARED_ACCESS_CODE_MIN_LENGTH) {
    return { enabled: true, ready: false, reason: "access-code-missing" };
  }
  return {
    enabled: true,
    ready: true,
    databaseUrl,
    accessCode,
    // Off unless set to exactly "allow": typed free text stays in the browser by default.
    typedTextAllowed: env.WARD_FLOW_SHARED_TYPED_TEXT === "allow",
    buildId: sharedBuildId(env),
  };
}

/** What the ward-flow layout passes to the provider. A boolean and a build id, never a secret. */
export function sharedModeForBrowser(env: Record<string, string | undefined> = process.env): {
  enabled: boolean;
  buildId: string;
} {
  return { enabled: readSharedConfig(env).enabled, buildId: sharedBuildId(env) };
}
