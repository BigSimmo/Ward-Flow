import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OfficerScreen, isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

/**
 * Ward audit 2026-09-16, fix 1 (officer-screen.tsx): three families of copy/count corrections on
 * the transport officer's console —
 *
 *  (a) the two KPI cards whose caption claimed a narrower population than their count included
 *      ("Dispatched or In Transit" over every open job, "ED Handover Pending" over every
 *      not-yet-collected job, including already-accepted ones);
 *  (b) removal of the redundant static guard-ledger panel per user directive;
 *  (c) "custody"/"custodial" wording (D5: no legal-status claim the record cannot support), an
 *      empty-state sentence naming only one of the two exclusions `isOfficerJob` applies, and a
 *      refusals region that duplicated the jobs panel's own accessible name.
 *
 * Ground truth for (a) is read directly off the seeded fixture below, independently of the
 * component's own formula, so this cannot be satisfied by a test that merely restates the
 * implementation.
 */

describe("officer screen KPI captions match their populations", () => {
  it("the seeded fixture carries the two-state split this test depends on", () => {
    // Ground truth, read off `ward-movements.ts` directly: of the 13 officer jobs (transport
    // present, not arrived, not closed), WF-005, WF-015, WF-021, WF-025 and WF-030 are
    // Accepted-only (acceptedAt set, collectedAt not), and the other eight (WF-006, WF-014,
    // WF-306, WF-313, WF-320, WF-327, WF-026, WF-031) are already collected (moving, not yet
    // arrived). None is Requested-only (acceptedAt unset).
    // 8 → 13: the 17 Sept sample-data addition, WF-021/WF-025/WF-026/WF-030/WF-031 (all carry a
    // transport job and are still open).
    const state = seedWardFlowState();
    const jobs = state.movements.filter(isOfficerJob);
    const acceptedNotCollected = jobs.filter(
      (job) => job.transport?.acceptedAt !== undefined && job.transport?.collectedAt === undefined,
    );
    const collectedNotArrived = jobs.filter(
      (job) => job.transport?.collectedAt !== undefined && job.transport?.arrivedAt === undefined,
    );
    const notYetAccepted = jobs.filter((job) => job.transport?.acceptedAt === undefined);

    expect(jobs).toHaveLength(13);
    expect(acceptedNotCollected.map((job) => job.id).sort()).toEqual([
      "WF-005",
      "WF-015",
      "WF-021",
      "WF-025",
      "WF-030",
    ]);
    expect(collectedNotArrived).toHaveLength(8);
    expect(
      notYetAccepted,
      "the fixture must carry no Requested-only officer job, or the third bucket below proves nothing",
    ).toHaveLength(0);
    // The three buckets partition the officer-job population with nothing left over — the same
    // property the rendered KPI strip must hold.
    expect(acceptedNotCollected.length + collectedNotArrived.length + notYetAccepted.length).toBe(jobs.length);
  });

  it("renders the accepted-not-collected count as those jobs only, not every open job", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    // v6 (7 Oct 2026): the hero stat's own label now names the population ("Accepted, not
    // collected"), where the old card split it into "Active Transit Runs" over "Dispatched or In
    // Transit". The hero stat is a value line followed by its label.
    const label = screen.getByText("Accepted, not collected");
    const value = label.previousElementSibling;
    // Before the 16 Sept fix the value was 8 (every open job, including WF-005/WF-015 which nobody
    // has yet collected) — a number the caption beside it did not cover.
    // 2 → 5: the 17 Sept sample-data addition, WF-021/WF-025/WF-030 (accepted-only).
    expect(value?.textContent).toBe("5");
    expect(label.textContent).toBe("Accepted, not collected");
  });

  it("renders the not-yet-accepted count as those jobs only, not every not-yet-collected job", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    const label = screen.getByText("Not yet accepted");
    const value = label.previousElementSibling;
    // Before the 16 Sept fix the value was 2 (WF-005 and WF-015, both already accepted — a crew is
    // already assigned) under a caption that was no longer true of an accepted job.
    expect(value?.textContent).toBe("0");
    expect(label.textContent).toBe("Not yet accepted");
  });

  it("keeps the on-board count exactly the collected-not-arrived jobs, unchanged", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    // v6: the on-board count is the hero title ("8 on board").
    const title = screen.getByRole("heading", { level: 1 });
    // 6 → 8: the 17 Sept sample-data addition, WF-026/WF-031 (collected-not-arrived).
    expect(title.textContent).toBe("8 on board");
  });
});

describe("officer screen omits the retired guard-ledger panel", () => {
  it("no longer renders the guard-ledger panel or its preconditions", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    const screenEl = screen.getByTestId("ward-officer-screen");
    const text = screenEl.textContent ?? "";
    expect(text).not.toContain("Transport Safety Preconditions");
    expect(text).not.toContain("All Stage Gates Validated");
    expect(text).not.toContain("Form 4A");
  });

  it("no longer renders the destination guard bullet or empty-bed text", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    const screenEl = screen.getByTestId("ward-officer-screen");
    expect(within(screenEl).queryByLabelText("Transport safety preconditions")).not.toBeInTheDocument();
    expect(screenEl.textContent ?? "").not.toContain("empty-bed count");
  });
});

describe("officer screen carries no legal-status claim the transport record cannot support", () => {
  it("never renders 'custody' or 'custodial' anywhere on the screen (D5)", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    const text = screen.getByTestId("ward-officer-screen").textContent ?? "";
    expect(text.toLowerCase()).not.toMatch(/custody|custodial/);
  });
});

describe("officer screen's empty state names both exclusions isOfficerJob applies", () => {
  it("says a job may leave the list by arriving OR by its movement closing, once every job has arrived", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    // Drive every seeded officer job to arrival through the screen's own buttons — WF-005 and
    // WF-015 need en route + collected + arrived first; the rest are already collected and need
    // only arrived. Every target receiving unit carries at least as many physically empty beds as
    // the number of these jobs arriving there, so none contends with another for the same floor
    // guard (bun-adult-open and sjgs-adult-open each carry two, and each receives exactly two of
    // these jobs; every other target receives exactly one against at least one empty bed).
    //
    // 2026-09-17 sample-data pass (T2r fix round, finding 5): WF-021, WF-025 and WF-030 joined the
    // accepted-only group (each carries only `transport.acceptedAt`); WF-026 and WF-031 joined the
    // already-collected group (each already carries `enRouteAt`/`collectedAt`) — every one of the
    // journey-coverage rows this pass added carries a transport job and so is an officer job too.
    const acceptedOnly = ["WF-005", "WF-015", "WF-021", "WF-025", "WF-030"];
    const collectedOnly = ["WF-006", "WF-014", "WF-306", "WF-313", "WF-320", "WF-327", "WF-026", "WF-031"];

    function selectIfNeeded(id: string) {
      const selectButton = screen.queryByTestId(`ward-officer-select-${id}`);
      if (selectButton) fireEvent.click(selectButton);
    }

    for (const id of acceptedOnly) {
      selectIfNeeded(id);
      fireEvent.click(screen.getByTestId(`ward-officer-enroute-${id}`));
      fireEvent.click(screen.getByTestId(`ward-officer-collect-${id}`));
      fireEvent.click(screen.getByTestId(`ward-officer-arrive-${id}`));
    }
    for (const id of collectedOnly) {
      selectIfNeeded(id);
      fireEvent.click(screen.getByTestId(`ward-officer-arrive-${id}`));
    }

    expect(
      screen.queryByTestId("ward-officer-joblist"),
      "every seeded officer job was driven to arrival, so the list must be empty",
    ).not.toBeInTheDocument();
    const empty = screen.getByTestId("ward-officer-empty");
    // Before this fix the sentence claimed "every job on record has arrived" — false in general,
    // since `isOfficerJob` also excludes a job whose movement has simply closed without arriving.
    expect(empty.textContent).not.toContain("every job on record has arrived");
    expect(empty.textContent).toMatch(/arrived or its movement has closed/);
  });
});

describe("officer screen's refusals region has its own accessible name", () => {
  function Harness() {
    const { dispatch, now } = useWardFlow();
    return (
      <>
        <button
          type="button"
          data-testid="force-already-accepted-rejection"
          // WF-005 is already accepted in the seed (`ward-movements.ts`), so a second
          // TRANSPORT_ACCEPTED for it is refused by the reducer's own precondition
          // (`transport.acceptedAt` already set) — a genuine rejection, not a UI guard bypass.
          onClick={() => dispatch({ type: "TRANSPORT_ACCEPTED", role: "officer", now, movementId: "WF-005" })}
        >
          force a rejection
        </button>
        <OfficerScreen />
      </>
    );
  }

  it("stops the refusals list re-using the jobs panel's 'Jobs' name", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("force-already-accepted-rejection"));
    // v6: refusals sit on the Jobs card's Refused tab.
    fireEvent.click(screen.getByRole("tab", { name: /^Refused/ }));

    const refusals = screen.getByTestId("ward-officer-refusals");
    expect(within(refusals).getByText(/was refused/)).toBeInTheDocument();

    // Before this fix, both the jobs panel and the refusals list shared one accessible
    // name — a screen reader could not tell them apart. The jobs panel is "Jobs"; the
    // refusals list is "Refused list".
    expect(screen.getAllByRole("region", { name: /^Jobs$/ })).toHaveLength(1);
    expect(within(refusals).getByRole("region", { name: "Refused list" })).toBeInTheDocument();
  });
});

/**
 * Item 31 (owner's 17 September answers): the officer's own "Arrived" becomes "Delivered" — the
 * action button, the guard-ledger bullet naming it, and the refusal label all read "Delivered".
 * The event dispatched stays `PATIENT_ARRIVED` (the ward, tracker and movements screens keep
 * "Arrived" for that same event, which this file does not touch).
 */
describe("item 31: the officer's own arrival wording reads Delivered, not Arrived", () => {
  it("labels the arrival button Delivered, not Arrived, and a click still dispatches PATIENT_ARRIVED", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    // WF-006 is one of the six collected-not-arrived jobs (see the fixture ground truth above),
    // so its arrival button is enabled without first driving accepted/en-route/collected — it
    // only needs selecting, per the same `selectIfNeeded` pattern the empty-state test above
    // uses, since the four-action row renders only for the selected job.
    const selectButton = screen.queryByTestId("ward-officer-select-WF-006");
    if (selectButton) fireEvent.click(selectButton);

    // v6: the four stage actions sit in the selected job's panel beside the list.
    const card = screen.getByTestId("ward-officer-detail");
    expect(within(card).queryByRole("button", { name: "Arrived" })).not.toBeInTheDocument();
    const button = within(card).getByRole("button", { name: "Delivered" });

    fireEvent.click(button);

    // A successful PATIENT_ARRIVED removes the job from the officer's own list — `isOfficerJob`
    // excludes an arrived movement — the same proof the empty-state test above uses to show a
    // click really reached the reducer, not merely a relabelled button.
    expect(screen.queryByTestId("ward-officer-job-WF-006")).not.toBeInTheDocument();
  });

  it("never renders 'Cannot confirm Arrived' on the screen", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    const text = screen.getByTestId("ward-officer-screen").textContent ?? "";
    expect(text).not.toContain("Cannot confirm Arrived");
    expect(text).not.toContain("Cannot confirm Delivered");
  });

  it("reports a refused arrival as 'Delivered was refused', not 'Arrived was refused'", () => {
    function Harness() {
      const { dispatch, now } = useWardFlow();
      return (
        <>
          <button
            type="button"
            data-testid="force-not-yet-collected-rejection"
            // WF-005 is accepted but not yet collected in the seed (`ward-movements.ts`), so this
            // PATIENT_ARRIVED is a genuine reducer refusal (stage/collectedAt precondition), not a
            // UI guard bypass.
            onClick={() => dispatch({ type: "PATIENT_ARRIVED", role: "officer", now, movementId: "WF-005" })}
          >
            force a rejection
          </button>
          <OfficerScreen />
        </>
      );
    }

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("force-not-yet-collected-rejection"));
    fireEvent.click(screen.getByRole("tab", { name: /^Refused/ }));

    const refusals = screen.getByTestId("ward-officer-refusals");
    // The label and " was refused: " sit in separate JSX text nodes (see the render above), so
    // this reads the refusal row's own combined textContent rather than a `getByText` regex.
    const refusalText = within(refusals).getByRole("listitem").textContent ?? "";
    expect(refusalText).toContain("Delivered was refused:");
    expect(refusalText).not.toContain("Arrived was refused:");
  });
});
