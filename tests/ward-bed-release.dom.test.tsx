// The setup file already loads these matchers; importing them here as well lets the commit-time
// type check, which reads only the changed files, see them too.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-screen.dom.test.tsx: ClinicalRail renders next/link anchors and this suite
// never checks routing itself, so a plain <a> avoids requiring an App Router context jsdom cannot
// provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { BED_RELEASE_WAITING_ON } from "@/components/ward-management/ward-model";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function wardBedFigure(state: string, label: string): number {
  const beds = screen.getByTestId("ward-unit-beds");
  const chip = beds.querySelector<HTMLElement>(`[data-state="${state}"]`);
  expect(chip, `no ${label} chip in this ward's bed grid`).not.toBeNull();
  expect(within(chip!).getByText(label, { selector: "span" })).toBeInTheDocument();
  const value = chip!.querySelector("strong");
  expect(value, `${label} has no numeric value`).not.toBeNull();
  expect(value!.textContent, `${label} is not an exact non-negative integer`).toMatch(/^\d+$/u);
  return Number(value!.textContent);
}

/** The Freeing cell of one ward's row on the live Capacity board. */
function freeingCell(unitId: string): HTMLElement {
  const table = screen.getByTestId("ward-capacity-network-table");
  const row = within(table).getByTestId(`ward-capacity-network-row-${unitId}`);
  return within(row).getByTestId("ward-capacity-network-freeing");
}

/**
 * The Ready FIGURE alone, with the "N still being made ready" note beside it removed.
 *
 * ⚠️ Owner ruling 2026-09-05: the cleaning count sits BESIDE the figure and the figure itself does
 * not move. Reading the cell's whole `textContent` would conflate the two, so a test meaning "the
 * number did not move" would go red the moment that note legitimately appeared or disappeared.
 */
function readyFigure(unitId: string): string {
  const table = screen.getByTestId("ward-capacity-network-table");
  const row = within(table).getByTestId(`ward-capacity-network-row-${unitId}`);
  const cell = within(row).getByTestId("ward-capacity-network-ready");
  const pending = within(cell).queryByTestId("ward-capacity-network-pending");
  const whole = cell.textContent ?? "";
  return pending ? whole.replace(pending.textContent ?? "", "") : whole;
}

/**
 * Flags a bed release at `unitId` for a real occupant with no live release, through the same
 * provider the screens read. Since 25 September 2026 the ward screen's own flag form refuses (a
 * release must name its patient and there is no patient picker yet; Josh chose "Refuse"), so the
 * cases that need a release to exist raise it here instead of through that form.
 */
function ReleaseFlagger({ unitId }: { unitId: string }) {
  const { now, dispatch, admissions, bedReleases: live } = useWardFlow();
  const occupant = admissions.find(
    (a) =>
      a.unitId === unitId &&
      a.state === "occupied" &&
      !live.some((r) => r.admissionId === a.id && r.state !== "discharged"),
  );
  return (
    <button
      type="button"
      data-testid="test-flag-release"
      onClick={() =>
        dispatch({
          type: "FLAG_BED_RELEASE",
          role: "ward",
          now,
          unitId,
          actingUnitId: unitId,
          admissionId: occupant?.id ?? "",
          waitingOn: "Awaiting ward round",
          expectedAt: now + 5 * 60,
        })
      }
    >
      flag release
    </button>
  );
}

/**
 * Task 11 (spec item 9). Before this task bed releases were static fixture data feeding the
 * `potential` capacity figure and no ward could flag one — this proves the control exists, is a
 * picker rather than free text (the binding spec §4 rule this task exists to satisfy), and that a
 * real dispatch actually moves the number shown on screen, the same "dispatch a real event and
 * read the target component again" technique `ward-screen.dom.test.tsx`'s own capacity suite uses.
 *
 * rph-adult-secure's releases are derived from its own stays (since 25 September 2026); that each
 * belongs to a stay on the ward is asserted below rather than assumed, so this suite fails loudly
 * instead of silently under-covering if the fixture ever changes underneath it.
 */
describe("ward bed release flag", () => {
  // CHANGED 25 September 2026: the seed now derives its releases from the ward's own stays (the
  // hand-written WR-001 is gone), so the fixture fact worth pinning is that every release here
  // belongs to a real stay on this ward, and that there is at least one.
  it("fixture assumption: every rph-adult-secure release belongs to a stay on that ward, and there is one", () => {
    const here = bedReleases.filter((release) => release.unitId === "rph-adult-secure");
    expect(here.length).toBeGreaterThan(0);
    for (const release of here) {
      const stay = wardAdmissions.find((admission) => admission.id === release.admissionId);
      expect(stay?.unitId, release.id).toBe("rph-adult-secure");
    }
  });

  it("renders waiting-on and blocker as pickers only — never a free-text field", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const form = screen.getByTestId("ward-flag-bed-release");
    // Structural proof the blocker (and the waiting-on value) is a picker, never free text: the form must
    // contain only <select> controls plus the submit button, no <input type="text"> or
    // <textarea> anywhere inside it.
    expect(within(form).queryAllByRole("textbox")).toHaveLength(0);
    // Three pickers since 26 Sept 2026: the patient whose bed it is, waiting-on and blocker.
    expect(within(form).getAllByRole("combobox")).toHaveLength(3);

    // The Q1 axis change (2026-08-28): this control asked "Confidence" and now asks "Waiting on".
    // Both the old label and the old values are asserted GONE, so a half-finished migration that
    // relabelled the picker while still offering `likely`/`possible` fails here.
    const waitingOnSelect = screen.getByLabelText("Waiting on");
    const blockerSelect = screen.getByLabelText("Blocker");
    expect(waitingOnSelect.tagName).toBe("SELECT");
    expect(blockerSelect.tagName).toBe("SELECT");
    expect(screen.queryByLabelText("Confidence")).toBeNull();

    // Every offered option is a member of the owner-approved list, in its exact words — and
    // "Nothing outstanding" is asserted present by name, because it is the one that lets a ward
    // record a prediction with no obstacle instead of naming one that does not exist.
    const waitingOnOptions = within(waitingOnSelect)
      .getAllByRole("option")
      .map((option) => option.textContent)
      .filter((text): text is string => text !== null && text !== "Choose what it is waiting on");
    expect(waitingOnOptions).toEqual([...BED_RELEASE_WAITING_ON]);
    expect(waitingOnOptions).toContain("Nothing outstanding");

    // List 1 (2026-08-28) added an eighth blocker. The picker offers the whole list verbatim —
    // an entry present in the constant but missing from the screen is a ward unable to record the
    // real reason, which is the failure the addition exists to prevent.
    const blockerOptions = within(blockerSelect)
      .getAllByRole("option")
      .map((option) => option.textContent)
      .filter((text): text is string => text !== null && text !== "No blocker");
    expect(blockerOptions).toEqual([...BED_RELEASE_BLOCKERS]);
    expect(blockerOptions).toContain("Awaiting family or carer arrangement");

    // Fix round 2 (P1): the ward's own estimate of when the bed will be free is a plain
    // `<input type="time">`, same as the leave-bed form's "Expected return" — not a picker, but
    // also never free text.
    const expectedAtInput = screen.getByLabelText("Expected free");
    expect(expectedAtInput.tagName).toBe("INPUT");
    expect(expectedAtInput).toHaveAttribute("type", "time");
  });

  // 🔴 CHANGED 25 September 2026 (Josh chose "Refuse"): a release must name the patient whose stay
  // it belongs to, and this form has no patient picker yet, so a submit is refused and records
  // nothing. When the picker lands, restore the success half: choose a patient, submit, and
  // Expected rises by one and the form resets.
  it("starts with the submit button disabled until a waiting-on value is chosen, then refuses the flag while no patient is chosen, recording nothing", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Baseline, read rather than assumed: the derived seed's releases for this unit.
    const confirmedBefore = wardBedFigure("confirmed", "Confirmed");
    const expectedBefore = wardBedFigure("expected", "Expected");

    const submit = screen.getByTestId("ward-flag-bed-release-submit");
    expect(submit).toBeDisabled();

    // Blocker is optional (Phase 5, spec D3: a flag with no blocker is a plain prediction, not a
    // held release) — so the waiting-on value alone is enough to enable the submit, and choosing
    // then clearing a blocker again must not leave it disabled either.
    fireEvent.change(screen.getByLabelText("Waiting on"), { target: { value: "Nothing outstanding" } });
    expect(submit).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "Awaiting clean" } });
    expect(submit).not.toBeDisabled();

    // The expected-free time is required for the dispatch to actually go through (the reducer's
    // own comment on `FLAG_BED_RELEASE` explains why an estimate matters), but is deliberately
    // NOT wired into the submit button's own `disabled` state — same precedent the leave-bed
    // form's "Expected return" already sets, where only `bedReleaseWaitingOn` gates the button.
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "16:30" } });

    // Clear the blocker back to "No blocker" before submitting. This dates from spec D3, when a
    // blocker made the produced record `blocked` and `capacityBreakdown()` counted it into
    // neither Confirmed nor Expected — submitting with a blocker selected would then have left
    // every figure unchanged and this test could not tell a real dispatch from a no-op. The
    // 2026-08-28 rework made the flag a cross-cut, so a blocked prediction now DOES move
    // Expected; the clear is kept anyway so the figure this test reads has exactly one cause.
    fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "" } });

    fireEvent.click(submit);

    // Refused: the screen says why, and no release was recorded, so neither figure moves. A
    // guessed patient would have raised Expected to 1 here.
    expect(screen.getByText("Choose the patient whose bed is coming free. Nothing was recorded.")).toBeInTheDocument();
    expect(wardBedFigure("confirmed", "Confirmed")).toBe(confirmedBefore);
    expect(wardBedFigure("expected", "Expected")).toBe(expectedBefore);

    // The form is not reset, so nothing the ward typed is lost.
    expect(screen.getByLabelText("Waiting on")).toHaveValue("Nothing outstanding");
    expect(screen.getByTestId("ward-flag-bed-release-submit")).not.toBeDisabled();
  });

  // 26 Sept 2026: the form's patient picker (owner ruling 25 Sept: a bed release names the person
  // whose discharge frees it). Choosing someone records the release against their stay.
  it("records the release against the patient the ward chooses, and offers only people in a bed here", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    const expectedBefore = wardBedFigure("expected", "Expected");

    const picker = screen.getByLabelText("Patient") as HTMLSelectElement;
    const offered = [...picker.options].filter((option) => option.value !== "").map((option) => option.value);
    expect(offered.length, "fixture: someone in a bed on rph-adult-secure has no live release").toBeGreaterThan(0);
    for (const admissionId of offered) {
      const stay = wardAdmissions.find((admission) => admission.id === admissionId);
      expect(stay?.unitId, admissionId).toBe("rph-adult-secure");
      expect(stay?.state, admissionId).toBe("occupied");
    }

    fireEvent.change(picker, { target: { value: offered[0] } });
    fireEvent.change(screen.getByLabelText("Waiting on"), { target: { value: "Nothing outstanding" } });
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "16:30" } });
    fireEvent.click(screen.getByTestId("ward-flag-bed-release-submit"));

    expect(screen.queryByText("Choose the patient whose bed is coming free. Nothing was recorded.")).toBeNull();
    expect(wardBedFigure("expected", "Expected")).toBe(expectedBefore + 1);
    // The chosen person now has a live release, so the picker no longer offers them.
    expect([...(screen.getByLabelText("Patient") as HTMLSelectElement).options].map((o) => o.value)).not.toContain(
      offered[0],
    );
  });

  /*
   * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05.** This case rendered `<WardModeWorkspace
   * mode="capacity" />`, a mode MERGE 02 replaced and no route reaches any more, so it passed
   * forever over a screen no coordinator can open.
   *
   * **The clinical property is unit scoping and it is unchanged:** a bed release flagged by ONE
   * ward must move that ward own expected-to-free figure and no other ward. A reducer writing the
   * release to every unit, or to the wrong one, is the defect — and on a statewide board it reads
   * as a promise about a bed that does not exist.
   *
   * ⚠️ **THE COLUMN CHANGED AND THE ASSERTIONS FOLLOW IT.** The old board carried a per-row
   * Confirmed/Expected release breakdown; `CapacityScreen` carries a single "Freeing" cell, fed by
   * `networkWardRows(units, now, bedReleases)`. That cell renders `undefined` as the words "Not
   * tracked here" rather than a digit, so the sibling zero below is asserted as the honest `0` the
   * derivation actually returns — never as an absence, which would pass with the column dead.
   */
  /*
   * 🔴 **CARRIED HERE FROM `ward-capacity-view.dom.test.tsx` ON 2026-09-05, AND THE HOLE IT CLOSES
   * IS THE MOST SERIOUS FOUND IN THIS PASS.**
   *
   * That file pins what its own comment calls *"THE single most important rule in the phase: a
   * expected release must never soften Available now — a coordinator must always be able to point
   * at that number and say 'that is a bed I can fill this minute'."* It pinned it against
   * `<WardModeWorkspace mode="capacity" />`, which MERGE 02 replaced, so it has been passing over a
   * screen no coordinator can open.
   *
   * ⚠️ **MEASURED 2026-09-05: NOTHING IN THE REPOSITORY GUARDED THAT RULE ON ANY LIVE SCREEN.**
   * Mutating `ward-screen.tsx` to render `Ready {capacity.available - breakdown.expectedToday}` —
   * an expected discharge silently reducing the ward's ready-bed count — was run against all 41
   * test files that render `WardScreen` or touch `unitCapacity`/`capacityBreakdown`:
   * **714 passed, 1 expected fail, nothing red.** Source hash `d86f1549` before and after.
   *
   * ⚠️ **AND THE MUTATION WAS LIVE, WHICH IS THE HALF THAT IS EASY TO SKIP.** A mutation that
   * changes no rendered output is indistinguishable from one the assertions cannot detect, and it
   * invents a defect rather than missing one. Probed against the fixture: of the five units these
   * suites render, `bty-adult-secure` and `scgh-adult-open` both carry `ready=2, expectedToday=1`,
   * so both rendered `Ready 1` where they should read `Ready 2`. The figure moved on two screens
   * and not one assertion anywhere noticed.
   *
   * This is the ward's own screen, with the ward's own flagging control, so the whole rule is
   * exercised end to end: a real `FLAG_BED_RELEASE` from the form a ward actually uses.
   */
  it("never lets a expected release soften the Ready figure, while Expected itself moves by one", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
        <ReleaseFlagger unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const readyBefore = wardBedFigure("available", "Ready");
    const expectedBefore = wardBedFigure("expected", "Expected");
    /*
     * ⚠️ Floored, not assumed. If this ward had no ready bed, subtracting from the figure could
     * not change it and the assertion below would pass on the very defect it exists for.
     */
    expect(readyBefore, "this ward shows no ready bed, so nothing could be softened away").toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("test-flag-release"));

    /*
     * The dispatch really landed — Expected rose by exactly one — so the Ready assertion below
     * proves real separation between the two figures rather than merely that the click did nothing.
     */
    expect(wardBedFigure("expected", "Expected"), "the flag did not reach the reducer at all").toBe(expectedBefore + 1);

    expect(
      wardBedFigure("available", "Ready"),
      "a bed predicted to free later today has been subtracted from the beds this ward can fill NOW. " +
        "Ready is the number a coordinator commits a patient against; a discharge that has not happened " +
        "must never move it.",
    ).toBe(readyBefore);
  });

  it("never moves a sibling unit's own live capacity figures", () => {
    // Both surfaces share one provider instance, so a dispatch from the ward screen is read back
    // through the SAME live state the statewide capacity board reads — not a second, disconnected
    // copy that could never actually catch a unit-scoping bug.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
        <CapacityScreen />
        <ReleaseFlagger unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // sjgm-adult-open carries no bed release in the fixture at all — asserted directly against the
    // live capacity row rather than the static fixture constant, so a scoping bug in the reducer
    // (writing the flagged release to every unit, or to the wrong one) would be caught here even
    // though it could never show up in the frozen `bedReleases` array itself.
    /*
     * 🔴 **"none", NOT "0" — owner ruling 2026-09-06, census §8.** The claim is unchanged: this
     * sibling ward carries no bed release in the fixture, and a reducer that wrote the flagged
     * release to every unit would move this cell. Only the wording of a reported zero moved.
     */
    // The sibling's figure is read before the flag rather than assumed "none": the derived seed
    // decides what it starts at, and the claim is only that another ward's flag never moves it.
    const siblingBefore = freeingCell("sjgm-adult-open").textContent;
    const rphBefore = freeingCell("rph-adult-secure").textContent;

    // No blocker, for the reason the previous test's own comment gives: it keeps the moved figure
    // attributable to exactly one cause. A plain prediction moves a real, visible number.
    fireEvent.click(screen.getByTestId("test-flag-release"));

    /*
     * ⚠️ The acting ward's own figure MUST have moved, and that is asserted BEFORE the sibling is
     * checked. Without it, a change that killed the whole Freeing column would leave the sibling
     * reading 0 and this case green — proving scoping by proving nothing happened anywhere.
     */
    const rphAfter = freeingCell("rph-adult-secure").textContent;
    expect(rphAfter, "the flagging ward's own expected-to-free figure did not move at all").not.toBe(rphBefore);

    expect(
      freeingCell("sjgm-adult-open").textContent,
      "sjgm-adult-open flagged nothing; a release raised at another ward must not appear on its row",
    ).toBe(siblingBefore);
  });
});

/**
 * List 3 (2026-08-28): what a DISCHARGED bed is being made ready for. Until the owner supplied
 * `BED_PREPARATION_NOTES` this array was empty, so no picker shipped and nothing here could be
 * tested — the note existed as a field nobody could set.
 *
 * The second test in this block is the one that matters. **A bed being made ready must stay
 * offered, stay counted, and stay allocatable**, which is the owner's own clinical answer to Q4:
 * pulling the next patient takes hours anyway, so withholding the bed would invent a delay that
 * does not exist. It is proved through the LIVE screen rather than by calling `capacityBreakdown`
 * directly, because a gate added in the rendering layer would pass a pure-function test.
 */
describe("ward bed preparation note", () => {
  // CHANGED 25 September 2026: the seed's releases are derived from the ward's own stays, and the
  // one bed being cleaned is Armadale's, from the stay that left (AD-LEFT-01): the old WR-008's fact,
  // now on a named stay. Found by id at runtime rather than typed.
  const ARM_RELEASE =
    bedReleases.find((release) => release.unitId === "arm-adult-open" && release.state === "discharged")?.id ??
    "missing-arm-release";
  it("fixture assumption: arm-adult-open starts with exactly one released bed, already being made ready", () => {
    const released = bedReleases.filter(
      (release) => release.unitId === "arm-adult-open" && release.state === "discharged",
    );
    expect(released).toHaveLength(1);
    expect(released[0]?.preparing).toBe(true);
  });

  it("offers the owner-approved notes as a picker only — never free text — and shows the one already recorded", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="arm-adult-open" />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId(`ward-bed-preparation-note-${ARM_RELEASE}`)).toHaveTextContent("Being cleaned");

    fireEvent.click(screen.getByTestId(`ward-bed-preparation-toggle-${ARM_RELEASE}`));
    const form = screen.getByTestId(`ward-bed-preparation-form-${ARM_RELEASE}`);
    // Chosen, never typed — the same structural proof the flag form above uses.
    expect(within(form).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(form).queryAllByRole("combobox")).toHaveLength(1);

    const select = screen.getByLabelText("What this bed is waiting on");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent)
      .filter((text): text is string => text !== null && text !== "Choose what it is waiting on");
    // Verbatim, in the owner's own order. A length check would pass a silently reworded entry.
    expect(options).toEqual([...BED_PREPARATION_NOTES]);
  });

  /*
   * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05**, for the same reason as the sibling-scoping
   * case above: the mode this rendered is unreachable.
   *
   * **The owner's clinical answer to Q4 is what is guarded, and it is unchanged:** a bed being made
   * ready must stay offered, stay counted and stay allocatable, because pulling the next patient
   * takes hours anyway and withholding the bed would invent a delay that does not exist.
   *
   * ⚠️ **THE ASSERTION IS NOW SHARPER THAN A `textContent` COMPARISON, AND IT HAD TO BE.** On this
   * screen the Ready cell carries the ruling of 2026-09-05 — the figure, and BESIDE it the count
   * still being made ready. Comparing the cell's whole text would go red when that cleaning count
   * legitimately changed, which is the ruling working rather than a defect. So the READY FIGURE is
   * read apart from the note beside it, because the figure is what the owner ruled must not move.
   */
  it("never lets a preparation note change a bed figure — the bed stays offered on the ward screen AND on the capacity board", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="arm-adult-open" />
        <CapacityScreen />
      </WardFlowProvider>,
    );

    // Clear the flag first so `before` and `after` genuinely differ in the field under test. The
    // fixture already marks this bed as being made ready, and comparing "preparing" against
    // "preparing" would subtract the same bed from both sides of a gating implementation and pass
    // while proving nothing — the exact near-miss recorded in the bed-model rework report.
    fireEvent.click(screen.getByTestId(`ward-bed-preparation-finish-${ARM_RELEASE}`));
    /*
     * ⚠️ **THE READY FIGURE, NOT THE WHOLE GRID.** This compared `ward-unit-beds`.textContent before
     * and after, and went red on 2026-09-06 the moment the Ready chip began carrying the owner's
     * "N still being made ready" note beside its figure — because recording a preparation note is
     * exactly what makes that note appear. **The test was pinning the rendering; the claim is that
     * the FIGURE does not move.** A whole-grid comparison cannot tell the ruling working from the
     * defect it forbids, and the tempting repair — deleting the assertion — would have dropped the
     * owner's Q4 answer entirely.
     */
    const wardReadyFigure = () => wardBedFigure("available", "Ready");
    const wardBefore = wardReadyFigure();
    const readyBefore = readyFigure("arm-adult-open");
    // Non-vacuity: this unit really does have a bed to withhold, so a gating implementation had
    // somewhere to go wrong.
    expect(
      wardBefore,
      "this ward shows no ready bed, so a gating implementation had nowhere to go wrong",
    ).toBeGreaterThan(0);
    expect(readyBefore, "arm-adult-open shows no ready bed on the board, so nothing could be withheld").toMatch(
      /^[1-9]/u,
    );

    fireEvent.click(screen.getByTestId(`ward-bed-preparation-toggle-${ARM_RELEASE}`));
    fireEvent.change(screen.getByLabelText("What this bed is waiting on"), {
      target: { value: "Awaiting maintenance or repair" },
    });
    fireEvent.click(screen.getByTestId(`ward-bed-preparation-submit-${ARM_RELEASE}`));

    // The note really was recorded — otherwise the comparison below would be comparing a screen
    // against itself and would pass however the figures were computed.
    expect(screen.getByTestId(`ward-bed-preparation-note-${ARM_RELEASE}`)).toHaveTextContent("Awaiting maintenance or repair");
    expect(
      wardReadyFigure(),
      "recording a preparation note moved this ward's Ready figure. The owner ruled the bed stays " +
        "offered, stays counted and stays allocatable — the cleaning count sits BESIDE the number.",
    ).toBe(wardBefore);
    /*
     * And the other half of that ruling, which is new: the note must actually APPEAR. Without this,
     * a change that silently stopped rendering the cleaning count would leave the figure unmoved and
     * pass — proving the ruling's first half by discarding its second.
     */
    expect(
      screen.getByTestId("ward-unit-beds-pending"),
      "the ward recorded a preparation note and nothing on its own screen says a bed is being made ready",
    ).toBeInTheDocument();
    expect(
      readyFigure("arm-adult-open"),
      "a preparation note moved the board's Ready figure; the owner ruled that the number does not move",
    ).toBe(readyBefore);
  });
});
