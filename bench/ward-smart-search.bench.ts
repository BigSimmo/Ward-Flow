import { bench, describe } from "vitest";

import { detectSearchIntent, searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const state = seedWardFlowState();

function search(query: string) {
  return searchWardFlow({
    query,
    patients: state.patients,
    movements: state.movements,
    units: state.units,
    now: NOW_ANCHOR,
  });
}

describe("smart search", () => {
  bench("person name prefix", () => {
    search("ann");
  });

  bench("movement identifier", () => {
    search("WF-009");
  });

  bench("place name", () => {
    search("secure");
  });

  bench("no match", () => {
    search("zzzz-no-such-thing");
  });

  bench("detect intent", () => {
    detectSearchIntent("WF-009");
    detectSearchIntent("ann able");
    detectSearchIntent("transport");
  });
});
