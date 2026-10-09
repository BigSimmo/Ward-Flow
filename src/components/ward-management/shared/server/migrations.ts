import { readFileSync } from "node:fs";
import path from "node:path";

import type { SharedMigration } from "./store";

/** Applied in this order. Add a file here and in `migrations/`; never edit one already applied. */
const MIGRATION_FILES = ["001_shared_state.sql"] as const;

/**
 * Reads the plain SQL migrations. `next start` runs from the repository root on Railway, so the
 * files are read from the source tree rather than bundled.
 */
export function loadSharedMigrations(root: string = process.cwd()): SharedMigration[] {
  return MIGRATION_FILES.map((name) => ({
    name,
    sql: readFileSync(
      path.join(root, "src", "components", "ward-management", "shared", "server", "migrations", name),
      "utf8",
    ),
  }));
}
