import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { expectSays } from "./helpers/ward-caption";

// Same reason as the sibling dom suites (ward-screen.dom.test.tsx,
// ward-flow-clock-consistency.dom.test.tsx): `ClinicalRail` renders next/link anchors and this
// suite never checks routing, so a plain <a> avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { COHORTS, URGENCY_LEVELS, type UrgencyLevel } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedReleases, referrals as seededReferrals, wardMovements } from "@/components/ward-management/ward-movements";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { formTitleForCode } from "@/lib/form-register";

/**
 * The two surfaces the fix-wave-1 reviewer named as untested: that the intake picker's chosen
 * code actually reaches the reducer, and that the examine control is now offered on a Form 3B —
 * one of the three cases the deleted "form must be 1A" gate refused outright.
 *
 * Both are driven through the real screen and the real provider. Nothing here reaches into the
 * reducer directly: the picker is changed and the form submitted exactly as a clinician would,
 * and the resulting state is read back through `useWardFlow` by the probe below rather than
 * asserted against a hand-built object.
 *
 * Extended for the clinical-safety fix below (five fields that used to reach the reducer
 * unanswered): `cohort`, `security`, `sex`, `legalStatus` and `urgency` are appended after the
 * three original fields, never inserted between them, so every existing assertion below that
 * matches a leading substring of this text (`toHaveTextContent` is a substring match) still
 * matches unchanged.
 */
function LastMovementProbe() {
  const { movements } = useWardFlow();
  const last = movements.at(-1);
  return (
    <p data-testid="probe">
      {last?.id ?? "none"}|{last?.legalForm?.code ?? "no-form"}|{last?.formedAt ?? "no-formedAt"}|
      {last?.cohort ?? "no-cohort"}|{last?.security ?? "no-security"}|{last?.sex ?? "no-sex"}|
      {last?.legalStatus ?? "no-legal-status"}|{last?.urgency ?? "no-urgency"}
    </p>
  );
}

/** The id `RAISE_REFERRAL` gives the first referral raised against a freshly seeded state. */
const FIRST_RAISED_ID = "WF-901";

function renderEd() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="jhc-ed" />
      <LastMovementProbe />
    </WardFlowProvider>,
  );
}

/**
 * The five fields the raise-referral submit now refuses to fire without, and the concrete value
 * each is set to when this suite wants it answered. A data table rather than five separate
 * `fireEvent.change` calls precisely so `fillRequiredReferralFieldsExcept` below can skip exactly
 * one by name, leaving it at whatever `DEFAULT_DRAFT` (`ed-screen.tsx`) actually seeds it with —
 * never reset back to the placeholder through the UI, which would make these tests pass no matter
 * what that default held.
 */
const REQUIRED_REFERRAL_FIELDS = [
  { testId: "ward-ed-referral-cohort", value: "Adult" },
  { testId: "ward-ed-referral-security", value: "Open" },
  { testId: "ward-ed-referral-sex", value: "Female" },
  // T11 (after T10, item 8, owner answer 17 September 2026): a sixth required field, "gender at
  // referral decides the incoming bed check". Any real answer works here; `not_recorded` (the
  // explicit "Not yet recorded" choice) is proven separately as a real, non-blocking answer.
  { testId: "ward-ed-referral-gender", value: "Female" },
  { testId: "ward-ed-referral-legal-status", value: "Voluntary" },
  { testId: "ward-ed-referral-urgency", value: "3" },
] as const;

/**
 * Answers the five fields the raise-referral submit now refuses to fire without — the
 * clinical-safety fix the `describe` block near the end of this file is about.
 */
function fillRequiredReferralFields() {
  for (const field of REQUIRED_REFERRAL_FIELDS) {
    fireEvent.change(screen.getByTestId(field.testId), { target: { value: field.value } });
  }
  // ⚠️ Answered separately because it is a radio pair, not a <select>. Owner ruling 1 made an
  // unticked checkbox load-bearing — a `false` nobody chose skips the reducer's one-to-one
  // capacity refusal — so "Not required" is now stated rather than assumed.
  fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
  // Same shape, same reasoning, added 2026-09-10 with the acuity gate: a `false` nobody chose
  // skips the acuity gate entirely, so "Not required" is stated rather than assumed here too.
  fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
}

/**
 * Answers every required field EXCEPT `skipTestId`, which is never touched at all — so it stays
 * at whatever `DEFAULT_DRAFT` seeded it with, exactly as a clinician who genuinely never looked
 * at that one control would leave it. This is what makes the five isolated tests below a real
 * proof that each field's OWN default is unanswered, rather than a proof that a value this test
 * chose and then explicitly cleared is unanswered.
 */
function fillRequiredReferralFieldsExcept(skipTestId: string) {
  for (const field of REQUIRED_REFERRAL_FIELDS) {
    if (field.testId === skipTestId) continue;
    fireEvent.change(screen.getByTestId(field.testId), { target: { value: field.value } });
  }
  if (skipTestId !== "ward-ed-referral-specialling-not-required") {
    fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
  }
  if (skipTestId !== "ward-ed-referral-high-acuity-not-required") {
    fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
  }
}

/** Opens the intake form, answers the five required fields (see `fillRequiredReferralFields`),
 *  sets the legal-form picker to `code`, and submits. */
function raiseReferralWithForm(code: string) {
  fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
  fillRequiredReferralFields();
  fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: code } });
  fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
}

/**
 * T8 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`): `REFER_TO_UNITS`
 * (coordinator), `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` (ward) are none of them ED-screen
 * actions, so there is no control on `EdScreen` itself to reach `pulled` — the precondition the
 * revoked-at-handover flag sentence needs. Same "expose the real event, not a fixture" discipline
 * `StaleBlockedReleaseSetup` (`ward-capacity-view.dom.test.tsx`) already uses for its own
 * out-of-screen precondition. Always targets the LAST movement, the same convention
 * `LastMovementProbe` above already uses — the most recently raised referral.
 */
// At least 2 free beds: this harness pulls more than one movement to the same unit across a
// single test (a revoked-at-handover movement, then a fresh pulled-only one), and a unit with
// exactly one free bed would refuse the second PULL_PATIENT for a reason this suite is not about.
const HARNESS_UNIT_ID = allUnits().find((unit) => unit.allocatable.value >= 2)!.id;

function PullToWardHarness() {
  const { now, dispatch, movements } = useWardFlow();
  const target = movements.at(-1);
  if (!target) return null;
  return (
    <div>
      <button
        type="button"
        data-testid="test-refer-to-unit"
        onClick={() =>
          dispatch({
            type: "REFER_TO_UNITS",
            role: "coordinator",
            now,
            movementId: target.id,
            unitIds: [HARNESS_UNIT_ID],
          })
        }
      >
        refer
      </button>
      <button
        type="button"
        data-testid="test-accept-in-principle"
        onClick={() =>
          dispatch({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId: target.id, unitId: HARNESS_UNIT_ID })
        }
      >
        accept
      </button>
      <button
        type="button"
        data-testid="test-pull-patient"
        onClick={() =>
          dispatch({ type: "PULL_PATIENT", role: "ward", now, movementId: target.id, unitId: HARNESS_UNIT_ID })
        }
      >
        pull
      </button>
    </div>
  );
}

function renderEdWithHarness() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="jhc-ed" />
      <LastMovementProbe />
      <PullToWardHarness />
    </WardFlowProvider>,
  );
}

describe("emergency department intake picker", () => {
  it("offers every declared form, titled from the official register, and defaults to no form", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    const picker = screen.getByTestId("ward-ed-referral-legal-form") as HTMLSelectElement;

    // Defaults to no form: the clinician picks one, the software never picks one for them.
    expect(picker.value).toBe("");
    expect(picker.options[0]).toHaveTextContent("No form");

    // One option per declared code, in the declared order, plus the "No form" option.
    const offered = [...picker.options].slice(1).map((option) => option.value);
    expect(offered).toEqual(SELECTABLE_LEGAL_FORMS.map((form) => form.code));

    // Non-vacuity: there really are several, so an emptied list could not pass the check above.
    expect(offered.length).toBeGreaterThan(3);

    // The title shown is the register's, not one Ward Flow holds. Asserted against the literal
    // official string rather than against `formTitleForCode`'s own output, so a change to the
    // register's 3D entry has to be seen and acknowledged here rather than tracked silently.
    const option3D = [...picker.options].find((option) => option.value === "3D")!;
    expect(option3D).toHaveTextContent(
      "Form 3D (Order authorising reception and detention in an authorised hospital for further examination)",
    );
    expect(option3D.textContent).toBe(`Form 3D (${formTitleForCode("3D")})`);
  });

  // Fix round B (review finding I3): `COHORT_OPTIONS` used to be hand-listed as
  // `["Adult", "Older adult"]`, typed `Cohort[]` rather than derived from `COHORTS` — so widening
  // `Cohort` to include `"Youth"` could never make this picker fail to compile, and the ED cohort
  // picker silently offered no way to raise a Youth referral. This test pins the fix: the picker
  // is now driven off `COHORTS` directly, so it is proven against the real runtime list rather
  // than a second hand-written copy of it, and Youth is explicitly asserted present.
  it("offers every cohort in COHORTS, Youth included", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    const picker = screen.getByTestId("ward-ed-referral-cohort") as HTMLSelectElement;
    // Index 0 is now the "Choose a cohort" placeholder — nothing is chosen for the clinician —
    // so the real options start at index 1, the same convention the legal-form picker test above
    // already uses for its own leading placeholder.
    expect(picker.options[0]).toHaveTextContent("Choose a cohort");
    const offered = [...picker.options].slice(1).map((option) => option.value);
    expect(offered).toEqual(COHORTS);
    expect(offered).toContain("Youth");
  });

  it("dispatches the chosen code onto the referral it raises", () => {
    renderEd();
    // Before: the last movement is a fixture one, not the referral this test is about.
    expect(screen.getByTestId("probe")).not.toHaveTextContent(FIRST_RAISED_ID);

    raiseReferralWithForm("3D");

    // The chosen code reached the reducer and is on the created movement — and nothing else is:
    // no `formedAt` was stamped, and no title was copied onto the record.
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|3D|no-formedAt`);
    expect(screen.getByTestId(`ward-ed-patient-${FIRST_RAISED_ID}`)).toBeInTheDocument();
  });

  it("raises a referral with no form when the legal-form picker is left alone", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    // The other five fields must still be answered — this test is about the legal-form picker
    // specifically being left alone, not about the clinical-safety fix covered further down.
    fillRequiredReferralFields();
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|no-form|no-formedAt`);
  });

  /**
   * Fix wave 2, item 1 — closing the gap wave 1 disclosed. Restoring the deleted
   * `legalForm?.code === "1A" && examination === undefined` inference in `outstandingItem` left
   * all five earlier tests green, because none of them puts a patient on a 1A: that branch fires
   * for a Form 1A and nothing else, so nothing could see it come back.
   *
   * A Form 1A with no examination is exactly the state the deleted rule described, and it is the
   * state the picker can now produce for a **Voluntary** patient — the contradiction that made
   * the inference untenable. The assertions are in both directions: the wording that IS there,
   * and the wording that must NOT be, so deleting the record-based line without restoring the
   * inference fails too.
   */
  it("states the record, not 'Referred for examination', for a patient on a Form 1A", () => {
    renderEd();
    raiseReferralWithForm("1A");
    // Non-vacuity: the movement really is on a 1A with no examination, which is the only state
    // the deleted inference ever applied to.
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|1A|`);

    const outstanding = screen.getByTestId(`ward-ed-outstanding-${FIRST_RAISED_ID}`);
    expect(outstanding).toHaveAttribute("data-kind", "examination");
    /*
     * ⚠️ **"not recorded" ADDED 2026-09-09 AFTER THE REWORD ARM WENT RED ON AN HONEST REWORDING.**
     * `detail: "No examination outcome recorded for this movement."` → `"Examination outcome not
     * recorded for this movement."` is the same claim in a different order, and the guard reddened.
     * That is the too-narrow half of this defect class, and for a POSITIVE claim the repair is the
     * spelling list — not a narrower query, which is the repair for the too-broad half.
     *
     * 🔴 **THE SPELLING IS SUBJECT-BOUND, AND THE FIRST ATTEMPT WAS NOT — IT ADDED THE DEFECT IT
     * WAS FIXING.** A bare `"not recorded"` looked safe: this reads ONE row, `ward-ed-outstanding-<id>`
     * with `data-kind="examination"` asserted a line above, so no other row can reach it. **Measured
     * anyway, and it was vacuous.** With `"not recorded"` in the list, a caption reading
     * `"Decline not recorded."` — the wrong subject entirely, saying nothing about an examination —
     * passed 25 of 25. A tight query does not save a subject-free spelling, because the defect can
     * be written INTO the element the query already trusts.
     *
     * `"examination outcome not recorded"` carries its own subject, so it tolerates the reword and
     * still refuses the bystander. **Every spelling in a positive-claim list must independently
     * imply the claim** — the predicate is `some()`, so the weakest spelling sets the guard's real
     * strength, and one subject-free entry makes the whole list as weak as itself.
     */
    expectSays(outstanding.textContent ?? "", "the examination-outcome absence line", [
      "no examination",
      "none",
      "examination outcome not recorded",
    ]);
    // The software may not say what a Form 1A means or what it referred this person for.
    // `fillRequiredReferralFields` answers legal status Voluntary above, so the deleted wording
    // would have been false here as well as unattributed.
    expect(outstanding).not.toHaveTextContent("Referred for examination");
  });

  it("offers the examine control on a Form 3B — the case the deleted gate refused", () => {
    renderEd();
    raiseReferralWithForm("3B");
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|3B|`);

    const toggle = screen.getByTestId(`ward-ed-examine-toggle-${FIRST_RAISED_ID}`);
    // The old gate rendered this `aria-disabled="true"` with a title naming the refusal, and its
    // click handler was inert. Both halves are asserted, because either one surviving alone
    // would still deny the clinician the action.
    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(toggle).not.toHaveAttribute("title");

    fireEvent.click(toggle);
    expect(screen.getByTestId(`ward-ed-examine-form-${FIRST_RAISED_ID}`)).toBeInTheDocument();
  });

  it("records the examination from the screen without changing the form", () => {
    renderEd();
    raiseReferralWithForm("3B");
    fireEvent.click(screen.getByTestId(`ward-ed-examine-toggle-${FIRST_RAISED_ID}`));
    fireEvent.click(screen.getByRole("radio", { name: "Inpatient treatment order" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm examination outcome" }));

    // Still a 3B. The examination no longer replaces the clinician's chosen form.
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|3B|`);
    // And the outstanding item now reports the recorded outcome rather than the missing one.
    const outstanding = screen.getByTestId(`ward-ed-outstanding-${FIRST_RAISED_ID}`);
    expect(outstanding).toHaveAttribute("data-kind", "form");
    expect(outstanding).toHaveTextContent("examination recorded (inpatient order)");
  });
});

/**
 * Wave 1 referral corrections. All three urgency `<select>`s in the movement screens rendered a
 * bare "1", "2", "3" — no word anywhere on the control saying which end of the scale is urgent —
 * while every surface that DISPLAYS the same field spells it out through `urgencyTierLabel`.
 *
 * The consequence is not cosmetic. A clinician who reads the bigger number as "most urgent" files
 * the LEAST urgent referral for the sickest patient, and because urgency outranks everything else
 * in the queue that error sorts the patient to the bottom with no later screen contradicting it.
 *
 * Both tests read the option TEXT. The existing suites above read option `value`s, which were
 * correct throughout and are deliberately still the bare tier — which is exactly why nothing here
 * could catch this. Asserted against `urgencyTierLabel` itself rather than three remembered
 * strings, so the guard is "the pickers and the boards use one spelling" rather than "the picker
 * uses the spelling this test happens to remember".
 */
describe("emergency department urgency pickers", () => {
  it("labels every option on the raise-referral picker with its direction", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));

    // The test-id itself is part of the fix: this picker had none, so no test could address the
    // one urgency control a clinician uses at referral time.
    const picker = screen.getByTestId("ward-ed-referral-urgency") as HTMLSelectElement;

    // Index 0 is now "Choose an urgency tier" — nothing is chosen for the clinician — so the
    // three real tiers start at index 1, checked separately below.
    expect(picker.options[0]).toHaveTextContent("Choose an urgency tier");

    const optionText = [...picker.options].slice(1).map((option) => option.textContent);
    expect(optionText).toEqual(URGENCY_LEVELS.map((level) => urgencyTierLabel(level)));

    // The VALUE stays the bare tier: the model and every value-reading test are unchanged.
    const optionValues = [...picker.options].slice(1).map((option) => option.value);
    expect(optionValues).toEqual(URGENCY_LEVELS.map((level) => String(level)));

    // Non-vacuity: the labels really do carry a direction, so a future `urgencyTierLabel`
    // returning the bare tier again would fail here even though the first assertion still matched.
    expect(optionText).toContain("Tier 1 · most urgent");
    expect(optionText).toContain("Tier 3 · least urgent");
  });

  it("labels every option on the urgency-change picker with its direction", () => {
    renderEd();

    // The movement set is discovered from the rendered screen rather than hand-picked, and a
    // silent zero is refused: an ED with no outbox patients would otherwise pass this vacuously.
    const toggles = screen.getAllByTestId(/^ward-change-urgency-toggle-/);
    expect(toggles.length).toBeGreaterThan(0);
    fireEvent.click(toggles[0]);

    const picker = screen.getByLabelText(/^Urgency tier for /) as HTMLSelectElement;
    const optionText = [...picker.options].map((option) => option.textContent);
    expect(optionText).toEqual(URGENCY_LEVELS.map((level) => urgencyTierLabel(level)));

    const optionValues = [...picker.options].map((option) => option.value);
    expect(optionValues).toEqual(URGENCY_LEVELS.map((level) => String(level)));

    expect(optionText).toContain("Tier 1 · most urgent");
    expect(optionText).toContain("Tier 3 · least urgent");
  });
});

/**
 * The urgency tier on EVERY emergency department card, spelled out, beside the stage — owner
 * ruling, 2026-08-31.
 *
 * ⚠️ **THE RULING IS "EVERY CARD", AND TIER 3 IS THE SUBSTANCE OF IT, NOT A DETAIL.** If the tier
 * showed only on tiers 1 and 2, its ABSENCE would become the signal for tier 3 — and an absence is
 * the one signal this project has repeatedly proved nobody reads. So these tests do not merely
 * check that a tier appears somewhere; they check that the number of tier labels EQUALS the number
 * of cards, which is what a "only when urgent" implementation fails.
 *
 * Each label is read back against the movement's own `urgency` in state, through the probe below,
 * rather than against a tier this file remembers — a fixture whose urgencies are re-authored must
 * not be able to make these pass while the screen shows the wrong tier.
 *
 * The expected TEXT is `urgencyTierLabel`'s own output, never a hand-written second spelling, for
 * the same reason the picker suites above use it: two spellings of one field is this project's most
 * expensive defect class.
 */
function UrgencyProbe() {
  const { movements } = useWardFlow();
  return (
    <ul data-testid="urgency-probe">
      {movements.map((movement) => (
        <li key={movement.id} data-testid={`urgency-probe-${movement.id}`} data-urgency={movement.urgency} />
      ))}
    </ul>
  );
}

/** `renderEd` plus the urgency probe. Deliberately a second helper rather than a change to
 *  `renderEd`, so the suites above render exactly the DOM they rendered before. */
function renderEdWithUrgencies() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="jhc-ed" />
      <UrgencyProbe />
    </WardFlowProvider>,
  );
}

/** The tier this movement actually carries in state, read from the probe. */
function urgencyInState(movementId: string): UrgencyLevel {
  const raw = screen.getByTestId(`urgency-probe-${movementId}`).getAttribute("data-urgency");
  const level = Number(raw);
  expect(URGENCY_LEVELS).toContain(level);
  return level as UrgencyLevel;
}

describe("emergency department cards carry the urgency tier", () => {
  it("spells the tier out on every patient card, tier 3 included", () => {
    renderEdWithUrgencies();

    // The card set is discovered from the rendered screen, never hand-listed, and a silent zero is
    // refused. `ward-ed-patient-` is also the tier label's near-neighbour prefix, so the movement id
    // is anchored to the end of the id here.
    const cards = screen.getAllByTestId(/^ward-ed-patient-WF-\d+$/);
    expect(cards.length).toBeGreaterThan(0);

    const ids = cards.map((card) => card.getAttribute("data-testid")!.replace("ward-ed-patient-", ""));

    // EVERY card, one label each: as many tier labels on the screen as there are cards. An
    // implementation that showed the tier only on the urgent ones would fail right here.
    const labels = screen.getAllByTestId(/^ward-ed-tier-WF-\d+$/);
    expect(labels).toHaveLength(cards.length);

    for (const id of ids) {
      expect(screen.getByTestId(`ward-ed-tier-${id}`)).toHaveTextContent(urgencyTierLabel(urgencyInState(id)));
    }

    // Non-vacuity, and the ruling's actual substance: a tier-3 patient is on this screen and is
    // labelled in full. Without this, a "tiers 1 and 2 only" screen could still satisfy the loop
    // above on a fixture that happened to hold no tier-3 patient.
    const tiersShown = ids.map((id) => urgencyInState(id));
    expect(tiersShown).toContain(3);
    const leastUrgentId = ids.find((id) => urgencyInState(id) === 3)!;
    expect(screen.getByTestId(`ward-ed-tier-${leastUrgentId}`)).toHaveTextContent("Tier 3 · least urgent");
  });

  it("spells the tier out on every outbox row too", () => {
    renderEdWithUrgencies();

    const rows = screen.getAllByTestId(/^ward-ed-outbox-row-WF-\d+$/);
    expect(rows.length).toBeGreaterThan(0);

    const ids = rows.map((row) => row.getAttribute("data-testid")!.replace("ward-ed-outbox-row-", ""));
    const labels = screen.getAllByTestId(/^ward-ed-outbox-tier-WF-\d+$/);
    expect(labels).toHaveLength(rows.length);

    for (const id of ids) {
      expect(screen.getByTestId(`ward-ed-outbox-tier-${id}`)).toHaveTextContent(urgencyTierLabel(urgencyInState(id)));
    }

    /*
     * ⚠️ **TODAY'S FIXTURE PUTS NO TIER-3 PATIENT IN THIS DEPARTMENT'S OUTBOX**, so the loop above
     * — true as it is — cannot see the ruling's actual case: the LEAST urgent patient still
     * carrying a label. A mutation hiding the tier on tier 3 survived this test until this block
     * was added, which is exactly the "passes for no reason" shape.
     *
     * So one is driven there, through the same controls a clinician uses, rather than by reaching
     * into the reducer or by re-authoring the fixture. The change is proven to have landed (the
     * probe reads 3 back out of state) before the row is read, so a silently refused change cannot
     * make this pass.
     */
    const subject = ids[0];
    fireEvent.click(screen.getByTestId(`ward-change-urgency-toggle-${subject}`));
    fireEvent.change(screen.getByLabelText(`Urgency tier for ${seedPatientName(subject)}`), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "reassessed" } });
    fireEvent.click(screen.getByText("Record urgency change"));

    expect(urgencyInState(subject)).toBe(3);
    expect(screen.getByTestId(`ward-ed-outbox-tier-${subject}`)).toHaveTextContent("Tier 3 · least urgent");

    // And still one label per row — the row did not lose its label by becoming least urgent.
    expect(screen.getAllByTestId(/^ward-ed-outbox-tier-WF-\d+$/)).toHaveLength(rows.length);
  });
});

/**
 * THE DEFECT THIS BLOCK EXISTS TO CATCH. `DEFAULT_DRAFT` in `ed-screen.tsx` used to seed
 * `cohort: "Adult"`, `security: "Open"`, `sex: "Female"`, `legalStatus: "Voluntary"` and
 * `urgency: 3` — five real answers nobody had chosen — so a clinician who opened "Raise a
 * referral" and pressed submit without touching a single `<select>` silently recorded all five
 * as though they were the patient's own facts. `sex` is simply wrong for anyone who is not
 * female, and `legalStatus` is a fact about a person's liberty.
 *
 * Every test below drives the real form through `fireEvent` and reads the outcome back through
 * `useWardFlow` via `LastMovementProbe`, never a rendered attribute alone — a button that merely
 * *looks* `aria-disabled` while its handler still fires would pass an attribute check and still
 * be this exact defect.
 */
describe("emergency department referral form refuses an unanswered submission", () => {
  it("does not create a referral when the form is submitted untouched", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    // The outcome, not the button's own attribute: no new movement was created, and this
    // department shows no card for the id a successful submission would have produced.
    expect(screen.getByTestId("probe")).not.toHaveTextContent(FIRST_RAISED_ID);
    expect(screen.queryByTestId(`ward-ed-patient-${FIRST_RAISED_ID}`)).not.toBeInTheDocument();
  });

  /**
   * One case per required field (six as of T11, item 8's `gender`), each answering every other
   * field and leaving exactly one unanswered — never one combined case with all missing. A single
   * combined test would still go green with only one of the checks actually wired, because the
   * other missing answers would each independently block the button; only testing each field
   * alone proves every one of them is its own gate.
   *
   * The untouched field is never reset through the UI — `fillRequiredReferralFieldsExcept`
   * simply never fires a `change` event on it, so it stays at whatever `DEFAULT_DRAFT` actually
   * seeds it with. A version of this test that filled every field and then cleared one back to
   * the placeholder would prove nothing about that field's real default — it would still pass if
   * `DEFAULT_DRAFT` regressed to the old fabricated value, because the explicit clear would erase
   * the evidence.
   */
  it.each(REQUIRED_REFERRAL_FIELDS.map((field) => field.testId))(
    "still refuses to submit when only %s is left unanswered",
    (leftUnanswered) => {
      renderEd();
      fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
      fillRequiredReferralFieldsExcept(leftUnanswered);

      fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

      expect(screen.getByTestId("probe")).not.toHaveTextContent(FIRST_RAISED_ID);
      expect(screen.queryByTestId(`ward-ed-patient-${FIRST_RAISED_ID}`)).not.toBeInTheDocument();
    },
  );

  /**
   * T11 (item 8): the decisive case proving `GENDER_NOT_RECORDED_VALUE` is a real, DELIBERATE
   * answer — not a synonym for the unanswered sentinel `it.each` above proves blocks Send. Every
   * other field is answered normally; gender is explicitly set to "Not yet recorded" and the
   * referral must still be raised.
   */
  it("raises a referral when the clinician explicitly answers gender as Not yet recorded", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fillRequiredReferralFieldsExcept("ward-ed-referral-gender");
    fireEvent.change(screen.getByTestId("ward-ed-referral-gender"), { target: { value: "not_recorded" } });

    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    expect(screen.getByTestId("probe")).toHaveTextContent(FIRST_RAISED_ID);
  });

  /**
   * The regression guard for the one thing this fix must NOT change: what the form does once
   * every field genuinely has an answer. Seven fields are set to values deliberately different
   * from `fillRequiredReferralFields`'s own choices, so this test could not pass by accident on
   * leftover state from a previous case.
   */
  it("submits and records exactly the chosen values once every field is answered", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fireEvent.change(screen.getByTestId("ward-ed-referral-cohort"), { target: { value: "Older adult" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-security"), { target: { value: "Secure" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-sex"), { target: { value: "Male" } });
    // T11 (item 8): a seventh required field this fix must also be answered for, or the form
    // blocks and this test's own regression subject — "no field's value bleeds into another's" —
    // could never be reached.
    fireEvent.change(screen.getByTestId("ward-ed-referral-gender"), { target: { value: "Male" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-status"), {
      target: { value: "Involuntary inpatient" },
    });
    fireEvent.change(screen.getByTestId("ward-ed-referral-urgency"), { target: { value: "1" } });
    // Stated, not assumed — see "one-to-one nursing must be stated" below.
    fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-required"));
    // ⚠️ ANSWERED THE OPPOSITE WAY FROM `specialling` DIRECTLY ABOVE, ON PURPOSE. The two are
    // separate clinical questions and this test's whole subject is that no field's value bleeds
    // into another's; answering both "Required" would make a bleed between exactly this pair
    // invisible, which is the pair most likely to be wired together by mistake.
    fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "3D" } });

    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    // Every answered field reached the reducer unchanged — none substituted, none dropped, and
    // no field's value bled into a different field.
    expect(screen.getByTestId("probe")).toHaveTextContent(
      `${FIRST_RAISED_ID}|3D|no-formedAt|Older adult|Secure|Male|Involuntary inpatient|1`,
    );
    expect(screen.getByTestId(`ward-ed-patient-${FIRST_RAISED_ID}`)).toBeInTheDocument();
  });
});

/**
 * The provenance reason for a legal-status change. `LEGAL_STATUS_CHANGE_REASONS[0]` —
 * `recorded_by_treating_team` — used to be pre-selected on a required field with no blank option,
 * so a clinician correcting a mistyped legal status who never touched the control filed the
 * correction as a fresh report FROM the treating team. A team that never made one.
 *
 * ⚠️ The harm-naming assertion is FIRST in each test deliberately. When an assertion fails the test
 * aborts, so anything below it never runs — a mutation reddening a later line would prove nothing
 * about the sentence that explains the defect.
 */
describe("the legal-status change reason starts unchosen", () => {
  function openFirstLegalStatusForm(): string {
    renderEd();
    const toggles = screen.getAllByTestId(/^ward-change-legal-status-toggle-/);
    expect(toggles.length, "no legal-status toggle rendered — this suite is asserting over nothing").toBeGreaterThan(0);
    const id = toggles[0].getAttribute("data-testid")!.replace("ward-change-legal-status-toggle-", "");
    fireEvent.click(toggles[0]);
    return id;
  }

  it("offers a blank option and selects it, so no reason is filed that nobody picked", () => {
    const id = openFirstLegalStatusForm();
    const select = screen
      .getByTestId(`ward-change-legal-status-${id}`)
      .querySelector(`#ward-change-legal-status-reason-${id}`) as HTMLSelectElement;

    expect(
      select.value,
      "the legal-status reason arrives pre-selected, so a clinician correcting a typo who never " +
        "touches this control files the correction as a fresh report from the treating team — a " +
        "report that team never made",
    ).toBe("");

    const options = [...select.options].map((option) => option.value);
    expect(options, "no blank option, so the clinician cannot decline to state a provenance").toContain("");
  });

  it("makes the submit unavailable, with the reason stated, until a provenance is chosen", () => {
    const id = openFirstLegalStatusForm();
    const form = screen.getByTestId(`ward-change-legal-status-${id}`);
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(
      submit.getAttribute("aria-disabled"),
      "the submit is live while no provenance is chosen, so Enter or a click files an unstated one",
    ).toBe("true");

    // Not native `disabled`: that removes the tab stop, and the stated reason would never be reached.
    expect(submit.hasAttribute("disabled"), "native disabled would hide the stated reason").toBe(false);
    expect(submit.getAttribute("title") ?? "").toContain("None is chosen for you");

    fireEvent.change(form.querySelector(`#ward-change-legal-status-reason-${id}`)!, {
      target: { value: "correcting_an_error" },
    });
    expect(submit.getAttribute("aria-disabled"), "still unavailable after a reason was chosen").toBeNull();
  });
});

/**
 * ⚠️ The worst of the six provenance defaults, and the reason the owner widened the fix from four
 * controls to six. `URGENCY_CHANGE_REASONS[0]` is `reassessed` — so a clinician correcting a
 * mistyped urgency who never touched the control recorded a CLINICAL REASSESSMENT THAT NEVER
 * HAPPENED. That invents a clinical event; the legal-status default only mis-attributed a clerical
 * one.
 */
describe("the urgency change reason starts unchosen", () => {
  it("selects no reason, so a typo correction is never filed as a reassessment nobody made", () => {
    renderEd();
    const toggles = screen.getAllByTestId(/^ward-change-urgency-toggle-/);
    expect(toggles.length, "no urgency toggle rendered — this test is asserting over nothing").toBeGreaterThan(0);
    const id = toggles[0].getAttribute("data-testid")!.replace("ward-change-urgency-toggle-", "");
    fireEvent.click(toggles[0]);

    const select = document.getElementById(`ward-change-urgency-reason-${id}`) as HTMLSelectElement;
    expect(
      select.value,
      "the urgency reason arrives pre-selected as 'reassessed', so a clinician correcting a mistyped " +
        "urgency who never touches this control records a clinical reassessment that never happened",
    ).toBe("");
    expect(
      [...select.options].map((o) => o.value),
      "no blank option to decline a reason",
    ).toContain("");
  });
});

/**
 * ⚠️ OWNER RULING 1 FALSIFIED THIS FIELD'S OWN JUSTIFYING COMMENT. An unticked checkbox cannot
 * distinguish "not required" from "not yet answered" — its unticked state is both. That was
 * harmless while nothing read it, and stopped being harmless the moment `movement.specialling`
 * became the condition on the reducer's one-to-one capacity refusal (`ward-flow-reducer.ts:966`):
 * a `false` nobody chose does not record "not required", it SKIPS THE CHECK, and a patient needing
 * one-to-one nursing can be pulled into a ward that cannot staff it.
 */
describe("one-to-one nursing must be stated, not assumed", () => {
  it("blocks the referral until one-to-one nursing is answered either way", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fillRequiredReferralFieldsExcept("ward-ed-referral-specialling-not-required");

    const submit = screen.getByTestId("ward-ed-referral-submit");
    expect(
      submit.getAttribute("aria-disabled"),
      "the referral can be raised with one-to-one nursing unanswered, so it is filed as 'not " +
        "required' — and the reducer only checks a ward's one-to-one capacity when the patient is " +
        "recorded as needing it, so the capacity refusal is skipped for a patient nobody assessed",
    ).toBe("true");

    // Neither radio is pre-chosen: the absence is the point, not a cleared value.
    expect(
      (screen.getByTestId("ward-ed-referral-specialling-required") as HTMLInputElement).checked,
      "'Required' arrives pre-chosen",
    ).toBe(false);
    expect(
      (screen.getByTestId("ward-ed-referral-specialling-not-required") as HTMLInputElement).checked,
      "'Not required' arrives pre-chosen, which is the old checkbox defect in a new shape",
    ).toBe(false);

    fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
    expect(submit.getAttribute("aria-disabled"), "still blocked after the clinician answered").toBeNull();
  });
});

describe("the ED screen's statewide capacity table says which ready beds are not yet usable", () => {
  /*
   * 🔴 **OWNER RULING 2026-09-05, CARRIED TO THIS SCREEN 2026-09-06.** "Ready" counts beds the
   * application itself refuses to admit a patient into — `ward-flow-reducer.ts` rejects
   * `PULL_PATIENT` with *"every free bed at X is still being made ready"*. The ruling was explicitly
   * NOT to change the number: the cleaning count sits beside it.
   *
   * ⚠️ **THIS TABLE IS READ-ONLY AND THAT IS NOT A REASON TO OMIT THE COUNT.** Nothing on it can be
   * actioned, but a figure that overstates availability does its damage wherever it is believed,
   * not only where it is clicked. Before this, nothing in the repository asserted anything at all
   * about this table.
   *
   * The count comes from `bedsPendingPreparation`, the reducer's OWN helper — the same function
   * whose result gates the refusal — so this screen and that refusal cannot disagree.
   */
  const PREPARING_UNIT = "arm-adult-open";

  it("fixture precondition: exactly one ward has a bed discharged and still being made ready", () => {
    const preparing = bedReleases.filter((release) => release.state === "discharged" && release.preparing);
    expect(
      preparing.map((release) => release.unitId),
      "no seeded release is discharged-and-preparing, so both assertions below would be vacuous",
    ).toContain(PREPARING_UNIT);
  });

  it("shows the cleaning count beside that ward's Ready figure, and the figure itself is untouched", () => {
    renderEd();
    const cell = screen.getByTestId(`ward-ed-capacity-ready-${PREPARING_UNIT}`);
    const note = within(cell).getByTestId(`ward-ed-capacity-pending-${PREPARING_UNIT}`);

    expect(note).toHaveTextContent(/still being made ready/u);

    /*
     * The figure is read with the note stripped out, and compared against `unitCapacity` — the same
     * derivation the screen calls. Asserting the whole cell's text would conflate the ruling working
     * with the defect it forbids, which is exactly how the sibling guard on the ward screen came to
     * go red for the right behaviour.
     */
    const figure = (cell.textContent ?? "").replace(note.textContent ?? "", "").trim();
    const unit = allUnits().find((candidate) => candidate.id === PREPARING_UNIT)!;
    expect(figure, "the cleaning count was subtracted from Ready; the owner ruled the number does not move").toBe(
      String(unitCapacity(unit, bedReleases).available),
    );
  });

  it("renders no cleaning note for a ward with nothing being made ready", () => {
    /*
     * Both directions. Without this the guard above would pass on a screen that printed the note on
     * every row — which would claim every ward has a bed out of use.
     */
    const quiet = allUnits().find(
      (unit) => !bedReleases.some((r) => r.unitId === unit.id && r.state === "discharged" && r.preparing),
    )!;
    renderEd();
    expect(
      screen.queryByTestId(`ward-ed-capacity-pending-${quiet.id}`),
      `${quiet.id} has nothing being made ready and must not claim it does`,
    ).toBeNull();
  });
});

/**
 * WLQ-14, owner ruling 2026-09-15: the ED access-block clock starts when the referral is received;
 * medical clearance is shown beside it as its own, separate time — he rejected clearance as the
 * start because ED doctors can refer before clearance.
 *
 * `WF-002` is the fixture's own discriminating case: its `openedAt` (when `RAISE_REFERRAL` was
 * processed — the referral into `fsh-ed`'s psychiatry queue being received), its linked referral
 * `RF-012`'s `raisedAt` (the front-door referral into the emergency department itself, 60 minutes
 * EARLIER) and that referral's `triagedAt` (20 minutes later again) are three genuinely different
 * instants. A clock keyed on any of the other two would print a different number here, which is
 * what makes this fixture able to prove the clock's actual source rather than merely restate it.
 */
describe("the departmental access clock starts when the referral is received (WLQ-14)", () => {
  it("fixture precondition: WF-002 links to RF-012, and openedAt/raisedAt/triagedAt genuinely differ", () => {
    const movement = wardMovements.find((candidate) => candidate.id === "WF-002")!;
    const referral = seededReferrals.find((candidate) => candidate.id === "RF-012")!;
    expect(movement.referralId).toBe("RF-012");
    expect(movement.openedAt).toBe(NOW_ANCHOR - 180);
    expect(referral.raisedAt).toBe(NOW_ANCHOR - 240);
    expect(referral.triagedAt).toBe(NOW_ANCHOR - 200);
    // Non-vacuity: the three instants below must be pairwise distinct or a clock keyed on any of
    // them would print the same figure and this suite would prove nothing.
    expect(new Set([movement.openedAt, referral.raisedAt, referral.triagedAt]).size).toBe(3);
  });

  it("counts from movement.openedAt — never from the front-door referral's raisedAt, never from triagedAt", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="fsh-ed" />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("ward-ed-patient-WF-002");
    // 180 = NOW_ANCHOR - openedAt. Had the clock instead read raisedAt this would be 240; had it
    // read triagedAt it would be 200 — both wrong answers this assertion rules out by name.
    expect(
      card,
      "the departmental access clock must count from openedAt, not from the front-door referral's own raisedAt or triagedAt",
    ).toHaveAttribute("data-minutes-in-department", "180");
  });
});

/** Dispatches a real `RECORD_MEDICAL_CLEARANCE` — the only writer of `Referral.medicalClearance` —
 *  for a referral the test names, exactly as the ED inbox's own "Record medically cleared" button
 *  would, without depending on that referral still being reachable from the inbox list. */
function RecordClearanceHarness({ referralId, cleared }: { referralId: string; cleared: boolean }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button
      type="button"
      data-testid={`test-record-clearance-${referralId}`}
      onClick={() => dispatch({ type: "RECORD_MEDICAL_CLEARANCE", role: "ed", now, referralId, cleared })}
    >
      record clearance
    </button>
  );
}

describe("medical clearance is shown beside the access clock, as its own separate time (WLQ-14)", () => {
  it("shows nothing beside the clock when no clearance is recorded for the linked referral", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="fsh-ed" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-ed-medical-clearance-WF-002")).not.toBeInTheDocument();
  });

  it("shows nothing for a movement with no linked referral at all — never a fabricated time", () => {
    // WF-001 (arm-ed) carries a `referralAbsence`, never a `referralId` — the honest "not asked"
    // case `RAISE_REFERRAL`'s own doc comment names, so this must resolve nothing rather than
    // inventing a clearance time for a referral this movement was never linked to.
    const movement = wardMovements.find((candidate) => candidate.id === "WF-001")!;
    expect(movement.originEdId, "fixture precondition: WF-001 is at arm-ed").toBe("arm-ed");
    expect(movement.referralId, "fixture precondition: WF-001 must carry no referralId").toBeUndefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-ed-medical-clearance-WF-001")).not.toBeInTheDocument();
  });

  it("shows the recorded clearance time once RF-012 is cleared, and never moves the access clock's own figure", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="fsh-ed" />
        <RecordClearanceHarness referralId="RF-012" cleared={true} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("test-record-clearance-RF-012"));

    const clearanceRow = screen.getByTestId("ward-ed-medical-clearance-WF-002");
    expect(clearanceRow).toHaveTextContent(/Yes — recorded/);
    // The words this figure must never carry — the same discipline `accessTargetLine`'s own comment
    // holds the departmental target to, applied here because a clearance TIME sitting next to a
    // clock is exactly where a reader would misread it as the clock's own deadline.
    expect(clearanceRow.textContent ?? "").not.toMatch(/due|deadline|breach|overdue|must be/i);

    // And the access clock beside it is untouched — same figure whether or not clearance was ever
    // recorded, which is the whole point of the ruling: clearance is a separate time, not a start.
    expect(screen.getByTestId("ward-ed-patient-WF-002")).toHaveAttribute("data-minutes-in-department", "180");
  });

  it("shows 'No' rather than nothing when the department recorded a NOT-cleared answer", () => {
    // Three states, not two (the field's own doc comment in ward-model.ts): absence must never
    // collapse with an explicit "no", so this is the second direction the case above cannot prove.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="peel-ed" />
        <RecordClearanceHarness referralId="RF-013" cleared={false} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("test-record-clearance-RF-013"));

    expect(screen.getByTestId("ward-ed-medical-clearance-WF-009")).toHaveTextContent(/No — recorded/);
  });
});

describe("Form 1A receipt handling (T2r fix round, finding 10: renamed — the statutory clocks this described are deleted, not tested here)", () => {
  /**
   * 🔴 **RE-POINTED, Task T1 (docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md item 1,
   * owner answer 1) — NOT DELETED.** This test's whole reason for a "72h validity"/"24h exam
   * clock" pair was the computed countdown the owner rejected: *"the timer that starts when a
   * patient arrives is separate to forms... the app works out no limits itself."* That countdown
   * (`FORM_1A_VALIDITY_HOURS`/`FORM_1A_EXAMINATION_WINDOW_HOURS`, and the testids
   * `ed-form-1a-validity-clock-*`/`ed-form-1a-examination-clock-*`) is deleted, not fixed, so
   * there is nothing left for those two assertions to become. What survives from this test's
   * intent: the button itself (still real, still dispatches `RECORD_LEGAL_FORM_RECEIVED`, still
   * disappears once clicked), plus the NEW property that matters now — marking a form received
   * must never fabricate an expiry. WF-001 carries a Form 1A with no `legalForm.dueAt`, so its
   * form-expiry line must read "No expiry recorded from the form." both before AND after the
   * click, because `RECORD_LEGAL_FORM_RECEIVED` (`ward-flow-reducer.ts`) only ever writes
   * `legalFormReceivedAt`/`legalForm.receivedAt` and never touches `dueAt`.
   */
  it("renders 'Mark Form 1A received' button on unreceived Form 1A patient, and marking it received never invents an expiry", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );

    // WF-001 is seeded at arm-ed on Form 1A with legalFormReceivedAt === undefined
    const markReceivedBtn = screen.getByTestId("ed-mark-form-received-WF-001");
    expect(markReceivedBtn).toBeInTheDocument();
    expect(markReceivedBtn).toHaveTextContent("Mark Form 1A received");

    // The form column reads only the typed legalForm.dueAt, and WF-001 carries none — never a
    // computed 72h/24h figure.
    const expiryLine = screen.getByTestId("ward-ed-form-expiry-WF-001");
    expect(expiryLine).toHaveTextContent("No expiry recorded from the form.");
    expect(expiryLine.textContent ?? "").not.toMatch(/\b(72|24)h\b|remaining \(/);
    expect(screen.queryByTestId("ward-ed-form-expiry-warning-WF-001")).not.toBeInTheDocument();

    // Click mark received
    fireEvent.click(markReceivedBtn);

    // Button disappears once marked received
    expect(screen.queryByTestId("ed-mark-form-received-WF-001")).not.toBeInTheDocument();

    // Marking the form received must not fabricate an expiry: the line reads exactly the same
    // as before the click, because it is typed from legalForm.dueAt, never derived from the
    // receipt instant.
    expect(screen.getByTestId("ward-ed-form-expiry-WF-001")).toHaveTextContent("No expiry recorded from the form.");
  });

  /**
   * 🔴 **RE-POINTED, Task T1 — NOT DELETED.** The "72h detention row" this test named is the same
   * deleted computed countdown. What survives: the raised Form 3D movement's form-expiry line
   * must read "No expiry recorded from the form.", because a Form 3D carries no `kind`
   * classification (`ward-model.ts`'s own comment on `LegalForm.kind`), so `RAISE_REFERRAL`'s
   * `capturedDueAt` — selected by `kind`, never by a form code — falls through to `undefined` for
   * it, exactly as it does for every form except a 4A/4C the clinician actually typed an expiry
   * for. The `no-formedAt` fact the probe already pins (see the assertion at
   * `${FIRST_RAISED_ID}|3D|no-formedAt` a few tests above) is no longer what this test is about —
   * `formedAt` plays no part in the form-expiry line at all now.
   */
  it("renders the form-expiry line when a patient is placed on Form 3D, with no expiry recorded — RAISE_REFERRAL never captures a dueAt for a detention form", () => {
    renderEd();
    raiseReferralWithForm("3D");

    const expiryLine = screen.getByTestId(`ward-ed-form-expiry-${FIRST_RAISED_ID}`);
    expect(expiryLine).toBeInTheDocument();
    expect(expiryLine).toHaveTextContent("No expiry recorded from the form.");
    expect(expiryLine.textContent ?? "").not.toMatch(/\b(72|24)h\b|remaining \(/);
    expect(screen.queryByTestId(`ward-ed-form-expiry-warning-${FIRST_RAISED_ID}`)).not.toBeInTheDocument();
  });
});

describe("direct CMHT referral pathway from ED screen", () => {
  it("gates referral on legal examination, keeps patient on board under For community follow-up, and removes after Left the department", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );

    // WF-001 is present at arm-ed on Form 1A without examination
    expect(screen.getByTestId("ward-ed-patient-WF-001")).toBeInTheDocument();

    // The CMHT referral button is gated and disabled with explanation
    const cmhtToggle = screen.getByTestId("ed-refer-cmht-WF-001");
    expect(cmhtToggle).toBeInTheDocument();
    expect(cmhtToggle).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-ed-cmht-unavailable-WF-001")).toHaveTextContent(
      "Not offered until the examination outcome is recorded.",
    );

    // Clicking while blocked does not open the panel
    fireEvent.click(cmhtToggle);
    expect(screen.queryByTestId("ward-ed-cmht-panel-WF-001")).not.toBeInTheDocument();

    // Record an examination outcome for WF-001
    fireEvent.click(screen.getByTestId("ward-ed-examine-toggle-WF-001"));
    fireEvent.click(screen.getByRole("radio", { name: "Inpatient treatment order" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm examination outcome" }));

    // Now referral is unlocked
    expect(cmhtToggle).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByTestId("ward-ed-cmht-unavailable-WF-001")).not.toBeInTheDocument();

    // Open the panel
    fireEvent.click(cmhtToggle);
    const panel = screen.getByTestId("ward-ed-cmht-panel-WF-001");
    expect(panel).toBeInTheDocument();

    // Legal status and catchment note are rendered
    expect(screen.getByTestId("ward-ed-cmht-legal-status-WF-001")).toHaveTextContent("Legal status:");
    expect(screen.getByTestId("ward-ed-cmht-catchment-note-WF-001")).toBeInTheDocument();

    const teamSelect = screen.getByTestId("ward-ed-cmht-select-WF-001") as HTMLSelectElement;
    const confirmBtn = screen.getByTestId("ward-ed-cmht-confirm-WF-001");
    expect(confirmBtn).toBeDisabled();

    // Choose the first available team option
    expect(teamSelect.options.length).toBeGreaterThan(1);
    const chosenTeam = teamSelect.options[1].value;
    fireEvent.change(teamSelect, { target: { value: chosenTeam } });
    expect(confirmBtn).not.toBeDisabled();

    // Confirm the referral
    fireEvent.click(confirmBtn);

    // Patient remains on the ED board under "For community follow-up"
    expect(screen.getByTestId("ward-ed-patient-WF-001")).toBeInTheDocument();
    expect(screen.getAllByText("For community follow-up").length).toBeGreaterThanOrEqual(1);

    // "Left the department" button is rendered
    const leftBtn = screen.getByTestId("ward-ed-mark-left-WF-001");
    expect(leftBtn).toHaveTextContent("Left the department");

    // Click "Left the department"
    fireEvent.click(leftBtn);

    // Now movement is recorded as left and removed from the active ED board
    expect(screen.queryByTestId("ward-ed-patient-WF-001")).not.toBeInTheDocument();
  });
});

/**
 * T8 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`): owner item 7's repeat
 * examination reaches the ED screen — the new outcome option, the history of earlier
 * examinations, and the flag sentence for a bed still held after a revoked examination.
 */
describe("emergency department — repeat examination (owner item 7)", () => {
  it("offers 'Further examination ordered' alongside the three existing outcomes", () => {
    renderEd();
    raiseReferralWithForm("1A");
    fireEvent.click(screen.getByTestId(`ward-ed-examine-toggle-${FIRST_RAISED_ID}`));

    expect(screen.getByRole("radio", { name: "Inpatient treatment order" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Community treatment order" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Revoked — does not proceed" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Further examination ordered" })).toBeInTheDocument();
  });

  it("allows a second examination after 'further examination ordered' and renders the first in history", () => {
    renderEd();
    raiseReferralWithForm("1A");

    fireEvent.click(screen.getByTestId(`ward-ed-examine-toggle-${FIRST_RAISED_ID}`));
    fireEvent.click(screen.getByRole("radio", { name: "Further examination ordered" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm examination outcome" }));

    // The control is offered again — the repeat-examination guard's own precondition — rather
    // than reporting "already examined" the way it would for any other outcome.
    const toggle = screen.getByTestId(`ward-ed-examine-toggle-${FIRST_RAISED_ID}`);
    expect(toggle).not.toHaveAttribute("aria-disabled");
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("radio", { name: "Inpatient treatment order" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm examination outcome" }));

    const history = screen.getByTestId(`ward-ed-examination-history-${FIRST_RAISED_ID}`);
    expect(history).toHaveTextContent("further examination ordered");

    // Not offered a third time: the current outcome (inpatient order) settles the record.
    expect(screen.getByTestId(`ward-ed-examine-toggle-${FIRST_RAISED_ID}`)).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the revoked-while-bed-held flag once a handover_ready movement's examination is revoked, and never for a pulled-only movement", () => {
    renderEdWithHarness();
    raiseReferralWithForm("1A");
    const revokedId = screen.getByTestId("probe").textContent!.split("|")[0]!;

    fireEvent.click(screen.getByTestId("test-refer-to-unit"));
    fireEvent.click(screen.getByTestId("test-accept-in-principle"));
    fireEvent.click(screen.getByTestId("test-pull-patient"));

    // Still just pulled, no examination at all yet — the flag must not appear.
    expect(screen.queryByTestId(`ward-ed-examination-revoked-flag-${revokedId}`)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${revokedId}`));
    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${revokedId}`), {
      target: { value: "Ambulance service" },
    });
    fireEvent.click(screen.getByTestId(`ward-ed-transport-escort-no-${revokedId}`));
    // Owner's third ruling, 2026-09-17: the three phone-logged facts, required and never defaulted.
    fireEvent.change(screen.getByTestId(`ward-ed-transport-cad-number-${revokedId}`), {
      target: { value: "CAD-REVOKED-0001" },
    });
    fireEvent.click(screen.getByTestId(`ward-ed-transport-legal-status-voluntary-${revokedId}`));
    fireEvent.change(screen.getByTestId(`ward-ed-transport-estimated-time-${revokedId}`), {
      target: { value: "14:30" },
    });
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-confirm-${revokedId}`));

    fireEvent.click(screen.getByTestId(`ward-ed-handover-${revokedId}`));

    fireEvent.click(screen.getByTestId(`ward-ed-examine-toggle-${revokedId}`));
    fireEvent.click(screen.getByRole("radio", { name: "Revoked — does not proceed" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm examination outcome" }));

    const flag = screen.getByTestId(`ward-ed-examination-revoked-flag-${revokedId}`);
    expect(flag).toHaveTextContent("The examination was revoked and this movement still holds a bed.");

    // A second, freshly pulled movement with NO examination must not show the flag — the
    // anti-vacuity half: a flag that always renders would pass the assertion above for the
    // wrong reason.
    raiseReferralWithForm("3B");
    const pulledOnlyId = screen.getByTestId("probe").textContent!.split("|")[0]!;
    expect(pulledOnlyId).not.toBe(revokedId);

    fireEvent.click(screen.getByTestId("test-refer-to-unit"));
    fireEvent.click(screen.getByTestId("test-accept-in-principle"));
    fireEvent.click(screen.getByTestId("test-pull-patient"));

    expect(screen.queryByTestId(`ward-ed-examination-revoked-flag-${pulledOnlyId}`)).not.toBeInTheDocument();
    // The first movement's flag must still be standing — a second movement's setup must not have
    // disturbed it.
    expect(screen.getByTestId(`ward-ed-examination-revoked-flag-${revokedId}`)).toBeInTheDocument();
  });
});

describe("P3-2 (Ward Lead audit, 2026-09-17): 'Under a form' counts a legal form, not legalStatus alone", () => {
  it("does not count a raised referral whose legalStatus is set but which carries no legal form", () => {
    renderEd();
    const before = screen.getByRole("button", { name: /Under a form/ }).textContent;

    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fillRequiredReferralFields();
    // Left at the picker's own "No form" default — never touched — while legalStatus is set to a
    // real, non-Voluntary clinical status. Before this fix `!!m.legalStatus` alone counted this as
    // "under a form", which it is not: nobody has recorded one.
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-status"), {
      target: { value: "Referred for psychiatric examination" },
    });
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    const [id, formCode] = screen.getByTestId("probe").textContent!.split("|");
    expect(id).not.toBe("none");
    expect(formCode).toBe("no-form");

    expect(screen.getByRole("button", { name: /Under a form/ }).textContent).toBe(before);
  });
});

describe("P3-1 (Ward Lead audit, 2026-09-17): 'Not reviewed' and 'No destination' exclude a recorded ED outcome", () => {
  it("drops a freshly raised, unreviewed, destination-less patient out of both chips once its outcome is recorded", () => {
    renderEd();
    const notReviewedBefore = screen.getByRole("button", { name: /Not reviewed/ }).textContent;
    const noDestBefore = screen.getByRole("button", { name: /No destination/ }).textContent;

    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fillRequiredReferralFields();
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    const id = screen.getByTestId("probe").textContent!.split("|")[0]!;
    expect(id).not.toBe("none");

    // Freshly raised: no examination, no destination — counted in both chips, proving the walk is
    // real before the fix under test can be observed at all.
    expect(screen.getByRole("button", { name: /Not reviewed/ }).textContent).not.toBe(notReviewedBefore);
    expect(screen.getByRole("button", { name: /No destination/ }).textContent).not.toBe(noDestBefore);

    fireEvent.click(screen.getByTestId(`ward-ed-outcome-toggle-${id}`));
    fireEvent.click(screen.getByTestId(`ward-ed-outcome-discharge-${id}`));

    expect(
      screen.getByRole("button", { name: /Not reviewed/ }).textContent,
      "P3-1: a settled ED outcome is not an unreviewed patient",
    ).toBe(notReviewedBefore);
    expect(
      screen.getByRole("button", { name: /No destination/ }).textContent,
      "P3-1: a settled ED outcome is not a destination-less patient",
    ).toBe(noDestBefore);
  });
});

describe("D-24 (owner ruling, 26 Sept 2026): the long-wait flag is a default, never a breach", () => {
  it("shows 'Waiting over 24 hours' for a movement open past the default, with no breach or standard wording", () => {
    // WF-019 at rgh-ed is seeded open for 2 days 14 hours (ward-movements.ts) specifically so a
    // wait outlasting a day has something real to render against.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rgh-ed" />
      </WardFlowProvider>,
    );

    const title = screen.getByText("Waiting over 24 hours");
    const row = title.closest("li");
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent(seedPatientName("WF-019"));
    expect(row).not.toHaveTextContent("WF-019");
    expect(row!.textContent?.toLowerCase()).not.toContain("breach");
    expect(row!.textContent?.toLowerCase()).not.toContain("standard");
  });
});

// Owner, 26 Sept 2026: labels name the patient, resolved from the seed register, not the WF number.
function seedPatientName(movementId: string): string {
  const seed = seedWardFlowState();
  return resolveSubjectPatient(seed.movements.find((movement) => movement.id === movementId), seed).displayName;
}
