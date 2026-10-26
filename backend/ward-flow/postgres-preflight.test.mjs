// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NAMESPACE_OBJECT_LIMIT, verifyPostgresNamespace } from "./postgres-preflight.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";

const sqlFiles = [
  "001-shared-workspace",
  "002-workspace-data-mode",
  "003-push-subscriptions",
  "004-trigger-search-path",
  "005-retention-and-indexes",
  "006-row-level-security",
  "007-prototype-only",
  "008-role-access",
  "009-access-cover-requests",
  "010-workspace-records",
  "011-record-access-and-sign-out",
  "012-foreign-key-indexes",
  "013-referral-record-views",
  "014-archived-records",
].map((name) => readFileSync(new URL(`./migrations/${name}.sql`, import.meta.url), "utf8"));

function column(name, definition) {
  const type = /^(uuid|bigint|integer|jsonb|text|timestamptz)\b/.exec(definition)?.[1];
  return {
    name,
    type: type === "timestamptz" ? "timestamp with time zone" : type,
    required: /NOT NULL|PRIMARY KEY/.test(definition),
    identity: /GENERATED ALWAYS AS IDENTITY/.test(definition) ? "a" : "",
    generated: "",
    default_value: /DEFAULT (now\(\)|'[^']*'|\d+)/.exec(definition)?.[1] ?? null,
  };
}

function checkExpressions(sql) {
  const result = [];
  for (const match of sql.matchAll(/CHECK\s*\(/g)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < sql.length && depth; end++) {
      if (sql[end] === "(") depth++;
      if (sql[end] === ")") depth--;
    }
    result.push(
      sql
        .slice(start, end - 1)
        .replace(/(\w+) IN \(([^)]+)\)/g, "$1 = ANY (ARRAY[$2])")
        .replace(/ LIKE /g, " ~~ "),
    );
  }
  return result;
}

const ALL_VERSIONS = Array.from({ length: LATEST_MIGRATION }, (_, index) => index + 1);

function fixture(version = LATEST_MIGRATION) {
  const owner = "migration_admin";
  /** @type {{ owner: string, objects: any[], constraints: any[], functions: any[], triggers: any[], sequences: any[], unknown_types: number, rules: number, policies: any[], extensions: number }} */
  const catalog = {
    owner,
    objects: [],
    constraints: [],
    functions: [],
    triggers: [],
    sequences: [],
    unknown_types: 0,
    rules: 0,
    policies: [],
    extensions: 0,
  };
  const addConstraint = (table, type, keys, details = {}) =>
    catalog.constraints.push({
      table_name: table,
      type,
      keys,
      foreign_schema: null,
      foreign_table: null,
      foreign_keys: [],
      delete_action: " ",
      update_action: " ",
      match_type: " ",
      validated: true,
      deferrable: false,
      deferred: false,
      definition: "",
      ...details,
    });
  const addIndex = (name, table, keys, unique = false, predicate) =>
    catalog.objects.push({
      name,
      kind: "i",
      owner,
      persistence: "p",
      rls: false,
      force_rls: false,
      columns: [],
      valid: true,
      definition: `CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ward_flow.${table} USING btree (${keys})${predicate ? " WHERE (" + predicate + ")" : ""}`,
    });
  const foreign = (table, keys, target, foreignKeys, deletion = "a") =>
    addConstraint(table, "f", keys, {
      foreign_schema: "ward_flow",
      foreign_table: target,
      foreign_keys: foreignKeys,
      delete_action: deletion,
      update_action: "a",
      match_type: "s",
    });
  const checks = (table, sql) => {
    for (const expression of checkExpressions(sql))
      addConstraint(table, "c", [], { definition: `CHECK (${expression})` });
  };
  for (const sql of sqlFiles.slice(0, version)) {
    for (const match of sql.matchAll(/CREATE TABLE ward_flow\.(\w+) \(([\s\S]*?)\n\);/g)) {
      const [, name, body] = match;
      /** @type {{ name: string, kind: string, owner: string, persistence: string, rls: boolean, force_rls: boolean, columns: any[] }} */
      const table = { name, kind: "r", owner, persistence: "p", rls: false, force_rls: false, columns: [] };
      catalog.objects.push(table);
      for (const line of body.split(/\r?\n/).map((line) => line.trim())) {
        const match = /^(\w+) ((?:uuid|bigint|integer|jsonb|text|timestamptz)\b.*)/.exec(line);
        if (!match) continue;
        const [, colName, definition] = match;
        table.columns.push(column(colName, definition));
        if (definition.includes("PRIMARY KEY")) {
          addConstraint(name, "p", [colName]);
          addIndex(name + "_pkey", name, colName, true);
        }
        if (definition.includes(" UNIQUE")) {
          addConstraint(name, "u", [colName]);
          addIndex(name + "_" + colName + "_key", name, colName, true);
        }
        const reference = /REFERENCES ward_flow\.(\w+)\((\w+)\)/.exec(definition);
        if (reference)
          foreign(name, [colName], reference[1], [reference[2]], definition.includes("ON DELETE CASCADE") ? "c" : "a");
        if (definition.includes("GENERATED ALWAYS AS IDENTITY")) {
          const seqName = name + "_" + colName + "_seq";
          catalog.objects.push({
            name: seqName,
            kind: "S",
            owner,
            persistence: "p",
            rls: false,
            force_rls: false,
            columns: [],
          });
          catalog.sequences.push({
            name: seqName,
            type: "bigint",
            start: "1",
            increment: "1",
            minimum: "1",
            maximum: "9223372036854775807",
            cache: "1",
            cycle: false,
            dependency: "i",
            table_name: name,
            column_name: colName,
          });
        }
      }
      const primary = /\n\s*PRIMARY KEY \(([^)]+)\)/.exec(body);
      if (primary) {
        addConstraint(name, "p", primary[1].split(/,\s*/));
        addIndex(name + "_pkey", name, primary[1], true);
      }
      const composite = /FOREIGN KEY \(([^)]+)\) REFERENCES ward_flow\.(\w+)\(([^)]+)\)/.exec(body);
      if (composite) foreign(name, composite[1].split(/,\s*/), composite[2], composite[3].split(/,\s*/));
      checks(name, body);
    }
    for (const match of sql.matchAll(
      /CREATE (UNIQUE )?INDEX (\w+) ON ward_flow\.(\w+)\(([^)]+)\)(?: WHERE ([^;]+))?;/g,
    ))
      addIndex(match[2], match[3], match[4], !!match[1], match[5]);
    for (const match of sql.matchAll(
      /CREATE FUNCTION ward_flow\.(\w+)\(\) RETURNS trigger LANGUAGE plpgsql AS \$\$([\s\S]*?)\$\$;/g,
    ))
      catalog.functions.push({
        name: match[1],
        owner,
        arguments: 0,
        return_type: "trigger",
        language: "plpgsql",
        security_definer: false,
        body: match[2],
        kind: "f",
        settings: version >= 4 ? ["search_path=pg_catalog, ward_flow"] : null,
      });
  }
  if (version >= 2) {
    for (const match of sqlFiles[1].matchAll(/ALTER TABLE ward_flow\.(\w+) ADD COLUMN (\w+) ([^;]+);/g)) {
      catalog.objects.find((o) => o.name === match[1]).columns.push(column(match[2], match[3]));
      checks(match[1], match[3]);
    }
    addConstraint("workspaces", "u", ["id", "data_mode"]);
    addIndex("workspace_mode_unique", "workspaces", "id, data_mode", true);
    for (const table of ["commands", "audit"])
      foreign(table, ["workspace_id", "data_mode"], "workspaces", ["id", "data_mode"]);
  }
  const guarded = new Map();
  for (const sql of sqlFiles.slice(0, version))
    for (const match of sql.matchAll(/CREATE TRIGGER (\w+) BEFORE [\s\S]*? ON ward_flow\.(\w+)/g))
      guarded.set(match[1], match[2]);
  for (const fn of catalog.functions)
    catalog.triggers.push({
      name: fn.name,
      table_name: guarded.get(fn.name),
      function_name: fn.name,
      function_schema: "ward_flow",
      type: fn.name === "protect_workspace_mode" ? 19 : 58,
      enabled: "O",
      arguments: 0,
      columns: "",
      conditional: false,
    });
  for (const object of catalog.objects) object.inherited = false;
  if (version >= 8) {
    const sql = sqlFiles[7];
    const [, role] = /** @type {RegExpExecArray} */ (
      /ADD CONSTRAINT audit_actor_role_check\s+CHECK \(([^;]+)\);/.exec(sql)
    );
    catalog.constraints.find((c) => c.table_name === "audit" && c.definition.includes("actor_role")).definition =
      `CHECK (${checkExpressions("CHECK (" + role + ")")[0]})`;
    const [, scope] = /** @type {RegExpExecArray} */ (/ADD COLUMN actor_scope ([^;]+);/.exec(sql));
    catalog.objects.find((o) => o.name === "audit").columns.push(column("actor_scope", scope));
    checks("audit", scope);
  }
  if (version >= 9) {
    // Columns and a check added to tables that 008 and 003 made.
    for (const match of sqlFiles[8].matchAll(/ALTER TABLE ward_flow\.(\w+) ADD COLUMN (\w+) ([^;]+);/g)) {
      catalog.objects.find((o) => o.name === match[1]).columns.push(column(match[2], match[3]));
      checks(match[1], match[3]);
      const reference = /REFERENCES ward_flow\.(\w+)\((\w+)\)/.exec(match[3]);
      if (reference) foreign(match[1], [match[2]], reference[1], [reference[2]]);
    }
    for (const match of sqlFiles[8].matchAll(/ALTER TABLE ward_flow\.(\w+) ADD CONSTRAINT \w+ (CHECK [^;]+);/g))
      checks(match[1], match[2]);
  }
  if (version >= 7)
    catalog.constraints.find((c) => c.table_name === "workspaces" && c.definition.includes("'live'")).definition =
      "CHECK (data_mode = 'prototype')";
  if (version >= 13) {
    const [, surface] = /** @type {RegExpExecArray} */ (
      /ADD CONSTRAINT record_access_surface_check (CHECK [^;]+);/.exec(sqlFiles[12])
    );
    catalog.constraints.find((c) => c.table_name === "record_access" && c.definition.includes("surface")).definition =
      `CHECK (${checkExpressions(surface)[0]})`;
  }
  if (version >= 6)
    for (const object of catalog.objects.filter((o) => o.kind === "r")) {
      object.rls = true;
      catalog.policies.push({
        table_name: object.name,
        name: "runtime_only",
        permissive: true,
        command: "*",
        roles: "{0}",
        qual: "(CURRENT_USER = 'wardflow_backend'::name)",
        with_check: "(CURRENT_USER = 'wardflow_backend'::name)",
      });
    }
  return catalog;
}

function withPostgresTextDeparse(catalog) {
  const castTextLiterals = (value) => value.replace(/'(?:''|[^'])*'/g, "$&::text");
  for (const object of catalog.objects) {
    for (const field of object.columns ?? []) {
      if (field.default_value?.startsWith("'")) field.default_value = castTextLiterals(field.default_value);
    }
    if (object.kind === "i") object.definition = castTextLiterals(object.definition);
  }
  for (const constraint of catalog.constraints) {
    if (constraint.type !== "c") continue;
    constraint.definition = castTextLiterals(constraint.definition)
      .replace(/^CHECK \(/, "CHECK ((")
      .replace(/\)$/, "))");
  }
  catalog.constraints.find((c) => c.table_name === "audit" && c.definition.includes("outcome")).definition =
    "CHECK ((outcome = ANY (ARRAY['accepted'::text, 'denied'::text, 'stale'::text])))";
  catalog.constraints.find((c) => c.table_name === "workspaces" && c.definition.includes("octet_length")).definition =
    "CHECK ((octet_length((payload)::text) <= 8388608))";
  catalog.constraints.find(
    (c) => c.table_name === "push_subscriptions" && c.definition.includes("endpoint"),
  ).definition = "CHECK (((endpoint ~~ 'https://%'::text) AND (length(endpoint) <= 2048)))";
  return catalog;
}

/** @param {Array<number | string>} [versions] Strings stand for unsafe recorded versions. */
function pool(catalog, versions = ALL_VERSIONS) {
  const queries = [];
  return {
    queries,
    query: async (sql) => {
      queries.push(sql);
      if (sql === `SELECT version FROM ward_flow.migrations ORDER BY version LIMIT ${LATEST_MIGRATION + 1}`)
        return { rows: versions.map((version) => ({ version })) };
      assert.match(sql, /^WITH namespace/);
      assert.doesNotMatch(sql, /(?:ALTER|INSERT INTO|UPDATE ward_flow|DELETE FROM|DROP|CREATE SCHEMA|CREATE TABLE)/);
      return { rows: [catalog] };
    },
  };
}

test("absent namespace is accepted by one read-only catalogue query", async () => {
  const db = pool({ owner: null });
  await verifyPostgresNamespace(db);
  assert.equal(db.queries.length, 1);
});

for (const version of ALL_VERSIONS)
  test(`known migration ${version} namespace permits the separate migration stage`, async () => {
    const db = pool(
      fixture(version),
      Array.from({ length: version }, (_, index) => index + 1),
    );
    await verifyPostgresNamespace(db);
    assert.equal(db.queries.length, 2);
    assert.match(db.queries[1], new RegExp(`LIMIT ${LATEST_MIGRATION + 1}$`));
  });

test("PostgreSQL text-literal casts in defaults, checks and index predicates permit the known schema", async () => {
  const catalog = withPostgresTextDeparse(fixture());
  assert.equal(catalog.objects.find((o) => o.name === "audit").columns[3].default_value, "'coordinator'::text");
  assert.match(
    catalog.constraints.find((c) => c.definition.includes("ARRAY['accepted'"))?.definition ?? "",
    /ARRAY\['accepted'::text, 'denied'::text, 'stale'::text\]/,
  );
  assert.match(
    catalog.objects.find((o) => o.name === "push_deliveries_pending").definition,
    /status = 'pending'::text/,
  );
  await verifyPostgresNamespace(pool(catalog));
});

test("text casts on columns and other literal casts remain subject to exact schema checks", async () => {
  for (const alter of [
    (catalog) => {
      catalog.objects.find((o) => o.name === "audit").columns[3].default_value = "'coordinator'::varchar";
    },
    (catalog) => {
      catalog.constraints.find((c) => c.definition.includes("actor_role")).definition =
        "CHECK ((actor_role = 'coordinator'::varchar))";
    },
    (catalog) => {
      catalog.constraints.find((c) => c.definition.includes("octet_length")).definition =
        "CHECK ((octet_length(payload::jsonb) <= 8388608))";
    },
  ]) {
    const catalog = withPostgresTextDeparse(fixture());
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
});

test("reserved empty namespace and wrong migration-table shape refuse before reading versions", async () => {
  for (const alter of [
    (c) => {
      c.objects = [];
    },
    (c) => {
      c.objects.find((o) => o.name === "migrations").kind = "v";
    },
    (c) => {
      c.objects.find((o) => o.name === "migrations").columns[0].type = "text";
    },
    (c) => {
      c.objects.find((o) => o.name === "migrations").force_rls = true;
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    const db = pool(catalog);
    await assert.rejects(verifyPostgresNamespace(db), /Unrecognised or unsafe/);
    assert.equal(db.queries.length, 1);
  }
});

test("noncontiguous, empty, unsupported and malformed versions refuse migration", async () => {
  for (const versions of [
    [],
    [0],
    [2],
    [1, 3],
    [1, 2, 3, 5],
    [...ALL_VERSIONS, LATEST_MIGRATION + 1],
    [1, 2, 2],
    [1, 2, 3, 4, "5"],
  ])
    await assert.rejects(verifyPostgresNamespace(pool(fixture(), versions)), /Unrecognised or unsafe/);
});

test("altered types, defaults, nullability and mismatched owners refuse migration", async () => {
  for (const alter of [
    (c) => {
      c.objects.find((o) => o.name === "workspaces").columns[1].type = "integer";
    },
    (c) => {
      c.objects.find((o) => o.name === "audit").columns[3].default_value = "'coordinator '::text";
    },
    (c) => {
      c.objects.find((o) => o.name === "commands").columns[0].required = false;
    },
    (c) => {
      c.objects.find((o) => o.name === "workspaces").inherited = true;
    },
    (c) => {
      c.objects[0].owner = "foreign_owner";
    },
    (c) => {
      c.owner = "wardflow_backend";
    },
    (c) => {
      c.objects.find((o) => o.name === "audit").columns[0].identity = "d";
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
  await assert.rejects(
    verifyPostgresNamespace(pool(fixture()), { runtimeRole: "migration_admin" }),
    /Unrecognised or unsafe/,
  );
});

test("unknown classes, functions, indexes and sequences refuse migration", async () => {
  for (const kind of ["r", "v", "m", "i", "S", "f", "p"]) {
    const catalog = fixture();
    catalog.objects.push({ name: "unrelated_sentinel", kind });
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
  for (const key of ["unknown_types", "rules", "extensions"]) {
    const catalog = fixture();
    catalog[key] = 1;
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
  const catalog = fixture();
  catalog.functions.push({ name: "unrelated_function" });
  await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
});

test("weakened keys, checks, references, indexes and identity sequence definitions refuse migration", async () => {
  for (const alter of [
    (c) => {
      c.constraints.find((x) => x.table_name === "commands" && x.type === "p").keys = ["command_id"];
    },
    (c) => {
      c.constraints.find((x) => x.type === "c").definition = "CHECK (true)";
    },
    (c) => {
      c.constraints.find((x) => x.type === "f").foreign_schema = "public";
    },
    (c) => {
      c.constraints.find((x) => x.type === "f").delete_action = "c";
    },
    (c) => {
      c.constraints[0].validated = false;
    },
    (c) => {
      c.objects.find((x) => x.name === "audit_workspace_sequence").definition += " WHERE false";
    },
    (c) => {
      c.objects.find((x) => x.kind === "i").valid = false;
    },
    (c) => {
      c.sequences[0].increment = "2";
    },
    (c) => {
      c.sequences[0].table_name = "commands";
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
});

test("changed audit/mode protector bodies, ownership, paths and conditional/disabled triggers refuse migration", async () => {
  for (const alter of [
    (c) => {
      c.functions[0].body = "BEGIN RETURN NEW; END";
    },
    (c) => {
      c.functions[0].owner = "foreign_owner";
    },
    (c) => {
      c.functions[0].settings = ["search_path=public"];
    },
    (c) => {
      c.functions[0].settings = null;
    },
    (c) => {
      c.functions[0].arguments = 1;
    },
    (c) => {
      c.triggers[0].enabled = "D";
    },
    (c) => {
      c.triggers[0].conditional = true;
    },
    (c) => {
      c.triggers[0].type = 16;
    },
    (c) => {
      c.triggers[0].function_schema = "public";
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
});

test("catalogue and migration ledger reads fail without exposing upstream errors", async () => {
  await assert.rejects(
    verifyPostgresNamespace({
      query: async () => {
        throw new Error("synthetic secret upstream");
      },
    }),
    { message: "Ward Flow database namespace verification unavailable" },
  );
  const db = pool(fixture());
  const query = db.query;
  db.query = async (sql) => {
    if (sql.startsWith("SELECT version")) throw new Error("synthetic secret upstream");
    return query(sql);
  };
  await assert.rejects(verifyPostgresNamespace(db), {
    message: "Ward Flow database migration identity verification unavailable",
  });
});

test("bounded catalog overflow and incomplete summaries refuse migration", async () => {
  for (const alter of [
    (c) => {
      c.objects = Array.from({ length: NAMESPACE_OBJECT_LIMIT + 1 }, () => c.objects[0]);
    },
    (c) => {
      c.constraints = undefined;
    },
    (c) => {
      c.unknown_types = undefined;
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
});

test("row-level security must match the version: none before 6, the runtime-only policy on every table from 6", async () => {
  const five = fixture(5);
  five.objects.find((o) => o.name === "audit").rls = true;
  await assert.rejects(verifyPostgresNamespace(pool(five, [1, 2, 3, 4, 5])), /Unrecognised or unsafe/);
  const stray = fixture(5);
  stray.policies.push({ ...fixture().policies[0] });
  await assert.rejects(verifyPostgresNamespace(pool(stray, [1, 2, 3, 4, 5])), /Unrecognised or unsafe/);
  for (const alter of [
    (c) => {
      c.objects.find((o) => o.name === "commands").rls = false;
    },
    (c) => {
      c.objects.find((o) => o.name === "workspaces").force_rls = true;
    },
    (c) => {
      c.objects.find((o) => o.kind === "i").rls = true;
    },
    (c) => {
      c.policies.pop();
    },
    (c) => {
      c.policies.push({ ...c.policies[0], name: "browser_read" });
    },
    (c) => {
      c.policies[0].qual = "true";
    },
    (c) => {
      c.policies[0].with_check = null;
    },
    (c) => {
      c.policies[0].roles = "{16384}";
    },
    (c) => {
      c.policies[0].permissive = false;
    },
    (c) => {
      c.policies[0].command = "r";
    },
    (c) => {
      c.policies[0].qual = "(CURRENT_USER = 'authenticated'::name)";
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
});

test("from migration 7 the workspace check allows prototype only; before it, prototype or live", async () => {
  const six = fixture(6);
  await verifyPostgresNamespace(pool(six, [1, 2, 3, 4, 5, 6]));
  six.constraints.find((c) => c.definition.includes("'live'")).definition = "CHECK (data_mode = 'prototype')";
  await assert.rejects(verifyPostgresNamespace(pool(six, [1, 2, 3, 4, 5, 6])), /Unrecognised or unsafe/);
  const seven = fixture();
  seven.constraints.find((c) => c.definition === "CHECK (data_mode = 'prototype')").definition =
    "CHECK ((data_mode = ANY (ARRAY['prototype'::text, 'live'::text])))";
  await assert.rejects(verifyPostgresNamespace(pool(seven)), /Unrecognised or unsafe/);
});

test("from migration 8 memberships, break glass and the widened audit role are exact; before it they are refused", async () => {
  const seven = fixture(8);
  await assert.rejects(verifyPostgresNamespace(pool(seven, [1, 2, 3, 4, 5, 6, 7])), /Unrecognised or unsafe/);
  for (const alter of [
    (c) => {
      c.constraints.find((k) => k.table_name === "audit" && k.definition.includes("actor_role")).definition =
        "CHECK (actor_role = 'coordinator')";
    },
    (c) => {
      c.objects.find((o) => o.name === "audit").columns.pop();
    },
    (c) => {
      c.constraints = c.constraints.filter((k) => !k.definition.includes("granted_by <> actor_id"));
    },
    (c) => {
      c.constraints = c.constraints.filter(
        (k) => !(k.table_name === "break_glass" && k.foreign_table === "memberships"),
      );
    },
    (c) => {
      c.objects = c.objects.filter((o) => o.name !== "memberships_actor_active");
    },
    (c) => {
      c.policies = c.policies.filter((p) => p.table_name !== "break_glass");
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
});

test("from migration 9 cover, requests for access and alerts by role are exact; before it they are refused", async () => {
  await assert.rejects(verifyPostgresNamespace(pool(fixture(9), [1, 2, 3, 4, 5, 6, 7, 8])), /Unrecognised or unsafe/);
  for (const alter of [
    (c) => {
      c.objects.find((o) => o.name === "memberships").columns.pop();
    },
    (c) => {
      c.objects.find((o) => o.name === "push_subscriptions").columns.pop();
    },
    (c) => {
      c.constraints = c.constraints.filter((k) => !k.definition.includes("kind = 'role' OR"));
    },
    (c) => {
      c.constraints = c.constraints.filter(
        (k) => !(k.table_name === "push_subscriptions" && k.foreign_table === "memberships"),
      );
    },
    (c) => {
      c.objects = c.objects.filter((o) => o.name !== "access_requests_one_open");
    },
    (c) => {
      c.objects.find((o) => o.name === "access_requests_one_open").definition = c.objects
        .find((o) => o.name === "access_requests_one_open")
        .definition.replace("UNIQUE ", "");
    },
    (c) => {
      c.policies = c.policies.filter((p) => p.table_name !== "access_requests");
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
});

test("from migration 11 the record access log, its guards and sign-outs are exact; before it they are refused", async () => {
  await assert.rejects(
    verifyPostgresNamespace(pool(fixture(11), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])),
    /Unrecognised or unsafe/,
  );
  await assert.rejects(verifyPostgresNamespace(pool(fixture(10), ALL_VERSIONS)), /Unrecognised or unsafe/);
  for (const alter of [
    (c) => {
      c.triggers = c.triggers.filter((t) => t.name !== "protect_record_access");
    },
    (c) => {
      c.triggers = c.triggers.filter((t) => t.name !== "protect_break_glass");
    },
    (c) => {
      c.triggers.find((t) => t.name === "protect_break_glass").type = 19;
    },
    (c) => {
      c.functions.find((f) => f.name === "protect_record_access").body = "BEGIN RETURN NULL; END";
    },
    (c) => {
      c.constraints = c.constraints.filter((k) => !k.definition.includes("surface"));
    },
    (c) => {
      c.objects = c.objects.filter((o) => o.name !== "record_access_patient");
    },
    (c) => {
      c.policies = c.policies.filter((p) => p.table_name !== "session_sign_outs");
    },
  ]) {
    const catalog = fixture();
    alter(catalog);
    await assert.rejects(verifyPostgresNamespace(pool(catalog)), /Unrecognised or unsafe/);
  }
});

test("the namespace object bound keeps headroom above the latest schema", async () => {
  // Production audit DB-04: hitting the bound refuses every migrate and prune as "unsafe namespace".
  const catalog = fixture();
  await verifyPostgresNamespace(pool(catalog));
  assert.ok(
    catalog.objects.length <= NAMESPACE_OBJECT_LIMIT - 10,
    `${catalog.objects.length} objects is within 10 of the ${NAMESPACE_OBJECT_LIMIT} bound; raise it`,
  );
});
