// Audit M48: demo never mixes with live. GNG rows C2 (the demo store cannot run in a live
// workspace) and C6 (the data-mode lock is only opened on purpose). Forged role fields are M4.
//
// What this file adds: the browser refuses a shared board or executive report labelled anything
// but prototype, and no migration after 007 loosens the prototype-only lock. Existing tests it
// relies on are listed in the register at the end, so losing one fails here.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { checkSharedSnapshot } from "@/components/ward-management/ward-shared-client-helpers";
import type { SharedSnapshot } from "@/components/ward-management/ward-shared-client-types";
import { bindExecutiveAggregateSnapshot } from "@/components/ward-management/ward-shared-executive-snapshot";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";

const ROOT = path.resolve(__dirname, "..");

function snapshot(dataMode: string): SharedSnapshot {
  return {
    dataMode,
    revision: 3,
    now: Date.now(),
    payload: {
      version: 1,
      state: seedWardFlowState(),
      dayZero: "2026-11-10T00:00:00.000Z",
      startedAt: "2026-11-10T00:00:00.000Z",
    },
  } as unknown as SharedSnapshot;
}

describe("M48 C6: the browser adopts prototype data only", () => {
  it("accepts a prototype board, so the refusal below is about the label", () => {
    expect(() => checkSharedSnapshot(snapshot("prototype"), null, () => true)).not.toThrow();
  });

  it.each(["live", "production", "demo", "", "PROTOTYPE"])("refuses a board labelled %j", (mode) => {
    expect(() => checkSharedSnapshot(snapshot(mode), null, () => true)).toThrow(/Incompatible workspace data/);
  });

  it("accepts a prototype executive report and refuses the same report labelled live", () => {
    const actor = "synthetic-executive";
    const state = seedWardFlowStateAt(0);
    // Projected once: the projection is the slow part, and both reports carry the same figures.
    const projected = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: 642,
        dayZero: "2026-10-24T00:00:00Z",
        startedAt: "2026-10-24T00:00:00Z",
        places: wardPlaceLookup(state.units),
      },
    );
    const report = (dataMode: string) => ({
      kind: "executive-aggregate",
      dataMode,
      actorId: actor,
      revision: 1,
      accessContext: "a".repeat(64),
      accessUntil: Date.now() + 120_000,
      now: 642,
      demoControls: false,
      report: projected,
    });
    const outer = {
      actorId: actor,
      access: { role: "executive", scope: { kind: "statewide" } },
      accessUntil: Date.now() + 120_000,
    };
    expect(bindExecutiveAggregateSnapshot(report("prototype"), outer, actor, Date.now())).not.toBeNull();
    expect(bindExecutiveAggregateSnapshot(report("live"), outer, actor, Date.now())).toBeNull();
  }, 20_000);
});

describe("M48 C6: the database lock stays shut until a decision opens it", () => {
  const dir = path.join(ROOT, "backend/ward-flow/migrations");
  const migrations = readdirSync(dir)
    .filter((name) => /^\d{3}-.+\.sql$/.test(name))
    .sort();

  it("migration 007 makes prototype the only allowed data mode", () => {
    const sql = readFileSync(path.join(dir, "007-prototype-only.sql"), "utf8");
    expect(sql).toMatch(/CHECK \(data_mode = 'prototype'\)/);
  });

  it("no later migration touches the data-mode check or names a live mode", () => {
    // Opening the lock needs a new owner decision and migration (GNG C6). When that day comes this
    // test is changed in the same reviewed PR, never by hand in the console.
    const later = migrations.filter((name) => Number(name.slice(0, 3)) > 7);
    expect(later.length).toBeGreaterThan(0);
    const offenders = later.filter((name) => {
      const sql = readFileSync(path.join(dir, name), "utf8");
      return /data_mode_check|data_mode\s*(=|<>|!=|IN)\s*\(?\s*'(?!prototype')|'live'/i.test(sql);
    });
    expect(offenders).toEqual([]);
  });

  it("the only way back to a live label is the separate rollback file, never a forward migration", () => {
    const rollbacks = readdirSync(path.join(ROOT, "backend/ward-flow/infra")).filter((name) =>
      /'live'/.test(readFileSync(path.join(ROOT, "backend/ward-flow/infra", name), "utf8")),
    );
    expect(rollbacks.every((name) => name.startsWith("rollback-"))).toBe(true);
  });
});

describe("M48 existing evidence for C2 and C6 is still in place", () => {
  const register: Array<{ row: string; file: string; mustContain: RegExp }> = [
    {
      row: "C2 demo store off in the shared workspace",
      file: "tests/ward-shared-provider.dom.test.tsx",
      mustContain: /adopts server state without reading or writing browser demo storage/,
    },
    {
      row: "C6 backend refuses WARD_DATA_MODE other than prototype",
      file: "backend/ward-flow/shared-http.test.mjs",
      mustContain: /WARD_DATA_MODE: "live" \}\), \/not commissioned\//,
    },
    {
      row: "C6 migration 007 constraint and its rollback",
      file: "backend/ward-flow/migrate.test.mjs",
      mustContain: /007-prototype-only\.sql/,
    },
  ];
  it.each(register)("$row", ({ file, mustContain }) => {
    const full = path.join(ROOT, file);
    expect(existsSync(full)).toBe(true);
    expect(readFileSync(full, "utf8")).toMatch(mustContain);
  });
});
