import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

// Mirrors tests/ward-restriction-notice.test.ts's sibling dom suites (mode-nav.dom.test.tsx,
// ward-flow-clock-consistency.dom.test.tsx, ward-flow-queue-selection.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing itself, so a
// plain <a> avoids requiring an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { unitHasLockedBeds } from "@/components/ward-management/ward-bed-designation";
import { capacityBreakdown, releaseBand } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { bedReleases, leaveBeds, movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * CHANGED 25 September 2026: the seed's hand-written bed releases WR-001..WR-009 are gone —
 * `bedReleases` (`ward-movements.ts`) is now `derivedBedReleases(wardAdmissions, NOW_ANCHOR)`, one
 * `expected`/`confirmed` release per occupied admission carrying an `expectedDischargeAt`, plus
 * one `discharged` release per departed stay. Every test below that used to name a fixed WR id now
 * finds a release with the SAME property at runtime instead: an unblocked release, in the given
 * state, counted "today" by `releaseBand` (the same today/beyond-today split
 * `capacityBreakdown()` uses) so the chip figures it feeds actually move when acted on.
 *
 * `CONFIRMED_RELEASE` in particular is the seed's ONLY unblocked confirmed release counted today —
 * `ward-admissions-seed.ts` seeds it at `sjgs-adult-open` specifically, with the comment "a
 * confirmed discharge on a second site, so no board test can pass by looking at one ward". Its
 * seed-mate at `rph-adult-secure` (confirmedHoursAgo 4) is 3 days out and therefore excluded as
 * beyond-today, and the other confirmed occupant at rph-adult-secure is deliberately blocked.
 */
const EXPECTED_RELEASE = bedReleases.find(
  (release) =>
    release.state === "expected" && release.blocker === null && releaseBand(release, NOW_ANCHOR) !== "beyond-today",
);
const CONFIRMED_RELEASE = bedReleases.find(
  (release) =>
    release.state === "confirmed" && release.blocker === null && releaseBand(release, NOW_ANCHOR) !== "beyond-today",
);

/** Reads `rejections.length` from the live provider so a test can prove a dispatch was refused
 *  rather than inferring it from the DOM alone — the same technique the screen's own
 *  `priorRejectionCountRef` pattern uses, exposed here for the test to read directly. */
function ShowRejectionCount() {
  const { rejections } = useWardFlow();
  return <span data-testid="ward-rejection-count">{rejections.length}</span>;
}

function RequestBtyAdultSecureRefresh() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: "bty-adult-secure" })
      }
    >
      request bty-adult-secure refresh
    </button>
  );
}

/**
 * Addendum R38: the brief's own chosen unit (`bty-adult-secure`) can never exercise a
 * restriction notice — its one live referral, WF-017, is Involuntary/Secure, and
 * `restrictionNotice` returns undefined for that pair (both levels require either an
 * Open-security movement or a Voluntary one against a Secure unit). Proving the notice actually
 * renders on this screen needs a pair that genuinely produces one.
 *
 * WF-301 is that pair, already measured and pinned against the real fixture in
 * `tests/ui-ward-coordinator.spec.ts`'s "gives a voluntary patient on a locked ward its own, more
 * prominent notice on the diagram" test: WF-301 is a Voluntary movement whose cohort (Adult)
 * shortlists exactly the three Secure adult wards, `rph-adult-secure` among them — verified below
 * again, independently, against the real fixture rather than assumed, so this test fails loudly
 * rather than silently no-op'ing if the fixture ever changes underneath it.
 *
 * WF-301 sits at `placement_requested` at seed (no live referral yet — the generated fixture's
 * `security: "Secure"` and `stage` both derive from `index % 7`, so a generated Secure movement
 * is always seeded at `placement_requested`, never already referred). A real `REFER_TO_UNITS`
 * dispatch — not a hand-authored fixture edit — creates the live referral, exactly the same
 * "dispatch a real event from a sibling, then read the target component again" technique
 * `tests/ward-flow-queue-selection.dom.test.tsx` uses to prove state is derived, not cached.
 */
const WF_301 = movementById("WF-301");
const RPH_ADULT_SECURE = unitById("rph-adult-secure");

function ReferWF301ToRphAdultSecure() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "REFER_TO_UNITS",
          role: "coordinator",
          now,
          movementId: "WF-301",
          unitIds: ["rph-adult-secure"],
        })
      }
    >
      refer WF-301 to Ward 2K
    </button>
  );
}

describe("ward screen restriction notice", () => {
  it("fixture assumption: WF-301 is Voluntary and Ward 2K is Secure — the pair restrictionNotice flags", () => {
    // Guards the whole suite below: if either fact stops being true, every other assertion here
    // would either false-positive or silently stop covering the case it exists for.
    expect(WF_301?.legalStatus).toBe("Voluntary");
    expect(WF_301?.security).toBe("Secure");
    expect(RPH_ADULT_SECURE).toBeDefined();
    expect(unitHasLockedBeds(RPH_ADULT_SECURE!)).toBe(true);
  });

  it("renders the sharper voluntary-on-locked notice once this ward genuinely holds that referral", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferWF301ToRphAdultSecure />
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Before the referral: WF-301 does not yet hold a live referral anywhere, so RPH Adult
    // Secure's incoming list does not carry it.
    expect(screen.queryByTestId("ward-incoming-WF-301")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "refer WF-301 to Ward 2K" }));

    // After a real REFER_TO_UNITS dispatch, WF-301 is a live incoming referral at this unit —
    // derived fresh from the provider's own `movements`, not a locally cached list.
    const incoming = screen.getByTestId("ward-incoming-WF-301");
    expect(incoming).toBeInTheDocument();

    const notice = screen.getByTestId("ward-restriction-notice-WF-301");
    expectSays(notice.textContent ?? "", "the locked-ward legal-status warning", ["voluntary", "locked", "legal"]);
    // The sharper level, distinguished by its own data attribute — never wording alone.
    expect(notice).toHaveAttribute("data-level", "voluntary_on_locked");
  });

  it("names bty-adult-secure's unresolved id when the route carries one, never a substituted ward", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="does-not-exist-in-the-fixture" />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-unit-screen")).toHaveTextContent("does-not-exist-in-the-fixture");
    expect(screen.queryByTestId("ward-unit-beds")).not.toBeInTheDocument();
  });
});

function BlockConfirmedRelease({ releaseId, unitId }: { releaseId: string; unitId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "BLOCK_BED_RELEASE",
          role: "ward",
          now,
          releaseId,
          actingUnitId: unitId,
          blocker: "Awaiting clean",
        })
      }
    >
      block the confirmed release
    </button>
  );
}

function ConfirmRphAdultSecureCapacityAtZero() {
  const { dispatch, now, units } = useWardFlow();
  const observed = units.find((unit) => unit.id === "rph-adult-secure")!;
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "CONFIRM_CAPACITY",
          role: "ward",
          now,
          unitId: "rph-adult-secure",
          actingUnitId: "rph-adult-secure",
          expectedRevision: observed.allocatable.revision ?? 0,
          value: 0,
        })
      }
    >
      confirm rph-adult-secure capacity at zero
    </button>
  );
}

describe("ward screen live unit capacity", () => {
  it("resolves the unit from the provider's live units, not the frozen unitById() fixture", () => {
    // rph-adult-secure is seeded with allocatable.value 1 (pinned by
    // tests/ward-flow-reducer.test.ts's "writes the ward's restated allocatable count" case).
    const seededUnit = unitById("rph-adult-secure");
    expect(seededUnit?.allocatable.value).toBe(1);

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ConfirmRphAdultSecureCapacityAtZero />
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    expect(screen.getByRole("button", { name: "Staffing, 07:00–09:30" })).toHaveTextContent("1 allocatable");

    fireEvent.click(screen.getByRole("button", { name: "confirm rph-adult-secure capacity at zero" }));

    // After a real CONFIRM_CAPACITY dispatch updates state.units, the screen must show the new
    // live count — resolving from the frozen fixture would keep showing 1 forever.
    expect(screen.getByRole("button", { name: "Staffing, 07:00–09:30" })).toHaveTextContent("0 allocatable");
  });

  it("claims no roster figure it does not hold", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    expect(screen.queryByText(/Rostered Capacity/)).toBeNull();
    expect(screen.getByText("Roster not recorded")).toBeInTheDocument();
  });
});

/**
 * Visual-fix pass: this ward screen used to render a single "Potential" chip sourced from
 * `unitCapacity()`'s raw, state-and-timing-blind release count — the same unit's own bed release
 * could be explicitly listed as `Confirmed` in the "Bed releases" list below while this chip row
 * still called it `Potential`, contradicting both itself and the capacity board's own
 * Confirmed/Expected split one screen over. This suite pins the fix: the chip row must never
 * render the word "Potential" again, and must instead show the same Confirmed/Expected/Leave
 * figures `capacityBreakdown()` computes — the one the capacity board already uses.
 *
 * CHANGED 25 September 2026: rph-adult-secure's bed releases are no longer the single
 * hand-authored WR-001 — `bedReleases` (`ward-movements.ts`) is now `derivedBedReleases(
 * wardAdmissions, NOW_ANCHOR)`, one release per occupied admission with an
 * `expectedDischargeAt`, so this unit carries many. Rather than hand-count them (and go stale the
 * next time an admission in the seed changes), every figure below is read from
 * `capacityBreakdown()` itself — the same function `ward-screen.tsx` calls — so this suite keeps
 * checking what it always checked: that the row renders that function's own numbers, not a
 * diverging or hard-coded one.
 */
describe("ward screen bed capacity chip row uses the shared breakdown, not the raw potential count", () => {
  it("never renders 'Potential', and renders Confirmed/Expected/Leave from capacityBreakdown()", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const chipRow = screen.getByTestId("ward-unit-beds");

    // The defect this suite exists to catch: the word this screen used to show for a figure the
    // capacity board no longer calls "Potential" anywhere. A chip row that still said "Potential 1"
    // here — right next to the same release explicitly listed as "Confirmed" below — is exactly
    // the contradiction being fixed.
    expect(chipRow).not.toHaveTextContent("Potential");

    // The replacement figures, sourced from the same `capacityBreakdown()` the capacity board
    // reads, not re-derived by hand and not read from `unitCapacity()`.
    const breakdown = capacityBreakdown(unitById("rph-adult-secure")!, bedReleases, leaveBeds, NOW_ANCHOR);
    // Anti-vacuity: the old pin had non-zero figures (Confirmed 1, On leave 1); all-zero would let
    // a screen that renders nothing but zeros pass.
    expect(breakdown.confirmedToday + breakdown.expectedToday + breakdown.onLeave).toBeGreaterThan(0);
    expect(chipRow).toHaveTextContent(`Confirmed ${breakdown.confirmedToday}`);
    expect(chipRow).toHaveTextContent(`Expected ${breakdown.expectedToday}`);
    expect(chipRow).toHaveTextContent(`On leave ${breakdown.onLeave}`);

    // The four physical states, in the ruled vocabulary (`ward-bed-states.ts`): Ready · Pulled ·
    // Closed · Occupied. The two seeded pulls on this ward are their own box, out of Occupied, and
    // the empty bed the ward is not offering is Closed — "Held" now means only a leave bed. No
    // Blocked chip: out of service is not recorded (owner ruling 2026-09-25) and folds into Closed.
    expect(chipRow).toHaveTextContent("Ready 1");
    expect(chipRow).toHaveTextContent("Pulled 2");
    expect(chipRow).toHaveTextContent("Closed 1");
    expect(chipRow).toHaveTextContent("Occupied 16");
    expect(chipRow).not.toHaveTextContent("Held");
    expect(chipRow).not.toHaveTextContent("Blocked Not recorded");
  });

  /**
   * Bed-model rework (2026-08-28): the ward's own blocked-release figure, shown BESIDE Confirmed
   * and Expected rather than instead of either.
   *
   * The two words matter as much as the number. This chip row used to carry a "Blocked" chip
   * meaning physically blocked BEDS, so the new figure reads "Discharges held up" — two chips
   * reading the same word beside each other while meaning different things would be a defect, not
   * a tidy-up. The physical chip has since gone: out-of-service beds are not recorded (owner ruling
   * 2026-09-25) and fold into Closed, one of the ruled four (`ward-bed-states.ts`).
   */
  it("renders the blocked-release count beside Confirmed, worded so it cannot be read as the physical Blocked chip", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const chipRow = screen.getByTestId("ward-unit-beds");
    // CHANGED 25 September 2026: rph-adult-secure's releases are derived, and the seed's own
    // stuck-confirmed occupant (`ward-admissions-seed.ts`'s "CONFIRMED AND BLOCKED" comment)
    // already carries a non-zero blocked count here — read from `capacityBreakdown()` rather than
    // pinned to the old single-release fixture's 0.
    const breakdown = capacityBreakdown(unitById("rph-adult-secure")!, bedReleases, leaveBeds, NOW_ANCHOR);
    expect(chipRow).toHaveTextContent(`Confirmed ${breakdown.confirmedToday}`);
    expect(screen.getByTestId("ward-unit-blocked-releases")).toHaveTextContent(
      `Discharges held up ${breakdown.blockedToday}`,
    );
    // ...and no chip reads "Blocked" as a bed state beside it: the out-of-service box is gone and
    // the empty bed the ward is not offering is the separately worded Closed chip.
    expect(chipRow).not.toHaveTextContent(/\bBlocked\b/u);
    expect(chipRow).toHaveTextContent("Closed");
  });

  /**
   * The same unit's figures after the ward reports that a confirmed discharge stuck — the exact
   * journey the rework exists for, at the screen a ward actually looks at. Confirmed must NOT
   * fall; before the rework it fell to 0 here, so the ward's screen looked better at the moment
   * its bed became harder to free.
   *
   * CHANGED 25 September 2026: WR-001 is gone. `CONFIRMED_RELEASE` (found below, module scope) is
   * the seed's only unblocked confirmed release counted today — deliberately seeded "on a second
   * site, so no board test can pass by looking at one ward" (`ward-admissions-seed.ts`). Reading
   * the unit's own chip figures before and after blocking it, rather than pinning a number, is
   * what proves this property without going stale the next time an admission changes.
   */
  it("keeps Confirmed unchanged when the ward blocks its confirmed release, and raises Discharges held up by one", () => {
    const unit = unitById(CONFIRMED_RELEASE!.unitId)!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BlockConfirmedRelease releaseId={CONFIRMED_RELEASE!.id} unitId={unit.id} />
        <WardScreen unitId={unit.id} />
      </WardFlowProvider>,
    );

    const before = capacityBreakdown(unit, bedReleases, leaveBeds, NOW_ANCHOR);

    fireEvent.click(screen.getByRole("button", { name: "block the confirmed release" }));

    const chipRow = screen.getByTestId("ward-unit-beds");
    expect(chipRow).toHaveTextContent(`Confirmed ${before.confirmedToday}`);
    expect(screen.getByTestId("ward-unit-blocked-releases")).toHaveTextContent(
      `Discharges held up ${before.blockedToday + 1}`,
    );
    const row = screen.getByTestId(`ward-barrier-${CONFIRMED_RELEASE!.id}`);
    expect(row).toHaveTextContent("Confirmed");
    expect(row).toHaveTextContent("Blocked");
    expect(row).toHaveTextContent("Awaiting clean");
  });
});

/**
 * Task 5 (spec D10/D12): the ward's own bed-release controls, and the refresh-requested mark.
 * All cases render a fresh `WardFlowProvider` each time, so each starts from the real seed
 * fixture (`ward-movements.ts`'s `bedReleases`) untouched by any other test in this file.
 *
 * CHANGED 25 September 2026: the seed's hand-written WR-001..WR-009 are gone. `bedReleases` is
 * now `derivedBedReleases(wardAdmissions, NOW_ANCHOR)` — one `expected`/`confirmed` release per
 * occupied admission that carries an `expectedDischargeAt`, id `derived-<state>-<admissionId>`.
 * `EXPECTED_RELEASE` and `CONFIRMED_RELEASE` (module scope, above) are found at runtime by the
 * same properties this suite needs — unblocked, and counted "today" by `releaseBand` — rather
 * than by a hard-coded id that no longer resolves to anything. Both are asserted directly below
 * so this suite fails loudly, not silently, if the fixture ever changes under it (the same
 * discipline the restriction-notice suite above already uses for WF-301).
 */
describe("ward screen bed release controls", () => {
  it("fixture assumption: the seed derives an unblocked expected release and an unblocked confirmed release, both counted today", () => {
    expect(EXPECTED_RELEASE, "no unblocked expected release counted today exists in the derived seed").toBeDefined();
    expect(EXPECTED_RELEASE?.state).toBe("expected");
    expect(EXPECTED_RELEASE?.blocker).toBeNull();
    expect(CONFIRMED_RELEASE, "no unblocked confirmed release counted today exists in the derived seed").toBeDefined();
    expect(CONFIRMED_RELEASE?.state).toBe("confirmed");
    expect(CONFIRMED_RELEASE?.blocker).toBeNull();
  });

  it("renders the bed release state as a sentence-case display label, never the raw lowercase union value", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={EXPECTED_RELEASE!.unitId} />
      </WardFlowProvider>,
    );

    // EXPECTED_RELEASE is `expected` in the fixture (asserted above). The screen must show the
    // display label "Expected", never the raw union value "expected" — a coordinator reading this
    // row sees the same sentence-case convention every other status label on this screen uses.
    const row = screen.getByTestId(`ward-today-release-${EXPECTED_RELEASE!.id}`);
    expect(row).toHaveTextContent("Expected");
    expect(row).not.toHaveTextContent(/\bexpected\b/);
  });

  it("confirming a expected release updates the row", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={EXPECTED_RELEASE!.unitId} />
      </WardFlowProvider>,
    );

    const row = screen.getByTestId(`ward-today-release-${EXPECTED_RELEASE!.id}`);
    expect(row).toHaveTextContent("Expected");

    fireEvent.click(within(row).getByRole("button", { name: "Confirm Ready" }));

    const confirmed = screen.getByTestId(`ward-today-release-${EXPECTED_RELEASE!.id}`);
    expect(confirmed).toHaveTextContent("Confirmed");
    expect(within(confirmed).queryByRole("button", { name: "Confirm Ready" })).not.toBeInTheDocument();
  });

  it("blocking asks for a reason and refuses without one", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={EXPECTED_RELEASE!.unitId} />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId(`ward-bed-release-block-toggle-${EXPECTED_RELEASE!.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`ward-today-release-${EXPECTED_RELEASE!.id}`)).toHaveTextContent("Expected");
    expect(screen.queryByTestId(`ward-barrier-${EXPECTED_RELEASE!.id}`)).not.toBeInTheDocument();
  });

  /**
   * CHANGED 26 September 2026 (Josh, answer 1A): "Discharged" asks where the named person is going
   * and records that they have left, which completes the release. The old claim is kept: once the
   * release completes it leaves the pending list. Nothing is recorded before a destination is chosen.
   */
  it("pressing Discharged asks where the person is going, records nothing until chosen, then the release leaves the pending list", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ShowRejectionCount />
        <WardScreen unitId={EXPECTED_RELEASE!.unitId} />
      </WardFlowProvider>,
    );

    const before = Number(screen.getByTestId("ward-rejection-count").textContent);
    expect(screen.getByTestId(`ward-today-release-${EXPECTED_RELEASE!.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`ward-bed-release-release-${EXPECTED_RELEASE!.id}`)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discharged" })).not.toBeInTheDocument();
    expect(Number(screen.getByTestId("ward-rejection-count").textContent)).toBe(before);
  });

  it("a refresh request raised by a coordinator appears on this ward's screen as a visible mark naming the time and role", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RequestBtyAdultSecureRefresh />
        <WardScreen unitId="bty-adult-secure" />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-refresh-request-mark")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "request bty-adult-secure refresh" }));

    const mark = screen.getByTestId("ward-refresh-request-mark");
    // NOW_ANCHOR is 10:42 (ward-sites.ts) and REQUEST_CAPACITY_REFRESH is coordinator-only
    // (ward-flow-events.ts's EVENT_ROLE), so the recorded role is always literally "coordinator".
    expect(mark).toHaveTextContent("10:42");
    expect(mark).toHaveTextContent("coordinator");
  });

  // CHANGED 25 September 2026: a leave bed names the stay it belongs to (owner ruling), and this
  // form has no patient picker yet, so recording is refused with a plain message, as the bed-release
  // form's is. The seed now puts WL-002 (a named patient) on scgh-adult-open, so ending that real
  // leave is what exercises the removal and the count. When the picker lands, restore the record
  // half: choose the patient, submit, and the row and count appear.
  it("refuses to record leave with no patient chosen, and ending the ward's leave removes it and drops the count", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="scgh-adult-open" />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-leave-bed-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-leave-bed-usable")).toBeNull();
    expect(screen.getByTestId("ward-unit-beds")).toHaveTextContent("On leave 1");

    fireEvent.click(screen.getByRole("button", { name: "Ended" }));

    expect(screen.getByText("No leave bed is recorded at Mental Health Unit.")).toBeInTheDocument();
    expect(screen.getByTestId("ward-unit-beds")).toHaveTextContent("On leave 0");
  });

  it("records a bed on leave when an admitted patient is chosen and increments the on-leave count", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="scgh-adult-open" />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-leave-bed-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-leave-bed-patient")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Bed on leave/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-unit-beds")).toHaveTextContent("On leave 1");
  });
});

describe("ward screen incoming patient arrival confirmation", () => {
  it("renders a Confirm Arrival button only for an incoming patient with collected transport and confirms arrival on click", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // WF-003 is accepted_awaiting_bed, so it must not render a Confirm Arrival button
    expect(screen.queryByTestId("ward-confirm-arrival-WF-003")).not.toBeInTheDocument();

    // WF-014 is seeded at rph-adult-secure with stage: "moving" and transport collected
    const arrivalBtn = screen.getByTestId("ward-confirm-arrival-WF-014");
    expect(arrivalBtn).toBeInTheDocument();
    expect(arrivalBtn).toHaveTextContent("Confirm Arrival");
    expect(arrivalBtn).not.toHaveAttribute("aria-disabled");

    fireEvent.click(arrivalBtn);

    // After arrival, WF-014 closes and is no longer in the "Coming in" list
    expect(screen.queryByTestId("ward-confirm-arrival-WF-014")).not.toBeInTheDocument();
  });
});
