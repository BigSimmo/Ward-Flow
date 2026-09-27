import { describe, expect, it } from "vitest";
import { NOTHING_FOUND, RESULTS_FOOTER, refusalFor } from "@/components/ward-management/search/search-refusals";

describe("what search refuses, in the standard's own words", () => {
  // ⚠️ VERBATIM FROM `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` §8.6. These are fixed
  // sentences, not copy to improve. A reworded refusal is a different promise, and nothing else in
  // the repository would go red if somebody improved one.
  it("refuses a score or a best match with the fixed sentence", () => {
    for (const word of ["risk", "acuity", "score", "scores", "best match"]) {
      expect(refusalFor(word)?.sentence).toBe(
        "Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.",
      );
    }
  });

  it("refuses closed, arrived and discharged with the other fixed sentence", () => {
    for (const word of ["closed", "arrived", "discharged"]) {
      expect(refusalFor(word)?.sentence).toBe(
        "Closed and arrived movements are not searchable here. They are in the Movement screen's register.",
      );
    }
  });

  it("says nothing-found in the standard's words, with the query in it", () => {
    expect(NOTHING_FOUND("wenna")).toBe(
      "Nothing matches ‘wenna’. Search finds patients by name or identifier, movements, departments, wards, owners and tools.",
    );
  });

  it("carries the fixed results footer", () => {
    expect(RESULTS_FOOTER).toBe(
      "Names are invented. Search never returns a risk score, an acuity score or a best match.",
    );
  });

  it("refuses nothing for an ordinary search", () => {
    expect(refusalFor("Larkspur")).toBeUndefined();
  });
});
