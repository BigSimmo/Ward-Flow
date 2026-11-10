// @ts-check
// Audit M34: a free, in-repo migration linter. It flags migration steps that take a long or heavy
// lock on a table that already holds rows, or that the previous live backend could not run
// against. Every step it flags in a shipped migration is listed below with the reason it was
// accepted; a new flagged step fails this test until it is rewritten or reviewed and listed.
// The second test applies each migration in turn to real loopback PostgreSQL holding synthetic
// rows and reports any table rewrite, which a text rule could miss. No provider is contacted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { MIGRATIONS, readMigration } from "./migrations.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Migration lint database checks require isolated loopback PostgreSQL");

/**
 * Splits a migration into statements: `;` at the end of a statement, outside `$$` bodies, with
 * `--` comments removed.
 * @param {string} sql
 */
function statements(sql) {
  const text = sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  const out = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    if (text.startsWith("$$", index)) {
      quoted = !quoted;
      current += "$$";
      index++;
      continue;
    }
    if (text[index] === ";" && !quoted) {
      if (current.trim()) out.push(current.trim().replace(/\s+/g, " "));
      current = "";
    } else current += text[index];
  }
  if (current.trim()) out.push(current.trim().replace(/\s+/g, " "));
  return out;
}

const VOLATILE_DEFAULT =
  /\bDEFAULT\s+(now\(\)|clock_timestamp\(\)|random\(\)|gen_random_uuid\(\)|uuid_generate_v4\(\))/i;

/**
 * The lock-heavy or backward-incompatible patterns, each with why it matters during a shift. Each
 * rule sees one statement and the tables that existed before this migration (`existing`).
 * @type {Array<{ id: string, why: string, match: (statement: string, existing: Set<string>) => boolean }>}
 */
const RULES = [
  {
    id: "index-blocks-writes",
    why: "CREATE INDEX without CONCURRENTLY blocks every write to the table while the index builds",
    match: (s, existing) => {
      const m = /^CREATE (UNIQUE )?INDEX (?!CONCURRENTLY)(IF NOT EXISTS )?\S+ ON (ward_flow\.)?(\w+)/i.exec(s);
      return !!m && existing.has(m[4]);
    },
  },
  {
    id: "constraint-validates-under-lock",
    why: "a CHECK or FOREIGN KEY added without NOT VALID (as a constraint or on a new column) scans every row while holding the lock",
    match: (s, existing) =>
      /^ALTER TABLE (ward_flow\.)?(\w+)/i.test(s) &&
      existing.has(/** @type {RegExpExecArray} */ (/^ALTER TABLE (?:ward_flow\.)?(\w+)/i.exec(s))[1]) &&
      (/ADD CONSTRAINT \S+ (CHECK|FOREIGN KEY)/i.test(s) || /ADD COLUMN .*\b(CHECK|REFERENCES)\b/i.test(s)) &&
      !/NOT VALID/i.test(s),
  },
  {
    id: "column-rewrite",
    why: "ALTER COLUMN TYPE, or ADD COLUMN with a volatile default, rewrites the whole table under an exclusive lock",
    match: (s, existing) =>
      /^ALTER TABLE (ward_flow\.)?(\w+)/i.test(s) &&
      existing.has(/** @type {RegExpExecArray} */ (/^ALTER TABLE (?:ward_flow\.)?(\w+)/i.exec(s))[1]) &&
      (/ALTER COLUMN \S+ (SET DATA )?TYPE/i.test(s) || (/ADD COLUMN/i.test(s) && VOLATILE_DEFAULT.test(s))),
  },
  {
    id: "not-null-scan",
    why: "SET NOT NULL on an existing column scans every row under an exclusive lock",
    match: (s, existing) =>
      /^ALTER TABLE (ward_flow\.)?(\w+)/i.test(s) &&
      existing.has(/** @type {RegExpExecArray} */ (/^ALTER TABLE (?:ward_flow\.)?(\w+)/i.exec(s))[1]) &&
      /ALTER COLUMN \S+ SET NOT NULL/i.test(s),
  },
  {
    id: "bulk-row-change",
    why: "an UPDATE or DELETE of existing rows in a migration holds row locks for the whole transaction",
    match: (s, existing) => {
      const m = /^(UPDATE|DELETE FROM) (ward_flow\.)?(\w+)/i.exec(s);
      return !!m && existing.has(m[3]);
    },
  },
  {
    id: "breaks-previous-backend",
    why: "dropping or renaming a table or column the previous live backend reads breaks it mid-release",
    match: (s) =>
      /^DROP TABLE/i.test(s) ||
      /^ALTER TABLE \S+ (DROP COLUMN|RENAME)/i.test(s) ||
      /^ALTER TABLE \S+ .*\bDROP COLUMN\b/i.test(s),
  },
  {
    id: "explicit-heavy-lock",
    why: "LOCK TABLE, VACUUM FULL and CLUSTER take the strongest lock for as long as they run",
    match: (s) => /^(LOCK TABLE|VACUUM FULL|CLUSTER)\b/i.test(s),
  },
];

/** Every flagged step in the shipped migrations, as `file#statement-number rule`, with the reason it stands. */
function lint(files) {
  const existing = new Set();
  const flagged = [];
  for (const { file, sql } of files) {
    const before = new Set(existing);
    statements(sql).forEach((statement, index) => {
      for (const rule of RULES) if (rule.match(statement, before)) flagged.push(`${file}#${index + 1} ${rule.id}`);
      const created = /^CREATE TABLE (IF NOT EXISTS )?(ward_flow\.)?(\w+)/i.exec(statement);
      if (created) existing.add(created[3]);
    });
  }
  return flagged;
}

/**
 * Reviewed exceptions. Each ran while the prototype's tables held one synthetic workspace, so the
 * lock lasted milliseconds. A step listed here would need rewriting (NOT VALID then VALIDATE, a
 * separate concurrent index, an expand-then-contract column change) once real volumes exist.
 */
const SMALL = "applied while the table held one synthetic workspace's rows; the scan or build took milliseconds";
const ACCEPTED = Object.fromEntries([
  ...[
    "002-workspace-data-mode.sql#1",
    "002-workspace-data-mode.sql#4",
    "002-workspace-data-mode.sql#6",
    "007-prototype-only.sql#3",
    "008-role-access.sql#6",
    "008-role-access.sql#7",
    "009-access-cover-requests.sql#1",
    "009-access-cover-requests.sql#3",
    "009-access-cover-requests.sql#7",
    "013-referral-record-views.sql#2",
    "015-list-and-tv-views.sql#2",
  ].map((step) => [`${step} constraint-validates-under-lock`, SMALL]),
  ...["005-retention-and-indexes.sql#1", "005-retention-and-indexes.sql#2"].map((step) => [
    `${step} index-blocks-writes`,
    SMALL,
  ]),
  // Migration 12 adds the indexes behind each foreign key; migrate.mjs runs every file in one
  // transaction, where CREATE INDEX CONCURRENTLY is not allowed.
  ...Array.from({ length: 13 }, (_, index) => [
    `012-foreign-key-indexes.sql#${index + 1} index-blocks-writes`,
    `${SMALL}; CONCURRENTLY cannot run inside the migration transaction`,
  ]),
  // Starts each existing role's "last used" clock once, so no role switches off as 009 lands.
  ["009-access-cover-requests.sql#4 bulk-row-change", SMALL],
]);

test("migration linter: no unreviewed lock-heavy or backward-incompatible step in a shipped migration", async () => {
  const files = await Promise.all(
    MIGRATIONS.map(async (migration) => ({ file: migration.file, sql: await readMigration(migration) })),
  );
  const flagged = lint(files);
  assert.deepEqual(
    flagged.filter((entry) => !Object.hasOwn(ACCEPTED, entry)),
    [],
    "a flagged step must be rewritten, or reviewed and listed in ACCEPTED with its reason",
  );
  assert.deepEqual(
    Object.keys(ACCEPTED).filter((entry) => !flagged.includes(entry)),
    [],
    "an ACCEPTED entry no longer flagged must be removed",
  );
});

test("migration linter: each rule flags the step it is written for and passes its safe form", () => {
  const existing = new Set(["audit", "workspaces"]);
  /** @type {Array<[string, string, boolean]>} */
  const cases = [
    ["index-blocks-writes", "CREATE INDEX audit_actor ON ward_flow.audit(actor_id)", true],
    ["index-blocks-writes", "CREATE INDEX CONCURRENTLY audit_actor ON ward_flow.audit(actor_id)", false],
    ["index-blocks-writes", "CREATE INDEX fresh_x ON ward_flow.fresh(x)", false],
    ["constraint-validates-under-lock", "ALTER TABLE ward_flow.audit ADD CONSTRAINT a CHECK (sequence > 0)", true],
    [
      "constraint-validates-under-lock",
      "ALTER TABLE ward_flow.audit ADD CONSTRAINT a CHECK (sequence > 0) NOT VALID",
      false,
    ],
    [
      "constraint-validates-under-lock",
      "ALTER TABLE ward_flow.audit ADD COLUMN kind text NOT NULL DEFAULT 'a' CHECK (kind IN ('a'))",
      true,
    ],
    ["column-rewrite", "ALTER TABLE ward_flow.audit ALTER COLUMN action TYPE varchar(80)", true],
    ["column-rewrite", "ALTER TABLE ward_flow.audit ADD COLUMN seen_at timestamptz DEFAULT now()", true],
    ["column-rewrite", "ALTER TABLE ward_flow.audit ADD COLUMN mode text NOT NULL DEFAULT 'prototype'", false],
    ["not-null-scan", "ALTER TABLE ward_flow.workspaces ALTER COLUMN payload SET NOT NULL", true],
    ["bulk-row-change", "UPDATE ward_flow.workspaces SET revision = revision + 1", true],
    ["breaks-previous-backend", "ALTER TABLE ward_flow.audit DROP COLUMN changes", true],
    ["breaks-previous-backend", "ALTER TABLE ward_flow.audit RENAME COLUMN changes TO diff", true],
    ["explicit-heavy-lock", "LOCK TABLE ward_flow.audit IN ACCESS EXCLUSIVE MODE", true],
  ];
  for (const [id, statement, expected] of cases) {
    const rule = /** @type {(typeof RULES)[number]} */ (RULES.find((candidate) => candidate.id === id));
    assert.equal(rule.match(statement, existing), expected, `${id}: ${statement}`);
  }
  assert.deepEqual(statements("DO $$ BEGIN PERFORM 1; END $$;\n-- note; here\nSELECT 2;"), [
    "DO $$ BEGIN PERFORM 1; END $$",
    "SELECT 2",
  ]);
});

test(
  "real PostgreSQL: applying each migration to a database holding rows rewrites no existing table unexpectedly",
  { skip: !url, timeout: 60_000 },
  async () => {
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_m34_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(/** @type {string} */ (url));
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const owner = new Pool({ connectionString: target.href, max: 1 });
    const rewrites = [];
    try {
      const files = await Promise.all(MIGRATIONS.map(readMigration));
      const workspaceId = randomUUID();
      for (const [index, migration] of MIGRATIONS.entries()) {
        const { rows: before } = await owner.query(
          "SELECT c.relname, c.relfilenode FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ward_flow' AND c.relkind='r'",
        );
        await owner.query("BEGIN");
        await owner.query(files[index]);
        await owner.query("COMMIT");
        const { rows: after } = await owner.query(
          "SELECT c.relname, c.relfilenode FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ward_flow' AND c.relkind='r'",
        );
        for (const table of before) {
          const now = after.find((row) => row.relname === table.relname);
          if (now && now.relfilenode !== table.relfilenode) rewrites.push(`${migration.file} ${table.relname}`);
        }
        // Synthetic rows after the first migration, so later steps meet a table that is not empty.
        if (migration.version === 1) {
          await owner.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 1, '{}'::jsonb)", [
            workspaceId,
          ]);
          await owner.query(
            "INSERT INTO ward_flow.audit(workspace_id, actor_id, action, outcome, prior_revision, revision, changes) VALUES ($1, $2, 'INITIALISE_WORKSPACE', 'accepted', 0, 1, '{}'::jsonb)",
            [workspaceId, randomUUID()],
          );
        }
      }
      assert.deepEqual(rewrites, EXPECTED_REWRITES, "a migration that rewrites a table must be reviewed and listed");
      // Control: a step that does rewrite is seen by this check (rolled back afterwards).
      const fileNode = "SELECT relfilenode FROM pg_class WHERE oid='ward_flow.workspaces'::regclass";
      await owner.query("BEGIN");
      try {
        const { rows: start } = await owner.query(fileNode);
        await owner.query("ALTER TABLE ward_flow.workspaces ALTER COLUMN revision TYPE numeric");
        const { rows: end } = await owner.query(fileNode);
        assert.notEqual(end[0].relfilenode, start[0].relfilenode, "a column type change shows as a rewrite");
      } finally {
        await owner.query("ROLLBACK");
      }
    } finally {
      await owner.end();
      await dropTestDatabase(admin, database);
      await admin.end();
    }
  },
);

/** Table rewrites the shipped migrations make, each reviewed; see ACCEPTED for the reasoning. */
const EXPECTED_REWRITES = [];
