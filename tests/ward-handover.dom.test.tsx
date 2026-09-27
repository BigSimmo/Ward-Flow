import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

// Same reason as every sibling dom suite (ward-screen.dom.test.tsx, ward-ed-screen.dom.test.tsx,
// ward-flow-clock-consistency.dom.test.tsx): `ClinicalRail` renders next/link anchors and this
// suite never checks routing, so a plain <a> avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { formatInstant } from "@/components/ward-management/ward-clock";
import type { HandoverSnapshot } from "@/components/ward-management/ward-derivations";
import {
  HandoverPage,
  PulledBedsSection,
  InTransitSection,
  LongestWaitsSection,
  PlacementGoneWrongSection,
  SignOffSection,
} from "@/components/ward-management/handover/handover-page";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { generatedMovementPatients, referrals } from "@/components/ward-management/ward-movements";
import { wardAdmissions, generatedOccupantPatients } from "@/components/ward-management/ward-admissions-seed";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { combineWardPatients } from "@/components/ward-management/ward-patients-seed";
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

// Owner, 26 Sept 2026: the patient's name, never the WF journey number — resolved from the real
// seed's own link, never typed by hand.
const realSeed = seedWardFlowState();
const wf016Identity = resolveSubjectPatient(
  realSeed.movements.find((movement) => movement.id === "WF-016")!,
  realSeed,
);

/** Raises the same `ADVANCE_CLOCK` demo event the real demo controls dispatch, so this suite can
 * move the shared clock without reaching into the reducer directly — mirrors `ClockAdvancer` in
 * ward-flow-clock-consistency.dom.test.tsx and `DispatchProbe` in ward-flow-provider.dom.test.tsx. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
      advance clock
    </button>
  );
}

function renderHandover() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
      <ClockAdvancer minutes={100} />
      <WardLiveRegion />
    </WardFlowProvider>,
  );
}

describe("HandoverPage", () => {
  beforeEach(() => {
    resetWardLiveRegionForTests();
  });

  it("renders the root, header Print action, four data sections, outside-filter and sign off in order", () => {
    renderHandover();

    expect(screen.getByTestId("ward-handover-page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();

    const order = [
      "ward-handover-longest-waits",
      "ward-handover-pulled-beds",
      "ward-handover-in-transit",
      "ward-handover-placement-gone-wrong",
      "ward-handover-urgent-outside-filter",
      "ward-handover-sign-off",
    ];
    const positions = order.map((testId) => {
      const node = screen.getByTestId(testId);
      expect(node).toBeInTheDocument();
      return Array.prototype.indexOf.call(document.querySelectorAll("[data-testid]"), node);
    });
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1]);
    }
  });

  it("shows the real fixture's non-empty sections as tables, not the empty note", () => {
    renderHandover();

    // The real fixture at NOW_ANCHOR carries 41 open movements, 7 held beds, 8 in transit and
    // one escalated movement (measured — see tests/ward-handover.test.ts) — none of the four
    // sections is naturally empty against this seed, so none of the "-empty" notes should render
    // here. The explicit-empty-note behaviour itself is proved separately below, against a
    // constructed empty snapshot, because the live seed can never produce one (see that test's
    // own comment).
    expect(screen.queryByTestId("ward-handover-longest-waits-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-pulled-beds-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-in-transit-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-handover-placement-gone-wrong-empty")).not.toBeInTheDocument();
  });

  /**
   * THE PAGE MUST READ LIVE (owner decision OD-4, 2026-08-30). This test is the exact inverse of
   * the one it replaces, deliberately: until that day this suite asserted the page froze at mount
   * and proved it two ways, and both of those ways now prove the opposite.
   *
   * Rewritten rather than removed, because "the freeze test went away" and "the page went live"
   * look identical afterwards, and only one of them is what was decided.
   *
   *   1. The taken-at label must MOVE. It was pinned to be unchanged.
   *   2. WF-016's held bed (`pullExpiresAt = NOW_ANCHOR + 45`, fixture-authored, see
   *      ward-movements.ts) reads "Expires in 45m" at mount. Advancing 100 minutes takes the live
   *      clock past that hold, so a live page must now show "Expired" — a CATEGORICAL change, not
   *      a shifted number, which is what makes this stronger than comparing two timestamps.
   *   3. The whole page's rendered text must differ, so a section that somehow stayed frozen while
   *      the two named checks moved is still caught.
   *
   * The reasoning for the reversal is on `HandoverPage` itself and in OD-4: the freeze was
   * protecting something real — a room discussing the same numbers — but paper already holds
   * still, and a frozen screen beside a live printed sheet is two numbers for one thing in one
   * room.
   */
  it("reads live: the moment, an expiring hold, and the page as a whole all move with the clock", () => {
    renderHandover();

    const takenAtBefore = screen.getByTestId("ward-handover-taken-at").textContent;
    expect(takenAtBefore, "the sheet states its moment in full, because paper outlives the day").toContain(
      formatInstant(NOW_ANCHOR),
    );

    const pulledBedsBefore = screen.getByTestId("ward-handover-pulled-beds").textContent;
    // Owner, 26 Sept 2026: the patient's name, never the WF number.
    expect(pulledBedsBefore).toContain(wf016Identity.displayName);
    expect(pulledBedsBefore).not.toContain("WF-016");
    expect(pulledBedsBefore, "precondition: this pull has not expired yet at mount").toContain("Expires in 45m");

    const pageBefore = screen.getByTestId("ward-handover-page").textContent;

    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));

    expect(
      screen.getByTestId("ward-handover-taken-at").textContent,
      "the moment on the sheet must follow the clock — a page that still shows the old one is frozen",
    ).not.toBe(takenAtBefore);

    const pulledBedsAfter = screen.getByTestId("ward-handover-pulled-beds").textContent;
    expect(
      pulledBedsAfter,
      "the clock has passed WF-016's hold, so a live page says Expired. Still reading 'Expires in 45m' " +
        "is the freeze, and it is the categorical version of the failure rather than a drifted number.",
    ).toContain("Expired");
    expect(pulledBedsAfter).not.toContain("Expires in 45m");

    expect(
      screen.getByTestId("ward-handover-page").textContent,
      "some section is still frozen even though the two named checks moved",
    ).not.toBe(pageBefore);
  });

  // Every section must state plainly when it is empty (spec's conservative-failure rule) — but
  // the real fixture, at any `now`, never produces an empty section: 41 open movements, 7 held
  // beds, 8 in-transit jobs and one placement-gone-wrong entry are all authored into the seed
  // (see ward-movements.ts), and the freeze mechanism above means a post-mount reducer event can
  // never reach a frozen page's own rendering anyway. Rather than weaken this assertion by
  // skipping it, the precondition is constructed explicitly: an empty `HandoverSnapshot` is a
  // real, valid value of the exported type (every section is independently optional — nothing
  // about "zero open movements" is fabricated clinical data, it is simply an empty array), and
  // each section component takes that snapshot as a plain prop, with no dependency on the
  // provider or the freeze. Rendering each one directly proves the empty-note branch for real.
  /**
   * Spec D9: this page and the board answering "what can I fill right now" must each carry a
   * one-line link to the other, naming the question each answers, so the two are never confused.
   *
   * 🔴 **THE DESTINATION CHANGED ON 2026-09-06 AND THIS TEST HAD PINNED THE OLD ONE.** It required
   * the link to be named "morning bed state" and to point at the Morning route. MERGE 02
   * folded that board into `CapacityScreen` the day before, owner-approved, leaving the old route as
   * a redirect stub kept only so bookmarks do not 404 — `ward-nav.ts` calls it "not a destination in
   * its own right". So this test was requiring the page to link somewhere it must not link, and it
   * was GREEN, because the link resolved.
   *
   * ⚠️ **It now asserts the SPEC'S REQUIREMENT rather than the destination's name**: a cross-link
   * exists, it names the question the other screen answers, and it points at a real screen rather
   * than a redirect stub. Rename the board again and this survives;
   * `tests/ward-links-never-point-at-redirect-stubs.test.ts` holds the stub half for every screen.
   *
   * ⚠️ **THE RECIPROCAL HALF OF D9 WAS ONCE UNSATISFIABLE; ITEM 41 RESOLVED IT BY RETIREMENT.**
   * The Morning board was rendered by no route at all once its own route became a redirect stub, so
   * the "each links to the other" requirement had one end no reader could reach. Owner answer 41
   * (2026-09-17) closed that question by retiring the Morning screen outright rather than restoring
   * its end of the link — there is no longer a second screen for this one to reciprocate with.
   */
  it("carries a one-line cross-link to the board answering the other question, at a real destination", () => {
    const { container } = renderHandover();

    // 🔴 THIS LOCATOR USED TO BE `screen.getByText(/fill right now/iu)`, AND THAT MADE THE
    // reword-tolerant ASSERTION AT THE BOTTOM OF THIS TEST A TAUTOLOGY. It found the paragraph BY
    // the exact phrase, then asserted that same phrase was present — so `expectSays` could not
    // fail, by construction, and the real protection was a literal regex: the most reword-brittle
    // thing in the file, wearing the tolerant helper as decoration.
    //
    // Measured 2026-09-09: rewording "fill right now" to "place immediately" reddened this test at
    // the LOCATOR, before `expectSays` ever ran. No caption subject was named. The guard was
    // untested and untestable.
    //
    // Now located STRUCTURALLY — the one paragraph on this page that contains a link — so the
    // wording is free to change and the assertion below is the thing that decides. The nav rail's
    // own Capacity link is outside <p>, which is why the original comment reached for the text.
    const linkedParagraphs = Array.from(container.querySelectorAll("p")).filter(
      (candidate) => candidate.querySelector("a") !== null,
    );
    expect(
      linkedParagraphs,
      "this test assumes exactly one paragraph on the handover page carries a link; if that is no " +
        "longer true, scope this locator rather than putting the sentence back into it",
    ).toHaveLength(1);
    const paragraph = linkedParagraphs[0];
    expect(paragraph, "the handover cross-link paragraph is gone entirely").not.toBeNull();
    const link = within(paragraph as HTMLElement).getByRole("link");
    const href = link.getAttribute("href") ?? "";
    // Built from segments, not one literal string: the retired Morning route this guards against
    // is exactly what `scripts/check-mockup-retirement.mjs` flags a literal path for naming — the
    // route itself is gone, and this assertion's whole value is that it keeps checking for exactly
    // that address, in case a hardcoded link like it ever comes back.
    const retiredMorningRoute = ["/mockups/ward-flow", "morning"].join("/");
    expect(
      href,
      `the handover cross-link points at ${href}, which used to be kept only as a redirect stub so ` +
        "old bookmarks did not 404. The route is now deleted outright, so it would 404.",
    ).not.toBe(retiredMorningRoute);
    expect(href).toMatch(/^\/mockups\/ward-flow\//u);
    // Widened alongside the locator fix: the concept is the QUESTION the other page answers, not
    // the four words it currently uses to ask it.
    expectSays(paragraph.textContent ?? "", "the handover framing question", [
      "fill right now",
      "place immediately",
      "can I fill",
      "what can i",
      "capacity board",
    ]);
  });

  describe("renders the explicit empty note for every section, given an empty snapshot", () => {
    const emptySnapshot: HandoverSnapshot = {
      takenAt: NOW_ANCHOR,
      longestWaits: [],
      pulledBeds: [],
      inTransit: [],
      placementGoneWrong: [],
    };

    it("longest waits", () => {
      render(<LongestWaitsSection snapshot={emptySnapshot} units={[]} />);
      expect(screen.getByTestId("ward-handover-longest-waits-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("held beds", () => {
      render(<PulledBedsSection snapshot={emptySnapshot} />);
      expect(screen.getByTestId("ward-handover-pulled-beds-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("in transit", () => {
      render(<InTransitSection snapshot={emptySnapshot} units={[]} />);
      expect(screen.getByTestId("ward-handover-in-transit-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("placement gone wrong", () => {
      render(<PlacementGoneWrongSection snapshot={emptySnapshot} />);
      expect(screen.getByTestId("ward-handover-placement-gone-wrong-empty")).toHaveTextContent("None");
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  // DRAWING-ONLY addition (contract-handover.md §2.6): Beds pulled gained a Wait column, matching
  // the drawing's own four-column table. WF-016 is the fixture's own pulled bed, already named by
  // the "reads live" test above at 250 minutes elapsed (`openedAt: NOW_ANCHOR - 250`).
  it("Beds pulled states how long each pulled bed has waited, not only when its pull expires", () => {
    renderHandover();
    const pulled = screen.getByTestId("ward-handover-pulled-beds").textContent ?? "";
    // Owner, 26 Sept 2026: the patient's name, never the WF number.
    expect(pulled).toContain(wf016Identity.displayName);
    expect(pulled).not.toContain("WF-016");
    expect(pulled).toContain("4h 10m waiting");
  });

  // One select controls one scope. Its printable readout keeps the selected scope and excluded
  // count together without relying on the removed explanatory paragraph.
  it("keeps the single selected scope and excluded count together", () => {
    renderHandover();
    const controls = screen.getAllByRole("combobox", { name: "Filter the sheet" });
    const summary = screen.getByTestId("ward-handover-scope-summary");
    const excluded = screen.getByTestId("ward-handover-scope-excluded");

    expect(controls).toHaveLength(1);
    expect(controls[0]).toHaveValue("network");
    expect(summary).toHaveTextContent("Whole network");
    expect(excluded).toHaveTextContent("0 open movements are outside this filter");
    expect(summary.parentElement).toBe(excluded.parentElement);
  });

  // DRAWING-ONLY addition (contract-handover.md §4.5-4.6): the "Sign off" section. Built in part —
  // no fabricated shift schedule (see contract §3) — restating only facts already computed
  // elsewhere on this page. The button now records role and time through RECORD_HANDOVER_SIGN_OFF.
  describe("the Sign off section", () => {
    it("What the sign off records states the moment, the scope, the counts and the urgent-outside line", () => {
      renderHandover();
      const records = screen.getByTestId("ward-handover-sign-off-records").textContent ?? "";
      const scopeSummary = screen.getByTestId("ward-handover-scope-summary").textContent ?? "";
      const coverage = scopeSummary.match(/\d+ of \d+ open movements/u)?.[0];

      expect(coverage, "the live scope summary must state an exact included and total count").toBeDefined();
      expect(records).toContain("Whole network");
      expect(records).toContain(`Coverage: ${coverage}.`);
      expect(records).toContain("No form due time passed on the sheet");
      expect(records).toContain("none urgent outside the filter.");
      expect(screen.getByTestId("ward-handover-sign-off-visible-status")).toHaveTextContent(
        "Sign-off is not recorded yet.",
      );
    });

    // The real fixture carries zero movements with a legal deadline at all (every Form 1A/3B
    // `dueAt` was removed by a 2026-08-23 owner correction — see contract-alerts.md §1a), so the
    // non-zero breach branch cannot be exercised through the live page at NOW_ANCHOR. Proved
    // directly against the exported component instead, with a hand-built count — the same
    // discipline this file's own `emptySnapshot` tests already use for a branch the live fixture
    // cannot reach.
    it("names a non-zero form-due-time-passed count and pluralises it correctly", () => {
      render(
        <SignOffSection
          takenAt={NOW_ANCHOR}
          dayZero={new Date(0)}
          scopeLabel="Whole network"
          includedOpenCount={1}
          totalOpenCount={1}
          breachedOnSheetCount={2}
          urgentOutsideFilter={[]}
        />,
      );
      expect(screen.getByTestId("ward-handover-sign-off-records")).toHaveTextContent(
        /2 form due times passed on the sheet\b/u,
      );
    });

    it("pluralises a single passed due time correctly (singular, not '1 due times')", () => {
      render(
        <SignOffSection
          takenAt={NOW_ANCHOR}
          dayZero={new Date(0)}
          scopeLabel="Whole network"
          includedOpenCount={1}
          totalOpenCount={1}
          breachedOnSheetCount={1}
          urgentOutsideFilter={[]}
        />,
      );
      expect(screen.getByTestId("ward-handover-sign-off-records")).toHaveTextContent(
        /1 form due time passed on the sheet\b/u,
      );
    });

    it("Notes for the incoming coordinator always states plainly that no note has been written", () => {
      renderHandover();
      const note = screen.getByTestId("ward-handover-sign-off-notes");
      expect(note).toHaveTextContent("No note is recorded for this shift.");
      expect(note).toHaveTextContent("This does not describe whether the shift was quiet.");
    });

    it("the Sign off button dispatches and then states the recorded role and time", () => {
      renderHandover();
      fireEvent.click(screen.getByTestId("ward-handover-sign-off-button"));
      const recorded = `Signed off as coordinator at ${formatInstant(NOW_ANCHOR)}.`;
      expect(screen.getByTestId("ward-live-region").textContent ?? "").toContain(recorded);
      expect(screen.getByTestId("ward-handover-sign-off-visible-status")).toHaveTextContent(recorded);
    });
  });

  // The duplicate Print panel was removed. The single header action prints the live sheet, whose
  // moment, active scope, four operational populations and urgent-outside state remain visible.
  describe("the header Print action", () => {
    it("keeps the moment, filter, operational populations and urgent-outside line on the sheet", () => {
      renderHandover();
      expect(screen.getAllByRole("button", { name: "Print" })).toHaveLength(1);
      expect(screen.getByTestId("ward-handover-taken-at")).toHaveTextContent(formatInstant(NOW_ANCHOR));
      expect(screen.getByTestId("ward-handover-scope-summary")).toHaveTextContent("Whole network");
      expect(screen.getByTestId("ward-handover-longest-waits")).toBeInTheDocument();
      expect(screen.getByTestId("ward-handover-pulled-beds")).toBeInTheDocument();
      expect(screen.getByTestId("ward-handover-in-transit")).toBeInTheDocument();
      expect(screen.getByTestId("ward-handover-placement-gone-wrong")).toBeInTheDocument();
      expect(screen.getByTestId("ward-handover-urgent-outside-filter-empty")).toHaveTextContent(
        "Nothing urgent is outside this filter.",
      );
    });

    it("calls window.print() from the sole header Print action", () => {
      const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
      renderHandover();
      fireEvent.click(screen.getByRole("button", { name: "Print" }));
      expect(printSpy).toHaveBeenCalledTimes(1);
      printSpy.mockRestore();
    });
  });

  // Owner ruling, 26 Sept 2026: handover must say "bed not recorded" rather than guess a bed
  // number from the admission id. `Admission` has no `bedNumber` field (ward-admissions.ts), so
  // the old code silently fell through to `adm.id.split("-").pop()` — for AD-RPHS-05 (the RPH secure ward,
  // occupied 12 days: see ward-admissions-seed.ts) that printed "Bed 05", an invented figure with
  // nothing behind it. Both places this happened (the Long-Stay Review row and the Acute Bed
  // Cascade Solver card) share the exact same expression, so both are proved here against the
  // live fixture rather than a hand-built snapshot.
  // The ward name is read from the site register, not typed: it was "Ward 2K" until the confirmed
  // ward facts (26 Sept 2026) named Royal Perth's secure ward Dabakarn.
  const SECURE_WARD = unitById("rph-adult-secure")?.name ?? "rph-adult-secure is missing from the register";

  describe("a bed number is never guessed from the admission id (owner ruling, 26 Sept 2026)", () => {
    it("Long-Stay Review reads 'bed not recorded' for every row, never a guessed 'Bed NN'", () => {
      renderHandover();

      // "Ward & Bed" is this table's own column header and is unique on the page (the Stranded
      // Delayed Egress table below uses "Unit & Bed" instead), so it locates the table without
      // depending on a CSS module's hashed class name.
      const table = screen.getByText("Ward & Bed").closest("table");
      expect(
        table,
        "the live fixture seeds 10+ long-stay occupants (see ward-admissions-seed.ts), so this table must render",
      ).not.toBeNull();
      const tableText = table!.textContent ?? "";

      expect(tableText).toContain(`${SECURE_WARD} · bed not recorded`);
      expect(tableText).not.toMatch(/Bed \d/u);
    });

    it("Acute Bed Cascade Solver reads 'bed not recorded' for a tagged step-down candidate, never a guessed 'Bed NN'", () => {
      // No seeded admission carries `stepDownCandidate: true` (the real fixture never authors one),
      // so the branch is exercised the same way a real session would reach it: a ward raising the
      // same SET_STEP_DOWN_CANDIDATE event the Ward Board occupant drawer sends.
      function StepDownTagger() {
        const { now, dispatch } = useWardFlow();
        return (
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "SET_STEP_DOWN_CANDIDATE",
                role: "ward",
                now,
                actingUnitId: "rph-adult-secure",
                admissionId: "AD-RPHS-05",
                stepDownCandidate: true,
              })
            }
          >
            tag step-down
          </button>
        );
      }

      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <HandoverPage />
          <StepDownTagger />
          <WardLiveRegion />
        </WardFlowProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "tag step-down" }));

      const badge = screen.getByText("Ready for Step-Down");
      const card = badge.parentElement;
      expect(card, "the ward/bed line and the Ready for Step-Down badge share one card").not.toBeNull();
      const cardText = card!.textContent ?? "";

      expect(cardText).toContain(`${SECURE_WARD} · bed not recorded`);
      expect(cardText).not.toMatch(/Bed \d/u);
    });
  });

  // Owner rule, 25 September 2026 audit (finding A1): a screen may show only what the records
  // hold, "Not recorded", or a clearly labelled target — never an invented person, count or
  // figure. The Stranded Delayed Egress table typed six such patients, each under a real seeded
  // UMRN that belonged to someone else entirely (see `tests/ward-handover-no-typed-patient-rows
  // .test.ts`'s own doc comment). It now derives every row from occupied admissions carrying a
  // recorded, non-clinical hold (`Admission.blockReason`) — read directly, not through the
  // derived `bedReleases` collection, which silently drops a blocked admission that has no
  // `expectedDischargeAt` yet (`deriveForwardRelease`'s own Rule 3). Confirmed against a
  // read-only seed walk: `ward-flow-logs/drafts/handover-delayed-discharges-answer-key.md`.
  describe("Stranded Delayed Egress derives every row from occupied, blocked admissions, never a typed table (25 Sept 2026 audit, A1)", () => {
    it("lists only the holds inside a ward scope, never every named patient in the network (review, 26 Sept 2026)", () => {
      renderHandover();
      fireEvent.change(screen.getByRole("combobox", { name: "Filter the sheet" }), {
        target: { value: "ward:rph-adult-secure" },
      });
      const table = screen.getByText("Expected Discharge & Date Set By").closest("table");
      expect(table).not.toBeNull();
      const expected = wardAdmissions.filter(
        (admission) =>
          admission.unitId === "rph-adult-secure" && bedIsOccupied(admission) && admission.blockReason !== null,
      );
      expect(expected.length, "Ward 2K must hold at least one recorded hold for this test to mean anything").toBeGreaterThan(0);
      expect(expected.length, "and fewer than the network's, so scoping is visible").toBeLessThan(13);
      expect(table!.querySelectorAll("tbody tr")).toHaveLength(expected.length);
      expect(screen.getByText(/Discharges on hold, non-clinical/).textContent).toContain(
        `${expected.length} Patient${expected.length === 1 ? "" : "s"}`,
      );
    });

    it("shows exactly the occupied admissions with a recorded hold, each carrying its own seeded patient's name and UMRN", () => {
      renderHandover();

      const heading = screen.getByText(/Discharges on hold, non-clinical/);
      const table = screen.getByText("Expected Discharge & Date Set By").closest("table");
      expect(
        table,
        "the live fixture seeds several occupied admissions with a recorded hold (ward-admissions-seed.ts)",
      ).not.toBeNull();

      const rows = Array.from(table!.querySelectorAll("tbody tr"));

      // Independently derived from the exact same seed the app reads (`ward-admissions-seed.ts`'s
      // `wardAdmissions`) — never by reading the component's own `strandedEgress` memo, so this
      // proves the RENDER matches the RECORD rather than checking the memo against itself.
      const expectedAdmissions = wardAdmissions.filter(
        (admission) => bedIsOccupied(admission) && admission.blockReason !== null,
      );
      expect(rows).toHaveLength(expectedAdmissions.length);
      expect(expectedAdmissions.length).toBeGreaterThan(0); // the fixture must actually exercise this table

      // The answer key (26 Sept 2026 read-only seed walk) pins this at 13 for the default
      // scenario; a change here is a real seed edit, never a silent regression, so it is worth
      // failing loudly on rather than only checking rows.length === expectedAdmissions.length.
      expect(expectedAdmissions.length).toBe(13);

      // The title's own patient count must track the row count exactly (never a typed "6").
      expect(heading.textContent).toContain(
        `${expectedAdmissions.length} Patient${expectedAdmissions.length === 1 ? "" : "s"}`,
      );

      const allPatients = combineWardPatients(generatedOccupantPatients, generatedMovementPatients);

      rows.forEach((row, index) => {
        const admission = expectedAdmissions[index];
        const cells = row.querySelectorAll("td");
        expect(cells).toHaveLength(4);

        const renderedName = cells[0].querySelector("b")?.textContent?.trim();
        const renderedUmrn = cells[0].querySelector("div")?.textContent?.trim();
        expect(renderedName, `row ${index} must name a patient`).toBeTruthy();
        expect(renderedUmrn, `row ${index} must show a UMRN`).toBeTruthy();

        // Look up FORWARD, through the same admission link the page's own resolver follows —
        // never the component's `resolveAdmissionPatient`/`strandedEgress`, so this is an
        // independent read of the seed, not the fix checking its own arithmetic.
        const expectedIdentity = resolveSubjectPatient(admission, { patients: allPatients, referrals });
        expect(expectedIdentity.displayName).not.toBe("Unknown Patient");
        expect(renderedName).toBe(expectedIdentity.displayName);
        expect(renderedUmrn).toBe(expectedIdentity.umrn);

        // Look up BACKWARD, from the rendered UMRN alone against the patient list — a second,
        // independent path that never touches `resolveSubjectPatient`, proving the UMRN shown
        // truly belongs (both ways) to the patient whose name sits above it in the same row.
        const byUmrn = allPatients.find((patient) => patient.umrn === renderedUmrn);
        expect(byUmrn, `UMRN ${renderedUmrn} must belong to a real seeded patient`).toBeDefined();
        expect(patientDisplayName(byUmrn!)).toBe(renderedName);

        // The reason, expected time and who-flagged-it come from the same admission as the
        // identity just proved — never a fabricated "days delayed" figure or a guessed bed number.
        expect(cells[1].textContent).toContain("bed not recorded");
        expect(cells[2].textContent).toBe(admission.blockReason);
        if (admission.expectedDischargeAt !== null && Number.isFinite(admission.expectedDischargeAt)) {
          expect(cells[3].textContent).toContain(formatInstant(admission.expectedDischargeAt));
        } else {
          expect(cells[3].textContent).toContain("Not recorded");
        }
        expect(cells[3].textContent).toContain(admission.dischargeDateSetBy ?? "Not recorded");
      });

      // Regression guard against exactly the failure this correction fixed: an admission blocked
      // for a reason but with no expected date yet (Nolan Glasswell / UM500033, Quinta Kellbourne
      // / UM500116 — the answer key's own two "none set" rows) must still get a row, not be
      // silently dropped because it lacks an `expectedDischargeAt`.
      const noExpectedDate = expectedAdmissions.filter((admission) => admission.expectedDischargeAt === null);
      expect(noExpectedDate.length).toBeGreaterThan(0);

      // And the 36 admissions that are merely overdue with NO reason recorded (answer key
      // section B) must never appear here — this table is recorded holds only, never a guess at
      // why a bed has not cleared.
      const tableText = table!.textContent ?? "";
      expect(tableText).not.toContain("UM100033"); // Teodor Banksiavale (section B)
      expect(tableText).not.toContain("UM100003"); // Ines Marrowby (section B)
    });
  });
});
