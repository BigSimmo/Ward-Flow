import { describe, it } from "vitest";
import { dueAtSweepCodes, runDueAtSweep } from "./helpers/ward-legal-figure-sweep";

// Shard 2 of the dueAt provenance sweep; see helpers/ward-legal-figure-sweep.ts.
const codes = dueAtSweepCodes(1);

describe("Mental Health Act figures cannot return to the ward model", () => {
  for (const supplyDueAt of [false, true]) {
    it(`every dueAt the sweep produces, of any code, through any event, traces to a value this file supplied (Forms ${codes.join(", ")}; supplyDueAt=${supplyDueAt})`, () => {
      runDueAtSweep(supplyDueAt, codes);
    }, 300_000);
  }
});
