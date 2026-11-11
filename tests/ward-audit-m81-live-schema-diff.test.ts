// Audit M81 (10 November 2026): live matches the repo. Checks the names-only comparison offline
// against snapshots built from the repo's own declarations. The query itself was also run once on a
// private local Postgres 16 built from migrations 001-017 and the runtime role script (an empty
// difference); see docs/ward-flow/evidence/2026-11-10-release-and-scheduled-jobs-audit.md.
import { describe, expect, it } from "vitest";

import {
  SNAPSHOT_QUERY,
  declaredGrants,
  diffLive,
  parseSettingNames,
  repoDeclared,
} from "../scripts/ward-flow/live-schema-diff.mjs";
// Loaded by URL so the root typecheck does not pull the backend's own (looser) JS checking in.
const { LATEST_MIGRATION } = (await import(new URL("../backend/ward-flow/migrations.mjs", import.meta.url).href)) as {
  LATEST_MIGRATION: number;
};

const declared = repoDeclared();
const matching = () => ({
  migration: declared.migration,
  tables: [...declared.tables],
  rls: [...declared.rls],
  policies: [...declared.policies],
  grants: [...declared.grants],
});

describe("M81: names-only live-versus-repo difference", () => {
  it("reads the repo's migration, tables, row-level security, policies and grants", () => {
    expect(declared.migration).toBe(LATEST_MIGRATION);
    expect(declared.tables).toContain("workspaces");
    expect(declared.rls).toEqual(declared.tables);
    expect(declared.policies).toContain("audit.runtime_only");
    expect(declared.grants).toContain("schema:ward_flow:USAGE");
    expect(declared.grants).toContain("table:commands:INSERT");
    expect(declared.grants).toContain("column:memberships.approved_by:UPDATE");
    expect(declared.grants).toContain("sequence:audit_sequence_seq:USAGE");
    expect(declared.grants).not.toContain("table:audit:UPDATE");
  });

  it("reports nothing when live matches", () => {
    expect(diffLive(declared, matching())).toEqual([]);
  });

  it("names each kind of drift, in both directions", () => {
    const live = matching();
    live.migration = declared.migration - 1;
    live.tables = live.tables.filter((name) => name !== "account_preferences").concat("scratch");
    live.rls = live.rls.filter((name) => name !== "commands");
    live.policies = live.policies.filter((name) => name !== "workspaces.runtime_only");
    live.grants = live.grants.filter((name) => name !== "table:commands:INSERT").concat("table:audit:DELETE");
    expect(diffLive(declared, live)).toEqual([
      `migration: repo is at ${declared.migration}, live is at ${declared.migration - 1}`,
      "table: in the repo, not on live: account_preferences",
      "table: on live, not in the repo: scratch",
      "row-level security: in the repo, not on live: commands",
      "policy: in the repo, not on live: workspaces.runtime_only",
      "runtime grant: in the repo, not on live: table:commands:INSERT",
      "runtime grant: on live, not in the repo: table:audit:DELETE",
    ]);
  });

  it("catches the misspelt uptime token (M54) and a missing required setting, ignoring Railway's own", () => {
    const names = declared.requiredSettings
      .filter((name) => name !== "WARD_FLOW_UPTIME_TOKEN")
      .concat("ARD_FLOW_UPTIME_TOKEN", "RAILWAY_GIT_COMMIT_SHA", "SENTRY_DSN");
    expect(diffLive(declared, matching(), names)).toEqual([
      "setting: in the repo, not on live: WARD_FLOW_UPTIME_TOKEN",
      "setting: on live, not in the repo: ARD_FLOW_UPTIME_TOKEN",
    ]);
    expect(diffLive(declared, matching(), [...declared.requiredSettings])).toEqual([]);
  });

  it("refuses a settings file holding a value, so no secret is ever read", () => {
    expect(parseSettingNames("# names\nWARD_DATA_MODE\n\nWARD_WORKSPACE_ID\n")).toEqual([
      "WARD_DATA_MODE",
      "WARD_WORKSPACE_ID",
    ]);
    expect(() => parseSettingNames("WARD_SUPABASE_DATABASE_URL=postgres://synthetic")).toThrow(/names only/u);
  });

  it("refuses a snapshot missing a list instead of reporting a false match", () => {
    expect(() => diffLive(declared, { migration: declared.migration, tables: [] })).toThrow(/no rls list/u);
  });

  it("splits column grants and multi-table grants", () => {
    expect(
      declaredGrants(
        "GRANT SELECT, UPDATE (a, b) ON ward_flow.x TO wardflow_backend;\nGRANT INSERT ON ward_flow.y, ward_flow.z TO wardflow_backend;\nGRANT SELECT ON ward_flow.q TO someone_else;",
      ),
    ).toEqual(["column:x.a:UPDATE", "column:x.b:UPDATE", "table:x:SELECT", "table:y:INSERT", "table:z:INSERT"]);
  });

  it("keeps the query read-only and names-only", () => {
    expect(SNAPSHOT_QUERY).toMatch(/^WITH /u);
    expect(SNAPSHOT_QUERY).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\s+(?:INTO|ON|TABLE|ROLE|\w+\s+SET)/u,
    );
    expect(SNAPSHOT_QUERY).not.toMatch(/payload|body|patient/u);
  });
});
