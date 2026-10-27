import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { downtimePack, type DowntimePackInput } from "@/components/ward-management/reports/downtime-pack";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { blankCssComments } from "./helpers/strip-source-comments";

function printBlocks(path: string): string {
  const css = blankCssComments(readFileSync(resolve(process.cwd(), path), "utf8"));
  return css.split("@media print").slice(1).join("\n");
}

/** P047 (safe part): the pack must never silently count every ward when the caller forgot its own list. */
describe("downtime pack ward list", () => {
  it("refuses to build without an explicit bedUnits list", () => {
    const state = seedWardFlowState();
    const input = {
      units: state.units,
      admissions: state.admissions,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      movements: state.movements,
      now: NOW_ANCHOR,
      identify: () => "Synthetic person",
    } as unknown as DowntimePackInput;
    expect(() => downtimePack(input)).toThrow(/bedUnits/);
  });

  it("counts exactly the wards it is given", () => {
    const state = seedWardFlowState();
    const own = state.units.slice(0, 1);
    const pack = downtimePack({ ...state, bedUnits: own, now: NOW_ANCHOR, identify: () => "Synthetic person" });
    expect(pack.wards.map((ward) => ward.unitId)).toEqual([own[0].id]);
  });
});

/** P048: the downtime pack and discharges print views set the paper like the bed-meeting sheet does. */
describe("print page rules", () => {
  for (const path of [
    "src/components/ward-management/reports/reports.module.css",
    "src/components/ward-management/discharges/discharges.module.css",
  ]) {
    it(`${path} sets an A4 @page inside @media print`, () => {
      expect(printBlocks(path)).toMatch(/@page\s*\{[^}]*size:\s*A4 portrait;[^}]*margin:\s*10mm;/i);
    });
  }
});
