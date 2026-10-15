import { readPushConfig } from "./push.mjs";
import { readSupabaseIdentityConfig, readSupabaseDatabaseConfig } from "./supabase-config.mjs";
import { readPortablePostgresConfig } from "./postgres-config.mjs";

/**
 * Database and sign-in providers. Supabase is the current provider for both (decision D-55).
 * Each entry reads and validates that provider's own settings; providers.mjs maps the same names
 * to adapters. Changing provider later means one adapter plus one entry here and there, then the
 * WARD_DATABASE_PROVIDER / WARD_AUTH_PROVIDER settings. See docs/ward-flow/DATABASE.md.
 */
export const DEFAULT_DATABASE_PROVIDER = "supabase";
export const DEFAULT_AUTH_PROVIDER = "supabase";
export const DATABASE_PROVIDERS = Object.freeze({
  supabase: readSupabaseDatabaseConfig,
  postgres: readPortablePostgresConfig,
});
export const AUTH_PROVIDERS = Object.freeze({ supabase: readSupabaseIdentityConfig });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER_IDS = new Set([
  "00000000-0000-0000-0000-000000000000",
  "00000000-0000-4000-8000-000000000000",
  "00000000-0000-4000-8000-000000000001",
]);

export function readConfig(env = process.env) {
  const databaseProvider = env.WARD_DATABASE_PROVIDER || DEFAULT_DATABASE_PROVIDER;
  const authProvider = env.WARD_AUTH_PROVIDER || DEFAULT_AUTH_PROVIDER;
  if (!Object.hasOwn(DATABASE_PROVIDERS, databaseProvider) || !Object.hasOwn(AUTH_PROVIDERS, authProvider))
    throw new Error("Invalid provider configuration");
  const origin = env.WARD_ALLOWED_ORIGIN || null;
  if (origin) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      !["https:", "http:"].includes(url.protocol) ||
      (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
      throw new Error("Invalid origin configuration");
  }
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port configuration");
  const shared = env.WARD_SHARED_ENABLED === "true";
  const dataMode = env.WARD_DATA_MODE || "prototype";
  if (dataMode !== "prototype") throw new Error("Live data mode is not commissioned in this release");
  const coordinatorIds = (env.WARD_COORDINATOR_USER_IDS || "").split(",").map((id) => id.trim().toLowerCase());
  if (coordinatorIds.some((id) => !UUID.test(id) || PLACEHOLDER_IDS.has(id)))
    throw new Error("Invalid coordinator configuration");
  let postgres = null;
  if (shared) {
    postgres = DATABASE_PROVIDERS[databaseProvider](env);
    if (!UUID.test(env.WARD_WORKSPACE_ID ?? "") || PLACEHOLDER_IDS.has(env.WARD_WORKSPACE_ID.toLowerCase()))
      throw new Error("Invalid workspace configuration");
  }
  return {
    databaseProvider,
    authProvider,
    shared,
    dataMode,
    coordinatorIds,
    workspaceId: env.WARD_WORKSPACE_ID?.toLowerCase(),
    postgres,
    // Sign-in settings sit under the provider's own name, for example `config.supabase`.
    [authProvider]: AUTH_PROVIDERS[authProvider](env),
    // Phone push needs the shared workspace (subscriptions and act-now state live in PostgreSQL).
    push: shared ? readPushConfig(env) : null,
    origin,
    host: env.HOST || "127.0.0.1",
    port,
  };
}
