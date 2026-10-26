import { describe, it } from "vitest";
import { dueAtSweepCodes, runDueAtSweep } from "./helpers/ward-legal-figure-sweep";

// Shard 8 of the dueAt provenance sweep; see helpers/ward-legal-figure-sweep.ts.
// Each case allows 600 s: under CI coverage the sweeps ran past 300 s on 26 Oct 2026 (#874, #872).
const codes = dueAtSweepCodes(7);

describe("Mental Health Act figures cannot return to the ward model", () => {
  for (const supplyDueAt of [false, true]) {
    it(`every dueAt the sweep produces, of any code, through any event, traces to a value this file supplied (Forms ${codes.join(", ")}; supplyDueAt=${supplyDueAt})`, () => {
      runDueAtSweep(supplyDueAt, codes);
    }, 600_000);
  }
});
