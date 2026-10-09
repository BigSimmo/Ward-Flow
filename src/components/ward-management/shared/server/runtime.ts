import "server-only";

import { Pool } from "pg";

import { readSharedConfig } from "./config";
import type { SharedHttpDeps } from "./http";
import { loadSharedMigrations } from "./migrations";
import { createSharedWorldService, type SharedWorldService } from "./service";
import { createPgSharedStateStore } from "./store";

/**
 * The one place the shared-state routes meet the real environment: it reads the env, opens a
 * single `pg` pool on first use and applies the SQL migrations from this folder. Nothing here runs
 * while `DATABASE_URL` is unset.
 */

type RuntimeSlot = { service: SharedWorldService };
const globalSlot = globalThis as typeof globalThis & { __wardFlowShared?: RuntimeSlot };

export function sharedHttpDeps(): SharedHttpDeps {
  const config = readSharedConfig();
  return {
    config,
    service: () => {
      if (!config.enabled || !config.ready) throw new Error("Shared state is not configured");
      // One pool per server process, kept across hot reloads in development.
      if (!globalSlot.__wardFlowShared) {
        const pool = new Pool({ connectionString: config.databaseUrl, max: 5 });
        pool.on("error", () => {
          // An idle client dropped by the database is replaced on the next query.
        });
        globalSlot.__wardFlowShared = {
          service: createSharedWorldService({
            store: createPgSharedStateStore(pool, loadSharedMigrations()),
            typedTextAllowed: config.typedTextAllowed,
          }),
        };
      }
      return globalSlot.__wardFlowShared.service;
    },
    log: (message) => console.error(message),
  };
}
