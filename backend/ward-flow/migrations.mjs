// @ts-check
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * The one list of shared-schema migrations, in order. migrate.mjs applies them, postgres.mjs
 * `ready()` accepts MINIMUM_RUNTIME_MIGRATION through the latest. postgres-preflight.mjs bounds
 * the ledger by the latest. Adding a migration means one entry here plus its SQL file; nothing
 * else hard-codes the version.
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
    file: "010-workspace-records.sql",
    sha256: "067f6093dd1c1fa609f99b361c9c18c5bfce46f01b01f75f9fbbf9b3218d9d9b",
  },
  {
    version: 11,
    file: "011-record-access-and-sign-out.sql",
    sha256: "92e8edd61d97502e9827004c5abd6dcfc88deebead7668b9ae58c6ded97812cd",
  },
  {
    version: 12,
    file: "012-foreign-key-indexes.sql",
    sha256: "7de22a95f0ecee0fe53c2f0964a2a72eaea016522dd8c7960fed5cf697577fed",
  },
  {
    version: 13,
    file: "013-referral-record-views.sql",
    sha256: "9de1c9faa77af43e560d3ab514fdf3f8e16626fcac6102fa4beaeba90fe459a4",
  },
  {
    version: 14,
    file: "014-archived-records.sql",
    sha256: "2e399d2bc7bbb5efc45cd92b9e631f7da4ab153b59804f1a99ef2ba12a7353d1",
  },
  {
    version: 15,
    file: "015-list-and-tv-views.sql",
    sha256: "6705ed94c5ee6d242c9756849ad05865e12fa5093152bb8c70751b5247ef402e",
  },
]);

export const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * The oldest schema the running backend accepts. Row-level security (6), the prototype-only check
 * (7), role access (8), cover with requests (9), records saved one by one (10) and the record access
 * log with sign-outs (11) are applied to a live database separately, so the backend runs on 5 to 15:
 * it can deploy before those migrations, and keeps running if their infra/rollback-*.sql scripts take
 * the database back. Before 8 only the WARD_COORDINATOR_USER_IDS accounts can sign in. Before 9 there
 * is no cover, no request for access, no "not used" switch-off and no phone alert by role. Before 10
 * the workspace is saved as one record, so any change refuses every other save made against an older
 * revision. Before 11 opening a record is not logged and a sign-out does not end the sign-in's token
 * on this server. Migration 12 adds indexes only, so nothing behaves differently before it. Before
 * 13 opening a referral's full detail is not logged. Before 14 closed records are never archived, so
 * the live workspace keeps growing towards its 8 MB limit.
 */
export const MINIMUM_RUNTIME_MIGRATION = 5;

/** The first schema with memberships and break glass records (migration 8). */
export const ROLE_ACCESS_MIGRATION = 8;

/** The first schema with cover, requests for access, last used times and alerts by role (migration 9). */
export const ACCESS_COVER_MIGRATION = 9;

/** The first schema that saves each record of the workspace as its own row (migration 10). */
export const RECORDS_MIGRATION = 10;

/** The first schema with the record access log and server-side sign-outs (migration 11). */
export const RECORD_ACCESS_MIGRATION = 11;

/** The first schema whose record access log takes a referral opening (migration 13). */
export const REFERRAL_VIEW_MIGRATION = 13;

/** The first schema that moves closed records older than 30 days into the archive (migration 14). */
export const ARCHIVE_MIGRATION = 14;

/** The first schema whose record access log takes a whole-list or TV read (migration 15, H-0731). */
export const LIST_VIEW_MIGRATION = 15;

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
