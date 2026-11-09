import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  EXPECTED_DISAGREEMENTS,
  MATRIX_PATH,
  collectPermissionMatrix,
  databaseDefersToBackend,
  disagreements,
  renderPermissionMatrix,
} from "../scripts/ward-flow/permission-matrix";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import { WARD_ACCESS_ROLES } from "../src/components/ward-management/ward-role-access";

/**
 * Audit 7 (issue #1570): one role-by-action matrix, asked of the screen, the engine, the backend and
 * the database. Red when the checked-in matrix is stale, or when any layer gives a different answer
 * from another for any action and desk that `EXPECTED_DISAGREEMENTS` does not list. Offline: the SQL
 * is read as text and nothing connects to a database.
 */
const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const matrix = collectPermissionMatrix();

describe("permission matrix (Audit 7)", () => {
  it("is checked in and current", async () => {
    expect(readFileSync(MATRIX_PATH, "utf8")).toBe(await renderPermissionMatrix(matrix));
  });

  it("covers every action and the five named desks", () => {
    expect(matrix.actions).toEqual(Object.keys(EVENT_ROLE).sort());
    const ids = matrix.desks.map((desk) => desk.id);
    for (const id of ["coordinator", "officer", "ward", "bed_manager", "none"]) expect(ids).toContain(id);
    // Every role a membership can hold has a desk in the matrix.
    const roles = new Set(matrix.desks.flatMap((desk) => (desk.access ? [desk.access.role] : [])));
    expect([...roles].sort()).toEqual([...WARD_ACCESS_ROLES].sort());
  });

  it("finds no layer disagreement beyond the listed known ones", () => {
    const found = disagreements(matrix).map(({ action, desk }) => `${action} ${desk}`);
    const listed = EXPECTED_DISAGREEMENTS.map(({ action, desk }) => `${action} ${desk}`);
    expect(
      found,
      disagreements(matrix)
        .map((entry) => `${entry.action} ${entry.desk}: ${entry.answers}`)
        .join("\n"),
    ).toEqual(listed);
  });

  it("asks every deciding layer: the screen and the backend decide each cell for a desk with a role", () => {
    for (const action of matrix.actions)
      for (const desk of matrix.desks.filter((candidate) => candidate.access)) {
        const cell = matrix.cells[action][desk.id];
        expect(cell.screen, `${action} ${desk.id}`).not.toBe("defer");
        expect(cell.backend, `${action} ${desk.id}`).not.toBe("defer");
      }
  });

  it("refuses a desk with no role at the screen and the backend, for every action", () => {
    for (const action of matrix.actions) {
      expect(matrix.cells[action].none.screen).toBe("deny");
      expect(matrix.cells[action].none.backend).toBe("deny");
    }
  });

  it("keeps every database row behind the backend's runtime role", () => {
    const facts = matrix.database;
    expect(facts.withoutRls, "tables without row level security").toEqual([]);
    expect(facts.tablesWithoutPolicy, "tables without the runtime_only policy").toEqual([]);
    expect(facts.nonRuntimePolicies, "policies naming anything but the runtime role").toEqual([]);
    expect(facts.browserGrants, "grants to a browser or other role").toEqual([]);
    expect(databaseDefersToBackend(facts)).toBe(true);
    expect(facts.membershipRoles).toEqual([...WARD_ACCESS_ROLES].sort());
  });
});

/**
 * The control flow the matrix models but cannot call: each line below is what makes its layer's
 * answer for a desk what the generator says it is. If one moves, re-check the generator.
 */
describe("permission matrix model pins", () => {
  it("backend: a desk with no role is refused before the command route", () => {
    const http = read("backend/ward-flow/shared-http.mjs");
    const refusal = http.indexOf('error: "No Ward Flow role is assigned to this account"');
    const route = http.indexOf('path !== "/v1/workspace/commands"');
    expect(refusal).toBeGreaterThan(-1);
    expect(route).toBeGreaterThan(refusal);
  });

  it("backend: a command's role must be one EVENT_ROLE lists, after deskCommand", () => {
    expect(read("backend/ward-flow/command-schemas.ts")).toContain(
      'if (typeof fields.role !== "string" || !roles.includes(fields.role)) return false;',
    );
    const store = read("backend/ward-flow/postgres.mjs");
    expect(store).toContain("event = view?.access ? engine.deskCommand(view.access, storable) : storable;");
    expect(store).toContain('if (!privacyRefusal && !engine.validCommand(event)) throw new Error("invalid-command");');
  });

  it("screen: the demo controls are offered to whole-network desks only", () => {
    expect(read("backend/ward-flow/postgres.mjs")).toContain(
      "demoControls: demoEvents && (!view?.access || engine.wholeNetwork(view.access)),",
    );
    expect(read("src/components/ward-management/ward-flow-provider.tsx")).toContain(
      "const demoControlsAvailable = !shared.enabled || shared.snapshot?.demoControls !== false;",
    );
  });

  it("screen: a desk with no role sees the ask-for-access gate, not the app", () => {
    expect(read("src/components/ward-management/ward-shared-access.tsx")).toMatch(
      /connection\.status === "no-role"\)\s+return \(\s+<WardAskForAccess/,
    );
  });

  it("screen: buttons are gated by dispatchPermission for the shell role", () => {
    const gate = read("src/components/ward-management/ward-role-gate.tsx");
    expect(gate).toContain("return useAccessShellRole(routeRole);");
    expect(gate).toContain("const permission = dispatchPermission(role, eventType);");
    expect(read("src/components/ward-management/shell/ward-access-store.ts")).toContain(
      'return access.role === "coordinator" ? fallback : chromeRoleForAccess(access);',
    );
  });
});
