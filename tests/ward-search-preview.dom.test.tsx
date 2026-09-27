import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/*
 * Same reason as every sibling dom suite (ward-patient-search.dom.test.tsx,
 * ward-patient-typeahead.dom.test.tsx): `Link` renders next/link anchors and jsdom has no App
 * Router context to give it, so a plain `<a>` stands in.
 */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { isOpen, referralForMovement, searchMovements } from "@/components/ward-management/ward-derivations";
import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { Movement, MovementStage, Referral } from "@/components/ward-management/ward-model";
import { referralState } from "@/components/ward-management/ward-referrals";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { PatientSearchPage, ResultsSection } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  RecordPreview,
  buildMovementSummary,
  type PreviewSelection,
} from "@/components/ward-management/search/record-preview";

function renderSearch() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
    </WardFlowProvider>,
  );
}

const seed = seedWardFlowState();

/**
 * IDEA 1 — FACET COUNTS.
 *
 * The mockup's single worst defect (per the task brief) was facet counts that disagreed with the
 * rows on screen. These counts are "what `searchMovements` would return if this option were
 * chosen" — the exact call the Stage/Department selects themselves make when an option IS chosen —
 * so the count beside an option and the rows you get by picking it can never disagree.
 *
 * Computed here from the SAME real fixture (`seedWardFlowState()`) and the SAME exported
 * `searchMovements`, independently of `patient-search.tsx`'s own internal computation, so a defect
 * in that computation (wrong argument, off-by-one, reading the wrong state) shows up as a mismatch
 * rather than being invisible because both sides share one bug.
 */
describe("the Stage and Department facets carry live, self-consistent counts", () => {
  it("labels every Stage option with the count searchMovements actually returns for it", () => {
    renderSearch();
    const select = screen.getByLabelText("Stage") as HTMLSelectElement;
    const options = [...select.options];
    expect(options.length, "no Stage options rendered — nothing to check").toBeGreaterThan(1);

    for (const option of options) {
      if (option.value === "") continue; // "All stages" checked separately below
      const expected = searchMovements(seed.movements, seed.units, {
        text: "",
        stage: option.value as MovementStage,
      }).length;
      expect(option.textContent, `Stage option "${option.value}" should show its live count (${expected})`).toContain(
        `(${expected})`,
      );
    }

    const allOption = options.find((option) => option.value === "");
    expect(allOption, '"All stages" option is missing').toBeDefined();
    const allExpected = searchMovements(seed.movements, seed.units, { text: "" }).length;
    expect(allOption!.textContent).toContain(`(${allExpected})`);
  });

  it("labels every Department option with the count searchMovements actually returns for it", () => {
    renderSearch();
    const select = screen.getByLabelText("Department") as HTMLSelectElement;
    const options = [...select.options];
    expect(options.length, "no Department options rendered — nothing to check").toBeGreaterThan(1);

    for (const option of options) {
      if (option.value === "") continue;
      const expected = searchMovements(seed.movements, seed.units, { text: "", edId: option.value }).length;
      expect(
        option.textContent,
        `Department option "${option.value}" should show its live count (${expected})`,
      ).toContain(String(expected));
    }
  });

  /*
   * ⚠️ CROSS-FILTER, NOT JUST THE UNFILTERED CASE. A count that is only ever right at the page's
   * idle state would pass this suite while being wrong the moment a coordinator has already typed
   * something — which is exactly when a facet count earns its keep. "arm-ed" is chosen because
   * tests/ward-patient-search.test.ts already measured it: exactly four open movements originate
   * there, one of which ("WF-011") is also "pulled" — so picking "arm-ed" must change the Stage
   * select's own counts, and this asserts the changed number rather than only the resting one.
   */
  it("recomputes Stage counts against the Department filter already chosen, not just against no filter", () => {
    renderSearch();
    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "arm-ed" } });

    const select = screen.getByLabelText("Stage") as HTMLSelectElement;
    const pulledOption = [...select.options].find((option) => option.value === "pulled");
    expect(pulledOption, '"pulled" option is missing from the Stage select').toBeDefined();

    const expectedWithArmEd = searchMovements(seed.movements, seed.units, {
      text: "",
      stage: "pulled",
      edId: "arm-ed",
    }).length;
    expect(expectedWithArmEd, "fixture assumption: arm-ed narrows the pulled count below its unfiltered value").toBe(1);
    expect(pulledOption!.textContent).toContain(`(${expectedWithArmEd})`);
  });
});

/**
 * IDEA 2 AND 3 — THE PREVIEW PANE AND THE CROSS-RECORD TIE.
 *
 * `RecordPreview` is exercised directly with constructed fixtures, the same pattern
 * `tests/ward-patient-search.dom.test.tsx` already uses for `ResultsSection` — a presentational
 * component rendered with explicit props rather than through the live provider, so a referral or
 * movement that does not exist in the static seed can still be tested without touching
 * `ward-flow-provider.tsx` or the reducer (both outside this task's file boundary).
 */
describe("the preview pane ties a person, their referral and their open movement together", () => {
  const patient = seed.patients[0];
  const baseReferral = seed.referrals.find((referral) => referral.id === "RF-011");
  if (!baseReferral) throw new Error("fixture RF-011 is required by this suite and is missing");
  const baseMovement = seed.movements.find((movement) => movement.id === "WF-011");
  if (!baseMovement) throw new Error("fixture WF-011 is required by this suite and is missing");
  if (!isOpen(baseMovement)) throw new Error("WF-011 must be open for this fixture to prove anything");

  const linkedReferral: Referral = { ...baseReferral, id: "RF-TEST-LINKED", patientId: patient.id };
  // The movement names the same person as its referral (seed movements now carry their own
  // patientId since the seed-link work, so the copy must not keep WF-011's own person).
  const linkedMovement: Movement = {
    ...baseMovement,
    id: "WF-TEST-LINKED",
    referralId: linkedReferral.id,
    patientId: patient.id,
  };

  it("shows a person's linked queued referral and the open movement it led to, in one panel", () => {
    render(
      <RecordPreview
        selection={{ kind: "person", patient }}
        referrals={[linkedReferral]}
        movements={[linkedMovement]}
        patients={[patient]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );

    const referralSection = screen.getByTestId("ward-patient-search-preview-referral");
    expect(within(referralSection).getByText(new RegExp(linkedReferral.id))).toBeInTheDocument();

    // Owner, 26 Sept 2026: the movement tie no longer prints the WF id as visible text — it links
    // to the movement by id under the label "Open this movement".
    const movementSection = screen.getByTestId("ward-patient-search-preview-movement");
    expect(within(movementSection).getByRole("link", { name: "Open this movement" })).toHaveAttribute(
      "href",
      `/mockups/ward-flow/movements/${linkedMovement.id}`,
    );
  });

  it("never follows an accepted referral with queued or no-bed-accepted wording", () => {
    const acceptedReferral = seed.referrals.find(
      (referral) => referral.patientId !== undefined && referralState(referral) === "accepted",
    );
    expect(acceptedReferral, "fixture needs a person-linked accepted referral").toBeDefined();
    const acceptedPatient = seed.patients.find((candidate) => candidate.id === acceptedReferral!.patientId);
    expect(acceptedPatient, "the accepted referral's patientId does not resolve").toBeDefined();

    render(
      <RecordPreview
        selection={{ kind: "person", patient: acceptedPatient! }}
        referrals={[acceptedReferral!]}
        movements={seed.movements}
        patients={seed.patients}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );

    const referralSection = screen.getByTestId("ward-patient-search-preview-referral");
    expect(referralSection).toHaveTextContent("Accepted — a destination has agreed");
    expect(referralSection).toHaveTextContent("no destination declined before acceptance");
    expect(referralSection).not.toHaveTextContent(/waiting for a decision|no (?:bed|destination) accepted yet/i);
  });

  it("ties a movement back to the referral that raised it and that referral's own person", () => {
    render(
      <RecordPreview
        selection={{ kind: "movement", movement: linkedMovement }}
        referrals={[linkedReferral]}
        movements={[linkedMovement]}
        patients={[patient]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );

    const referralSection = screen.getByTestId("ward-patient-search-preview-referral");
    expect(within(referralSection).getByText(new RegExp(linkedReferral.id))).toBeInTheDocument();

    const personSection = screen.getByTestId("ward-patient-search-preview-person");
    expect(within(personSection).getByText(new RegExp(patient.umrn))).toBeInTheDocument();
  });

  it("says plainly that nothing is linked for a person with no linked referral, rather than guessing", () => {
    const lonelyPatient = seed.patients[1];
    expect(
      seed.referrals.some((referral) => referral.patientId === lonelyPatient.id),
      "fixture assumption: no seeded referral names this patient",
    ).toBe(false);

    render(
      <RecordPreview
        selection={{ kind: "person", patient: lonelyPatient }}
        referrals={seed.referrals}
        movements={seed.movements}
        patients={seed.patients}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId("ward-patient-search-preview-referral")).toHaveTextContent(/no referral is linked/i);
    expect(screen.getByTestId("ward-patient-search-preview-movement")).toHaveTextContent(/no referral is linked/i);
  });

  /*
   * ⚠️ A DANGLING `referralId` MUST READ AS "NO REFERRAL", NEVER AS A GUESS. Constructed rather than
   * pulled off the real fixture: the two seeded movements that carry a `referralId` (`WF-002` →
   * `RF-012`, `WF-009` → `RF-013`) both actually resolve — checked directly against
   * `ward-movements.ts` before writing this, after an earlier draft of this suite assumed otherwise
   * and went red for the wrong reason. `referralForMovement`'s own doc comment says a pointer that
   * does not resolve must read exactly like "no referral", the conservative answer — this proves
   * that rule holds here, using a clone whose dangling id is guaranteed by construction rather than
   * by a fixture fact that could change under this test.
   */
  it("treats a dangling referralId as no referral, never inventing a person for it", () => {
    const dangling: Movement = { ...baseMovement, id: "WF-TEST-DANGLING", referralId: "RF-DOES-NOT-EXIST" };
    if (referralForMovement(dangling, seed.referrals) !== undefined) {
      throw new Error("fixture assumption broken: RF-DOES-NOT-EXIST unexpectedly resolves against seed.referrals");
    }

    render(
      <RecordPreview
        selection={{ kind: "movement", movement: dangling }}
        referrals={seed.referrals}
        movements={[dangling]}
        patients={seed.patients}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId("ward-patient-search-preview-referral")).toHaveTextContent(/no referral is linked/i);
    expect(screen.getByTestId("ward-patient-search-preview-person")).toHaveTextContent(/no referral is linked/i);
  });
});

/**
 * "THE PREVIEW PANE MUST NOT BECOME A SECOND SOURCE OF TRUTH" — proved, not asserted.
 *
 * `buildMovementSummary` is the ONE place the destination text is computed; `ResultsSection`'s
 * table row and `RecordPreview`'s movement tie both call it with the same movement. This renders
 * both independently and checks they show the identical destination string, for a movement chosen
 * specifically because it exercises the interesting case (referred but not accepted, where the old,
 * un-shared code had already gone wrong once before).
 */
describe("the results row and the preview panel never disagree, because they share one computation", () => {
  it("shows the identical destination text in the results table and the movement preview", () => {
    const referredNotAccepted = seed.movements.find(
      (movement) => isOpen(movement) && movement.referredUnitIds.length > 0 && movement.acceptedUnitId === undefined,
    );
    expect(referredNotAccepted, "fixture needs an open, referred-but-not-accepted movement").toBeDefined();
    const movement = referredNotAccepted!;
    const summary = buildMovementSummary(movement, allUnits(), NOW_ANCHOR);
    expect(summary.destinationCell.length, "the summary's own destination text is empty").toBeGreaterThan(0);

    render(<ResultsSection results={[{ kind: "movement", movement }]} units={allUnits()} now={NOW_ANCHOR} />);
    // Owner, 26 Sept 2026: the row shows the patient's name, never the WF journey number, so the
    // row is located via its "Open" link (whose href still carries the movement id) rather than by
    // the movement id appearing in visible text.
    const row = screen.getByRole("link", { name: "Open" }).closest("tr");
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent(summary.destinationCell);
    document.body.innerHTML = "";

    const selection: PreviewSelection = { kind: "movement", movement };
    render(
      <RecordPreview
        selection={selection}
        referrals={[]}
        movements={[movement]}
        patients={[]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("ward-patient-search-preview")).toHaveTextContent(summary.destinationCell);
  });
});

/**
 * 🔴 **WHERE EVERY LINK ACTUALLY GOES — the half the suite above does not test.**
 *
 * Found by Ward Verifier, 2026-09-06, reading the committed source rather than running it. The eight
 * cases above assert facet counts, the tie's WORDS, and the absence sentences. **Not one of them
 * asserts an `href`.** So "143 passed" proved the panel renders the right text about the right
 * records, and proved nothing at all about arrival.
 *
 * ⚠️ **Swap `people/${patient.id}` for `people/${movement.id}` and every one of those cases stays
 * green.** The person route would render "no such person" for a movement id, a coordinator would land
 * on an empty record, and nothing in this repository would go red — the defect renders perfectly.
 *
 * ⚠️ **The `next/link` mock at the top is both why this is cheap and why it was missed:** it forwards
 * `href` straight to the DOM, so the assertion was available the whole time and simply was never
 * written. This is not a hard test. It is a test nobody thought to add.
 *
 * **Every assertion here pins the ID, never that a link exists** — `getByRole("link")` passing says a
 * link is present, which is exactly what a link to the wrong record also says.
 */
describe("every tie link carries the record it names", () => {
  const patient = seed.patients[0];
  const baseReferral = seed.referrals.find((referral) => referral.id === "RF-011");
  if (!baseReferral) throw new Error("fixture RF-011 is required by this suite and is missing");
  const baseMovement = seed.movements.find((movement) => movement.id === "WF-011");
  if (!baseMovement) throw new Error("fixture WF-011 is required by this suite and is missing");

  const linkedReferral: Referral = { ...baseReferral, id: "RF-TEST-HREF", patientId: patient.id };
  // The movement names the same person as its referral (seed movements now carry their own
  // patientId since the seed-link work, so the copy must not keep WF-011's own person).
  const linkedMovement: Movement = {
    ...baseMovement,
    id: "WF-TEST-HREF",
    referralId: linkedReferral.id,
    patientId: patient.id,
  };

  /*
   * ⚠️ THE ANTI-VACUITY FLOOR, AND IT IS NOT DECORATION. Every assertion below distinguishes a person
   * id from a movement id. If the fixture ever gave them the same string, a swap between them would
   * satisfy both assertions and this whole describe would pass while testing nothing.
   */
  it("uses a person id and a movement id that are actually different, or nothing below discriminates", () => {
    expect(patient.id, "the fixture person and movement share an id — a swap between them would pass").not.toBe(
      linkedMovement.id,
    );
  });

  function renderFor(selection: PreviewSelection) {
    render(
      <RecordPreview
        selection={selection}
        referrals={[linkedReferral]}
        movements={[linkedMovement]}
        patients={[patient]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
  }

  it("from a MOVEMENT: opens that movement, and reaches the person by their own id", () => {
    renderFor({ kind: "movement", movement: linkedMovement });

    expect(screen.getByRole("link", { name: /Open full record/ })).toHaveAttribute(
      "href",
      `/mockups/ward-flow/movements/${linkedMovement.id}`,
    );

    const personSection = screen.getByTestId("ward-patient-search-preview-person");
    expect(within(personSection).getByRole("link")).toHaveAttribute("href", `/mockups/ward-flow/people/${patient.id}`);
  });

  /*
   * 🔴 THE LEG THAT WAS PLAIN TEXT UNTIL 2026-09-06. From a movement the person opened with a click;
   * from a person the movement printed an id to read, retype and search for. The panel's whole claim
   * is that these are ONE HUMAN BEING, and it made one direction a click and the other a re-type.
   */
  it("from a PERSON: opens that person's own linked movement, rather than printing its id to retype", () => {
    renderFor({ kind: "person", patient });

    const movementSection = screen.getByTestId("ward-patient-search-preview-movement");
    expect(
      within(movementSection).getByRole("link"),
      "the movement leg is not a link — a coordinator must read the id and search again",
    ).toHaveAttribute("href", `/mockups/ward-flow/movements/${linkedMovement.id}`);

    expect(screen.getByTestId("ward-patient-preview-raise-referral")).toHaveAttribute(
      "href",
      `/mockups/ward-flow/referrals/new?patientId=${patient.id}`,
    );
  });
});

/**
 * TASK 6 — the "Selected person" panel gains the §6.11 stage stepper, one primary in-panel
 * action ("Open the movement"), and states plainly when there is no movement to show a stage
 * for. Standard §8.4: no verdict about a person is ever drawn — this panel adds none.
 */
describe("the selected person panel's stage stepper and its one primary action", () => {
  const patient = seed.patients[2];
  const baseReferral = seed.referrals.find((referral) => referral.id === "RF-011");
  if (!baseReferral) throw new Error("fixture RF-011 is required by this suite and is missing");
  const baseMovement = seed.movements.find((movement) => movement.id === "WF-011");
  if (!baseMovement) throw new Error("fixture WF-011 is required by this suite and is missing");

  const linkedReferral: Referral = { ...baseReferral, id: "RF-TEST-STEPPER", patientId: patient.id };
  /*
   * A MIDDLE stage, deliberately not the first. A stepper that always renders index 0 would pass
   * a test built against the first stage without proving it reads the movement's OWN stage —
   * exactly the "second copy of the stage list" this task's brief warns against.
   */
  const linkedMovement: Movement = {
    ...baseMovement,
    id: "WF-TEST-STEPPER",
    referralId: linkedReferral.id,
    stage: "handover_ready" as MovementStage,
  };

  function renderPreviewForPersonWithMovement() {
    render(
      <RecordPreview
        selection={{ kind: "person", patient }}
        referrals={[linkedReferral]}
        movements={[linkedMovement]}
        patients={[patient]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    return { movement: linkedMovement };
  }

  // Owner, 26 Sept 2026: the primary action reads "Open this movement", never the WF journey number.
  it("offers one primary action, Open this movement, and it keeps the identifier", () => {
    const { movement } = renderPreviewForPersonWithMovement();
    expect(screen.getByRole("link", { name: /open this movement/i })).toHaveAttribute(
      "href",
      `/mockups/ward-flow/movements/${movement.id}`,
    );
    // One primary action per panel — standard §6.13, "one primary per panel at most".
    expect(screen.getAllByRole("link", { name: /open this movement/i })).toHaveLength(1);
  });

  it("draws the stepper from the movement's own stage, never a second copy of the stage list", () => {
    renderPreviewForPersonWithMovement();
    const expectedIndex = MOVEMENT_STAGES.indexOf(linkedMovement.stage);
    expect(expectedIndex, "fixture assumption: the chosen stage must actually be in the list").toBeGreaterThan(0);

    const stepper = screen.getByRole("img", {
      name: new RegExp(`Stage ${expectedIndex + 1} of ${MOVEMENT_STAGES.length}`, "i"),
    });
    // Every stage in MOVEMENT_STAGES gets exactly one bar — a stepper hard-coding a shorter list
    // would silently draw fewer bars than stages exist, and this would not catch it otherwise.
    expect(stepper.querySelectorAll("[data-s]")).toHaveLength(MOVEMENT_STAGES.length);
    expect(stepper.querySelectorAll('[data-s="done"]')).toHaveLength(expectedIndex);
    expect(stepper.querySelectorAll('[data-s="now"]')).toHaveLength(1);
  });

  /*
   * (c) — A SELECTED PERSON WITH NO MOVEMENT RENDERS THE PANEL WITH WORDS AND NO STEPPER. An
   * absence shown and marked, never a panel that disappears: a reader must not be able to
   * confuse "this person has no movement" with "the panel failed to load".
   */
  it("a selected person with no current movement renders the panel with words and no stepper", () => {
    const lonelyPatient = seed.patients[1];
    expect(
      seed.referrals.some((referral) => referral.patientId === lonelyPatient.id),
      "fixture assumption: no seeded referral names this patient",
    ).toBe(false);

    render(
      <RecordPreview
        selection={{ kind: "person", patient: lonelyPatient }}
        referrals={seed.referrals}
        movements={seed.movements}
        patients={seed.patients}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );

    const movementSection = screen.getByTestId("ward-patient-search-preview-movement");
    expect(movementSection).toHaveTextContent(/no referral is linked/i);
    expect(movementSection).toHaveTextContent(/no current movement/i);
    expect(screen.queryByRole("img", { name: /stage/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-patient-search-preview-stepper")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open the movement/i })).not.toBeInTheDocument();
  });
});
