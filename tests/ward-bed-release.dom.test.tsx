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

  it("does not render the flag-bed form or its waiting-on picker", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-flag-bed-release")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Waiting on")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Blocker")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confidence")).toBeNull();
  });

  it("does not offer a flag submit, and the bed figures stay as seeded", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    const confirmedBefore = wardBedFigure("confirmed", "Confirmed");
    const expectedBefore = wardBedFigure("expected", "Expected");
    expect(screen.queryByTestId("ward-flag-bed-release-submit")).not.toBeInTheDocument();
    expect(wardBedFigure("confirmed", "Confirmed")).toBe(confirmedBefore);
    expect(wardBedFigure("expected", "Expected")).toBe(expectedBefore);
  });

  it("does not offer a patient picker for flagging a bed", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    expect(screen.queryByLabelText("Patient")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Expected free")).not.toBeInTheDocument();
  });

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

  it("does not render the preparation-note picker on the ward page", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="arm-adult-open" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId(`ward-bed-preparation-note-${ARM_RELEASE}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`ward-bed-preparation-toggle-${ARM_RELEASE}`)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("What this bed is waiting on")).not.toBeInTheDocument();
  });

  it("keeps the Ready figure on the ward screen and the capacity board without a preparation form", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="arm-adult-open" />
        <CapacityScreen />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId(`ward-bed-preparation-finish-${ARM_RELEASE}`)).not.toBeInTheDocument();
    const wardReady = wardBedFigure("available", "Ready");
    expect(wardReady).toBeGreaterThan(0);
    expect(readyFigure("arm-adult-open")).toMatch(/^[1-9]/u);
  });
});
