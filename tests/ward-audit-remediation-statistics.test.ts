import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { fixedQuestionAnswers } from "@/components/ward-management/reports/fixed-questions";
import { journeyStages } from "@/components/ward-management/statistics/statistics-journey-view";
import { networkCapacity } from "@/components/ward-management/statistics/statistics-network-cards";
import { siteFigures } from "@/components/ward-management/statistics/statistics-map-view";
import { readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const { forecastHistoryInput, forecastHistoryStore } = await import(
  pathToFileURL(resolve("backend/ward-flow/forecast-history.mjs")).href
);

describe("audit remediation: statistics use recorded populations", () => {
  it("uses the canonical Ready count after a live pull exceeds the observation's held beds", () => {
    const state = seedWardFlowState();
    const original = state.units[0]!;
    const unit = {
      ...original,
      empty: { ...original.empty, value: 3 },
      allocatable: { ...original.allocatable, value: 3 },
    };
    const admissions = [
      { ...state.admissions[0]!, unitId: unit.id, state: "pulled" as const, movementId: state.movements[0]!.id },
    ];
    expect(readyBedsNow(unit, admissions, [])).toBe(2);
    expect(networkCapacity([unit], [], admissions).ready).toBe(2);
    const sites = siteFigures({
      units: [unit],
      admissions,
      bedReleases: [],
      leaveBeds: [],
      movements: [],
      now: NOW_ANCHOR,
    });
    expect(sites.find((site) => site.wards.some((ward) => ward.unit.id === unit.id))?.ready).toBe(2);
  });

  it("does not call a previously declined or withdrawn referral never asked", () => {
    const state = seedWardFlowState();
    const base = {
      ...state.movements[0]!,
      stage: "placement_requested" as const,
      closure: undefined,
      acceptedUnitId: undefined,
      referredUnitIds: [],
      declines: [],
      referredAt: undefined,
      withdrawnReferrals: [],
    };
    const never = { ...base, id: "AUD-NEVER" as Movement["id"] };
    const declined = { ...base, id: "AUD-DECLINED" as Movement["id"], referredAt: NOW_ANCHOR - 20 };
    const withdrawn = {
      ...base,
      id: "AUD-WITHDRAWN" as Movement["id"],
      withdrawnReferrals: [
        { unitId: state.units[0]!.id, at: NOW_ANCHOR - 10, reason: "coordinator_withdrew" as const },
      ],
    };
    const answer = fixedQuestionAnswers({ ...state, movements: [never, declined, withdrawn], now: NOW_ANCHOR }).find(
      (each) => each.id === "requests_no_ward_asked",
    )!;
    expect(answer.rows.map((row) => row.key)).toEqual([never.id]);
  });

  it("does not count a community journey with no department as an ED", () => {
    const state = seedWardFlowState();
    const movement = {
      ...state.movements[0]!,
      stage: "placement_requested" as const,
      closure: undefined,
      originEdId: undefined,
      originUnitId: undefined,
      originCommunity: { siteCode: "AUD-COMMUNITY", name: "Synthetic team" },
    };
    const waiting = journeyStages({ ...state, movements: [movement], now: NOW_ANCHOR }).find(
      (stage) => stage.id === "waiting",
    )!;
    expect(waiting.count).toBe(1);
    expect(waiting.breakdown.find((part) => part.label === "EDs")?.value).toBe(0);
  });
});

describe("audit remediation: forecast reason compare-and-set store contract", () => {
  const reason = { day: 1, reason: "other", by: "coordinator", at: 100 };
  const view = { access: { role: "coordinator", scope: { kind: "statewide" } }, actorId: "synthetic-actor" };
  const version = "2026-11-03 01:02:03.123456+00";
  function store(writeRows: unknown[] = []) {
    const writes: { sql: string; values: unknown[] }[] = [];
    return {
      writes,
      api: forecastHistoryStore({
        pool: {
          query: async (sql: string, values: unknown[]) => {
            if (/^(INSERT|UPDATE)/.test(sql)) {
              writes.push({ sql, values });
              return { rows: writeRows, rowCount: writeRows.length };
            }
            if (sql.includes("forecast_miss_reasons"))
              return { rows: [{ demo_day: 1, reason: "other", chosen_by: "coordinator", chosen_at: 100, version }] };
            return { rows: [] };
          },
        },
        workspaceId: "synthetic-workspace",
        schemaVersion: async () => 16,
        worldGeneration: async () => 0,
        forgetVersionOnMissing: () => {},
      }),
    };
  }

  it("requires an explicit reason basis while preserving snapshot-only input", () => {
    expect(forecastHistoryInput({ generation: 0, reason })).toBeNull();
    expect(forecastHistoryInput({ generation: 0, reason, expectedVersion: null })).toMatchObject({
      expectedVersion: null,
    });
    expect(forecastHistoryInput({ generation: 0, reason, expectedVersion: version })).toMatchObject({
      expectedVersion: version,
    });
    const snapshot = { day: 1, at: 100, nowGap: 0, tomorrow: { low: 0, likely: 1, high: 2 } };
    expect(forecastHistoryInput({ generation: 0, snapshot })).toEqual({ generation: 0, snapshot });
  });

  it("returns precise reason versions and advertises protected reason writes even for an empty desk", async () => {
    const result = await store().api.forecastHistory(view);
    expect(result).toMatchObject({ reasonWriteVersion: 1, reasons: [{ ...reason, version }] });
  });

  it.each([null, version])(
    "returns a conflict when an atomic write matches no row (basis %s)",
    async (expectedVersion) => {
      const test = store();
      const result = await test.api.recordForecast(view, { generation: 0, reason, expectedVersion });
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ code: "reason-conflict", history: { reasonWriteVersion: 1 } });
      expect(test.writes).toHaveLength(1);
      if (expectedVersion === null) expect(test.writes[0]!.sql).toMatch(/ON CONFLICT DO NOTHING[\s\S]*RETURNING/);
      else {
        expect(test.writes[0]!.sql).toMatch(/^UPDATE[\s\S]*WHERE[\s\S]*updated_at::text[\s\S]*RETURNING/);
        expect(test.writes[0]!.values).toContain(version);
      }
    },
  );
});
