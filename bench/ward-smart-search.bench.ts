import { describe, test } from "vitest";

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
  test("person name prefix", async ({ bench }) => {
    await bench("person name prefix", () => {
      search("ann");
    }).run();
  });

  test("movement identifier", async ({ bench }) => {
    await bench("movement identifier", () => {
      search("WF-009");
    }).run();
  });

  test("place name", async ({ bench }) => {
    await bench("place name", () => {
      search("secure");
    }).run();
  });

  test("no match", async ({ bench }) => {
    await bench("no match", () => {
      search("zzzz-no-such-thing");
    }).run();
  });

  test("detect intent", async ({ bench }) => {
    await bench("detect intent", () => {
      detectSearchIntent("WF-009");
      detectSearchIntent("ann able");
      detectSearchIntent("transport");
    }).run();
  });
});
