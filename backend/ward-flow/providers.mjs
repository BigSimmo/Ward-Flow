// @ts-check
import { createPush } from "./push.mjs";

/**
 * Provider adapters, keyed by the names config.mjs accepts. Supabase is the current provider
 * (decision D-55); plain PostgreSQL shares the same SQL and runtime-role checks. Loading is lazy so
 * only the selected adapter's modules are imported. See docs/ward-flow/DATABASE.md.
 *
 * A database adapter returns `{ createPool(config.postgres), verifyPool(pool, options) }`.
 * A sign-in adapter returns `createAuthenticator(config)`, resolving to a function that maps an
 * Authorization header to a coordinator user ID or throws (VerifierUnavailableError for outages).
 */
/** Built by build-engine.mjs. A variable path keeps the generated bundle out of type checking. */
const ENGINE_MODULE = "./dist/engine.mjs";

export const DATABASE_ADAPTERS = Object.freeze({
  supabase: async () => {
    const { createSupabasePool, verifySupabaseRuntimeRole } = await import("./supabase-postgres.mjs");
    return { createPool: createSupabasePool, verifyPool: verifySupabaseRuntimeRole };
  },
  postgres: async () => {
    const { createPortablePostgresPool, verifyPortableRuntimeRole } = await import("./portable-postgres.mjs");
    return { createPool: createPortablePostgresPool, verifyPool: verifyPortableRuntimeRole };
  },
});

export const AUTH_ADAPTERS = Object.freeze({
  supabase: async () => (await import("./supabase-auth.mjs")).createSupabaseAuthenticator,
});

export async function createBackend(config, dependencies = {}) {
  const loadDatabase = dependencies.database?.[config.databaseProvider] ?? DATABASE_ADAPTERS[config.databaseProvider];
  const loadAuth = dependencies.auth?.[config.authProvider] ?? AUTH_ADAPTERS[config.authProvider];
  if (!loadDatabase) throw new Error("Invalid backend provider");
  if (!loadAuth) throw new Error("Invalid identity provider");
  let pool;
  try {
    let sharedStore;
    // The accounts with a role in the shared workspace. The bootstrap list is checked by the verifier.
    const roleHolders = async () => (await sharedStore?.roleHolders?.()) ?? [];
    const authenticate = await (await loadAuth())(config, { roleHolders });
    if (config.shared) {
      const database = await loadDatabase();
      pool = database.createPool ? await database.createPool(config.postgres) : null;
      if (database.verifyPool) {
        await database.verifyPool(pool, { ...config.postgres, pushEnabled: !!config.push });
      }
      const [workspaceModule, engine] = await Promise.all([
        database.createWorkspaceStore
          ? Promise.resolve({ createWorkspaceStore: database.createWorkspaceStore })
          : (dependencies.workspace ?? (() => import("./postgres.mjs")))(),
        (dependencies.engine ?? (() => import(ENGINE_MODULE)))(),
      ]);
      sharedStore = workspaceModule.createWorkspaceStore(pool, {
        workspaceId: config.workspaceId,
        engine,
        push: await createPush(config),
        demoEvents: config.sharedDemoEvents === true,
      });
    }
    return { config, authenticate, sharedStore, pool };
  } catch (error) {
    try {
      await pool?.end();
    } catch {
      /* Preserve the startup failure without private diagnostics. */
    }
    throw error;
  }
}
