import { describe, it } from "vitest";
import { dueAtSweepCodes, runDueAtSweep } from "./helpers/ward-legal-figure-sweep";

// Shard 7 of the dueAt provenance sweep; see helpers/ward-legal-figure-sweep.ts. Form 5A alone runs
// near 300 s per case under CI coverage (PR #874, 26 Oct 2026), so this shard allows 600 s.
const codes = dueAtSweepCodes(6);

describe("Mental Health Act figures cannot return to the ward model", () => {
  for (const supplyDueAt of [false, true]) {
    it(`every dueAt the sweep produces, of any code, through any event, traces to a value this file supplied (Forms ${codes.join(", ")}; supplyDueAt=${supplyDueAt})`, () => {
      runDueAtSweep(supplyDueAt, codes);
    }, 600_000);
  }
});
