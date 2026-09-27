import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SuburbTeamPanel } from "@/components/ward-management/ward/suburb-team-panel";
import { lookupCatchment } from "@/components/ward-management/ward-catchment";

/**
 * 🔴 **THE PANEL ANSWERS ONE QUESTION — WHICH COMMUNITY TEAM COVERS THIS SUBURB — AND TWO OF ITS
 * FIVE ANSWERS REFUSE TO NAME ONE.**
 *
 * Task A3's lookup half. The heading is *"The team for this suburb"* (owner ruling): it names the
 * question, not the answer, **and it is deliberately not hedged.** ⚠️ A heading that qualified
 * itself to cover the two refusing states would read as evasive on a clinical screen; the panel's
 * own states do the correcting.
 *
 * 🔴 **FOUR STATES, FIVE OUTCOMES — and the split inside `unknown` is the part most likely to be
 * flattened by somebody tidying up.** `ward-catchment.test.ts:281` pins that the two must never
 * merge, and the reason is operational rather than tidiness: **they differ in what a coordinator
 * must DO NEXT.**
 *
 *     suburb not in the source table              the address may be wrong, or the person is out of
 *                                                 area — something to CHECK
 *     suburb known, no follow-up clinic recorded  the place is real, the mapping is missing —
 *                                                 something to FILL IN
 *
 * ⚠️ **So neither is called "Unknown".** One word over two states that differ in what somebody must
 * do is the defect this project has ruled on three times.
 *
 * 🔴 **THE EXAMPLE SUBURBS ARE VERIFIED AGAINST THE MODULE, NOT TRUSTED.** The third-edition drawing
 * illustrates the marked-but-routing state with **Calista**, and `lookupCatchment("Calista")`
 * returns `contested` — because contested is checked first and *"contested wins, because it is the
 * state that refuses to route"*. **Building from the drawing's worked examples would have shipped a
 * panel whose example demonstrated the opposite of its own caption.** Every fixture below is
 * asserted to produce the state it is used for, before it is used.
 *
 * ⚠️ **POPULATION.** The panel component in jsdom at one viewport. Silent about layout, about what a
 * browser paints, and about the ward screen around it.
 */

/** Each outcome, with the suburb that produces it. ⚠️ Asserted, never assumed — see the first case. */
const FIXTURES = {
  reviewed: "Albany",
  unreviewed: "Belmont",
  contested: "Calista",
  notInTable: "Inglehope",
  noClinicRecorded: "Christmas Island",
} as const;

function lookUp(suburb: string) {
  render(<SuburbTeamPanel />);
  // ⚠️ NOT `/suburb/` — the panel's own landmark is named "The team for this suburb", so a loose
  // matcher finds the region as well as the input. The first draft did, and failed on its own defect.
  fireEvent.change(screen.getByLabelText(/patient/iu), { target: { value: suburb } });
  fireEvent.submit(screen.getByTestId("ward-suburb-team-form"));
  return screen.getByTestId("ward-suburb-team-answer");
}

describe("the suburb-to-team panel — its fixtures are what they claim to be", () => {
  it("🔴 ANTI-VACUITY — each example suburb really produces the outcome it is used for", () => {
    expect(lookupCatchment(FIXTURES.reviewed).state, `${FIXTURES.reviewed} is not reviewed`).toBe("reviewed");
    expect(lookupCatchment(FIXTURES.unreviewed).state, `${FIXTURES.unreviewed} is not unreviewed`).toBe("unreviewed");
    expect(lookupCatchment(FIXTURES.contested).state, `${FIXTURES.contested} is not contested`).toBe("contested");

    const notInTable = lookupCatchment(FIXTURES.notInTable);
    expect(notInTable.state).toBe("unknown");
    if (notInTable.state !== "unknown") return;
    expect(notInTable.reason).toBe("suburb-not-in-source-table");

    const noClinic = lookupCatchment(FIXTURES.noClinicRecorded);
    expect(noClinic.state).toBe("unknown");
    if (noClinic.state !== "unknown") return;
    expect(
      noClinic.reason,
      "the only row in the table with no clinic recorded has changed — pick another, do not merge the two unknowns",
    ).toBe("suburb-in-source-table-but-no-follow-up-clinic-recorded");
  });
});

describe("the suburb-to-team panel names a team when the source names one", () => {
  it("gives the reviewed answer its team and says which document said so", () => {
    const answer = lookUp(FIXTURES.reviewed);
    const found = lookupCatchment(FIXTURES.reviewed);
    if (found.state !== "reviewed") throw new Error("fixture drifted — the anti-vacuity case should have caught it");

    // 🔴 Computed from the module, never a typed literal: a hard-coded team name would still pass
    // if the panel rendered a DIFFERENT ward's answer (owner ruling D-45c).
    for (const clinic of found.answers.flatMap((entry) => entry.clinics)) {
      expect(answer.textContent ?? "", `the panel does not name ${clinic}`).toContain(clinic);
    }
    expect(answer.textContent ?? "").toContain(found.answers[0].document.id);
  });

  it("keeps the marked row's warning WITH its answer, rather than only naming the team", () => {
    const answer = lookUp(FIXTURES.unreviewed);
    const found = lookupCatchment(FIXTURES.unreviewed);
    if (found.state !== "unreviewed") throw new Error("fixture drifted");

    for (const clinic of found.answers.flatMap((entry) => entry.clinics)) {
      expect(answer.textContent ?? "").toContain(clinic);
    }
    // The whole point of `unreviewed`: it routes, AND the row is marked. Losing the mark would make
    // it indistinguishable from `reviewed` on screen while remaining distinct in the model.
    expect(
      answer.textContent ?? "",
      "the marked row renders exactly like a clean one — the mark is in the model and not on the screen",
    ).toContain(found.note);
  });
});

describe("the suburb-to-team panel refuses to pick, and says it is refusing", () => {
  it("shows BOTH contested readings and chooses neither", () => {
    const answer = lookUp(FIXTURES.contested);
    const found = lookupCatchment(FIXTURES.contested);
    if (found.state !== "contested") throw new Error("fixture drifted");

    expect(found.answers.length, "a contested lookup with fewer than two readings cannot test this").toBeGreaterThan(1);
    for (const entry of found.answers) {
      for (const clinic of entry.clinics) {
        expect(answer.textContent ?? "", `a contested reading naming ${clinic} is not on screen`).toContain(clinic);
      }
      expect(answer.textContent ?? "", "a reading is shown without the document it came from").toContain(
        entry.document.id,
      );
    }
    expect(
      answer.textContent ?? "",
      "the panel does not say it is refusing to choose — rendering both and routing on one quietly " +
        "would make the display honest and the behaviour dishonest",
    ).toMatch(/nothing is sent|a person picks|neither/iu);
  });
});

describe("🔴 the two unknowns are two different answers, and never one", () => {
  it("says the suburb is not in the table, when it is not", () => {
    const answer = lookUp(FIXTURES.notInTable);
    const text = answer.textContent ?? "";
    expect(text, "the not-in-table case does not say so").toMatch(/not in the|no row|not recognis/iu);
    expect(text, "the not-in-table case must not be called Unknown").not.toMatch(/\bunknown\b/iu);
  });

  it("says no team is recorded, when the suburb IS in the table and the cell is empty", () => {
    const answer = lookUp(FIXTURES.noClinicRecorded);
    const text = answer.textContent ?? "";
    expect(text, "the empty-cell case does not say a team is missing").toMatch(/no team is recorded|no team is held/iu);
    expect(text, "the empty-cell case must not be called Unknown").not.toMatch(/\bunknown\b/iu);
  });

  it("🔴 renders the two DIFFERENTLY — the property the whole split exists for", () => {
    const notInTable = lookUp(FIXTURES.notInTable).textContent ?? "";
    cleanup();
    const noClinic = lookUp(FIXTURES.noClinicRecorded).textContent ?? "";

    /*
     * 🔴 **THIS ASSERTED `notInTable !== noClinic` AND THAT WAS NOT A CHECK.** A mutation that
     * collapsed both branches into one rendering left the two strings DIFFERENT anyway, because each
     * interpolates its own suburb name and its own source note. **The two operands could not
     * coincide even when the code was wrong**, so the inequality held and the case passed on the
     * defect it exists to catch. Found by running the mutation, not by reading the test.
     *
     * ⚠️ **What distinguishes them is the CLAIM, not the text.** Each must make its own and must not
     * make the other's — so a merge leaves one of the two saying the wrong thing about itself.
     */
    expect(notInTable, "the not-in-table case is claiming a team is missing").not.toMatch(/no team is recorded/iu);
    expect(noClinic, "the empty-cell case is claiming the suburb is unrecognised").not.toMatch(
      /not in the source table/iu,
    );
    expect(
      notInTable,
      "a suburb nobody wrote down and a suburb nobody has heard of read identically — they differ in " +
        "what a coordinator must do next, and the screen has flattened them into one answer",
    ).not.toBe(noClinic);
  });
});

describe("the panel's qualification does not vanish when an answer arrives", () => {
  /**
   * ⚠️ **An honest qualifier that lives only in the empty state disappears exactly when rows arrive**
   * — which is when a reader most needs it. Owner instruction, carried here as an assertion.
   */
  const QUALIFIER = /never the postcode/iu;

  it("states the key is the suburb before anything is looked up", () => {
    render(<SuburbTeamPanel />);
    expect(screen.getByTestId("ward-suburb-team-panel").textContent ?? "").toMatch(QUALIFIER);
  });

  it("still states it once an answer is on screen", () => {
    lookUp(FIXTURES.reviewed);
    expect(
      screen.getByTestId("ward-suburb-team-panel").textContent ?? "",
      "the qualification is in the empty state only, and vanished the moment an answer arrived",
    ).toMatch(QUALIFIER);
  });

  it("says plainly that nothing here sends anything", () => {
    render(<SuburbTeamPanel />);
    expect(screen.getByTestId("ward-suburb-team-panel").textContent ?? "").toMatch(
      /nothing here is sent|asks for a bed/iu,
    );
  });
});

describe("the panel is named once, by its own heading", () => {
  it("carries a landmark whose accessible name IS the heading", () => {
    render(<SuburbTeamPanel />);
    const heading = screen.getByRole("heading", { name: "The team for this suburb" });
    const region = screen.getByRole("region", { name: "The team for this suburb" });
    expect(region.getAttribute("aria-labelledby")).toBe(heading.getAttribute("id"));
    expect(region.hasAttribute("aria-label"), "an aria-label alongside is dead weight that looks authoritative").toBe(
      false,
    );
  });
});
