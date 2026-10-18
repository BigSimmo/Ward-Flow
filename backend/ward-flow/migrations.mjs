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
  {
    version: 8,
    file: "008-role-access.sql",
    sha256: "0b65ef63500d8ba6e074d1a501bb22f8810c21a4e565dfffe639f98383f788f2",
  },
  {
    version: 9,
    file: "009-access-cover-requests.sql",
    sha256: "b00a48946cbe64298019d0c5a4734d4fd4d9157af5636fc075656e7a08c65cb2",
  },
  {
    version: 10,
    file: "010-record-access-and-sign-out.sql",
    sha256: "e69396e45246d0ff88ee41a423edf8ae076d9375c0f6a7492965e11ee926616e",
  },
]);

export const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * The oldest schema the running backend accepts. Row-level security (6), the prototype-only check
 * (7), role access (8), cover with requests (9) and the record access log with sign-outs (10) are
 * applied to a live database separately, so the backend runs on 5 to 10: it can deploy before those
 * migrations, and keeps running if their infra/rollback-*.sql scripts take the database back. Before
 * 8 only the WARD_COORDINATOR_USER_IDS accounts can sign in. Before 9 there is no cover, no request
 * for access, no "not used" switch-off and no phone alert by role. Before 10 opening a record is
 * not logged and a sign-out does not end the sign-in's token on this server.
 */
export const MINIMUM_RUNTIME_MIGRATION = 5;

/** The first schema with memberships and break glass records (migration 8). */
export const ROLE_ACCESS_MIGRATION = 8;

/** The first schema with cover, requests for access, last used times and alerts by role (migration 9). */
export const ACCESS_COVER_MIGRATION = 9;

/** The first schema with the record access log and server-side sign-outs (migration 10). */
export const RECORD_ACCESS_MIGRATION = 10;

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
