// @ts-check
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * The one list of shared-schema migrations, in order. migrate.mjs applies them, postgres.mjs
 * `ready()` requires the latest, and postgres-preflight.mjs bounds the ledger by it. Adding a
 * migration means one entry here plus its SQL file; nothing else hard-codes the version.
 *
 * Each SHA-256 is of the file with line endings normalised to LF. A file edited after it shipped
 * no longer matches, and the runner refuses to apply anything rather than run changed SQL.
 */
export const MIGRATIONS = Object.freeze([
  {
    version: 1,
    file: "001-shared-workspace.sql",
    sha256: "3495229210b6d18c5285b96234bb26bf112a6a0d8d4fa88a740b75daae70e763",
  },
  {
    version: 2,
    file: "002-workspace-data-mode.sql",
    sha256: "077f0c7032540edde6254e239f5afac14bd7a8378f629e7d342010fbefe95182",
  },
  {
    version: 3,
    file: "003-push-subscriptions.sql",
    sha256: "4560b9e1d3ef5ea34883eeb1efba25f6b7b7d05aa6a0c9bfc4e4c892ec1bed0a",
  },
  {
    version: 4,
    file: "004-trigger-search-path.sql",
    sha256: "e343fc624c3001f8478b73d75eaf1734f23600a673f0e06b718d5760684d5269",
  },
  {
    version: 5,
    file: "005-retention-and-indexes.sql",
    sha256: "60b974d282568a5183d2e855b702c19cbbfe9d59a102a85132267bc15131e2ec",
  },
  {
    version: 6,
    file: "006-row-level-security.sql",
    sha256: "71b2829ed1661df8ae0be9830f4c467934ad93f6a6959459775c60f9dfe666b5",
  },
  {
    version: 7,
    file: "007-prototype-only.sql",
    sha256: "e4d885037bb1660e58800cdc5d66d075d7eb8ec9c4750322dde346df5c09172f",
  },
]);

export const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * The oldest schema the running backend accepts. Row-level security (6) and the prototype-only
 * check (7) are applied to a live database separately, so the backend runs on 5 to 7: it can
 * deploy before those migrations, and keeps running if their infra/rollback-*.sql scripts take the
 * database back.
 */
export const MINIMUM_RUNTIME_MIGRATION = 5;

/** Reads one migration's SQL and refuses it when the file no longer matches its recorded checksum. */
export async function readMigration(migration) {
  const sql = (await readFile(new URL(`./migrations/${migration.file}`, import.meta.url), "utf8")).replace(
    /\r\n/g,
    "\n",
  );
  if (createHash("sha256").update(sql).digest("hex") !== migration.sha256)
    throw new Error("Database migration file checksum mismatch");
  return sql;
}
