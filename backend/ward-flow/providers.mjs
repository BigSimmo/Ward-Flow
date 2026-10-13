import { createPush } from "./push.mjs";

async function azureFactories() {
  const [{ openStorage, createStore }, { createAuthenticator }] = await Promise.all([
    import("./database.mjs"),
    import("./auth.mjs"),
  ]);
  return {
    openStorage,
    createStore,
    createAuthenticator,
    createPool: async (config) => (await import("./postgres.mjs")).createPostgresPool(config),
  };
}

async function supabaseFactories() {
  const [{ createSupabasePool, verifySupabaseRuntimeRole }, { createSupabaseAuthenticator }] = await Promise.all([
    import("./supabase-postgres.mjs"),
    import("./supabase-auth.mjs"),
  ]);
  return {
    createPool: createSupabasePool,
    verifyPool: verifySupabaseRuntimeRole,
    createAuthenticator: createSupabaseAuthenticator,
  };
}

async function postgresFactories() {
  const { createPortablePostgresPool, verifyPortableRuntimeRole } = await import("./portable-postgres.mjs");
  return { createPool: createPortablePostgresPool, verifyPool: verifyPortableRuntimeRole };
}

/** Provider setup is lazy: Supabase never opens Blob Storage or constructs an Azure credential. */
export async function createBackend(config, dependencies = {}) {
  const provider = config.databaseProvider ?? "azure";
  const loaders = {
    azure: dependencies.azure ?? azureFactories,
    supabase: dependencies.supabase ?? supabaseFactories,
    postgres: dependencies.postgres ?? postgresFactories,
  };
  if (!Object.hasOwn(loaders, provider)) throw new Error("Invalid backend provider");
  const factories = await loaders[provider]();
  let pool;
  try {
    const authProvider = config.authProvider ?? "entra";
    let createAuthenticator;
    if (
      (provider === "supabase" && authProvider === "supabase") ||
      (provider === "azure" && authProvider === "entra")
    ) {
      createAuthenticator = factories.createAuthenticator;
    } else if (authProvider === "supabase") {
      createAuthenticator =
        dependencies.supabaseAuth ?? (await import("./supabase-auth.mjs")).createSupabaseAuthenticator;
    } else if (authProvider === "entra") {
      createAuthenticator = dependencies.entraAuth ?? (await import("./auth.mjs")).createAuthenticator;
    } else throw new Error("Invalid identity provider");
    const authenticate = await createAuthenticator(config);
    const store = provider === "azure" ? factories.createStore(await factories.openStorage(config.storage)) : null;
    let sharedStore;
    if (config.shared) {
      pool = await factories.createPool(config.postgres);
      await factories.verifyPool?.(pool, { ...config.postgres, pushEnabled: !!config.push });
      const [{ createWorkspaceStore }, engine] = await Promise.all([
        (dependencies.workspace ?? (() => import("./postgres.mjs")))(),
        (dependencies.engine ?? (() => import("./dist/engine.mjs")))(),
      ]);
      sharedStore = createWorkspaceStore(pool, {
        workspaceId: config.workspaceId,
        engine,
        push: await createPush(config),
      });
    }
    return { config, store, authenticate, sharedStore, pool };
  } catch (error) {
    try {
      await pool?.end();
    } catch {
      /* Preserve the startup failure without private diagnostics. */
    }
    throw error;
  }
}
