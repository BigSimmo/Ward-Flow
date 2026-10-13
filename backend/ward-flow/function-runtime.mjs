import { readConfig } from "./config.mjs";
import { createBackend } from "./providers.mjs";
import { createHandler } from "./server.mjs";

/** All HTTP hosts use the same database and identity factories. */
export function createFunctionRuntime(dependencies = {}) {
  let pending;
  let sharedStore;
  return {
    getSharedStore: () => sharedStore,
    getHandler() {
      pending ??= (async () => {
        const backend = await (dependencies.createBackend ?? createBackend)((dependencies.readConfig ?? readConfig)());
        try {
          const handler = (dependencies.createHandler ?? createHandler)(backend);
          sharedStore = backend.sharedStore;
          return handler;
        } catch (error) {
          try {
            await backend.pool?.end();
          } catch {
            /* Preserve the original startup failure. */
          }
          throw error;
        }
      })().catch((error) => {
        pending = undefined;
        sharedStore = undefined;
        throw error;
      });
      return pending;
    },
  };
}
