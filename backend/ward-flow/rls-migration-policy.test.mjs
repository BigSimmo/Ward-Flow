import assert from "node:assert/strict";
import { test } from "node:test";
import { migrationPolicyIssues } from "./rls-migration-policy.mjs";
test("early tables may gain RLS in a later migration", () => {
  assert.deepEqual(
    migrationPolicyIssues([
      { name: "001.sql", sql: "CREATE TABLE ward_flow.records (id uuid);" },
      {
        name: "006.sql",
        sql: "ALTER TABLE ward_flow.records ENABLE ROW LEVEL SECURITY; CREATE POLICY runtime_only ON ward_flow.records USING (current_user = 'wardflow_backend');",
      },
    ]),
    [],
  );
});
test("missing policies, later RLS disabling and quoted table names cannot bypass the guard", () => {
  const issues = migrationPolicyIssues([
    {
      name: "001.sql",
      sql: 'CREATE TABLE IF NOT EXISTS "ward_flow"."records" (id uuid); -- ENABLE ROW LEVEL SECURITY\nALTER TABLE "ward_flow"."records" ENABLE ROW LEVEL SECURITY; ALTER TABLE "ward_flow"."records" DISABLE ROW LEVEL SECURITY;',
    },
  ]);
  assert.equal(issues.length, 2);
  assert.match(issues.join(" "), /records.*RLS/);
  assert.match(issues.join(" "), /records.*policy/);
});
test("views and comments do not create imaginary tables", () => {
  assert.deepEqual(
    migrationPolicyIssues([
      { name: "001.sql", sql: "-- CREATE TABLE ward_flow.fake (id uuid);\nCREATE VIEW ward_flow.report AS SELECT 1;" },
    ]),
    [],
  );
});

test("DDL variants and nested comments cannot fake a protecting policy", () => {
  assert.match(
    migrationPolicyIssues([
      {
        name: "1.sql",
        sql: "CREATE UNLOGGED TABLE ward_flow.records(id uuid); /* outer /* nested */ CREATE POLICY fake ON ward_flow.records USING(true); */ ALTER TABLE IF EXISTS ONLY ward_flow.records ENABLE ROW LEVEL SECURITY;",
      },
    ]).join(" "),
    /no policy/,
  );
  assert.match(
    migrationPolicyIssues([
      {
        name: "1.sql",
        sql: "CREATE TABLE ward_flow.records(id uuid); ALTER TABLE ward_flow.records ENABLE ROW LEVEL SECURITY; CREATE POLICY p ON ward_flow.records USING(true); DROP POLICY IF EXISTS p ON ward_flow.records;",
      },
    ]).join(" "),
    /no policy/,
  );
  assert.match(
    migrationPolicyIssues([{ name: "1.sql", sql: "CREATE TEMPORARY TABLE private(id uuid);" }]).join(" "),
    /unqualified/,
  );
});
