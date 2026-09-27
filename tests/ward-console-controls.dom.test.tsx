import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => router,
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { MOVEMENT_STAGES, type LegalStatus, type MovementId } from "@/components/ward-management/ward-model";
import { movementById } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ THE CONTROLS ACTUALLY DO SOMETHING — which is the assertion the reducer tests cannot make.
 *
 * `tests/ward-urgent-flag.test.ts` and `tests/ward-movement-blocker.test.ts` prove the events work.
 * Neither can prove a SCREEN raises one, and that gap is exactly the shape of the defect being
 * repaired here: `Movement.flaggedUrgent` had a working ordering rule, a working badge, and no
 * control anywhere in the application. A reducer test would have been green throughout.
 *
 * This file therefore drives the real buttons on the real workspace, through a real provider, and
 * reads the result off the rendered page rather than out of state — so a control wired to local
 * `useState` instead of a dispatch fails here even though it would look right on screen.
 */
const WF_001 = movementById("WF-001");
const WF_008 = movementById("WF-008");
const WF_004 = movementById("WF-004");

function renderWorkspace(movementId: MovementId) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardPatientWorkspace movementId={movementId} />
    </WardFlowProvider>,
  );
}

/**
 * Test-only scaffold, not a new application surface: fires a real reducer event through the real
 * provider so a fix that only reads `now`/the record correctly is exercised the same way the
 * urgent-flag and blocker tests above exercise theirs. Two events are needed and neither has a
 * button anywhere on this page yet: `ADVANCE_CLOCK` (role `demo`) is exactly the mechanism the
 * live review used to cross a statutory deadline and midnight, and `CHANGE_LEGAL_STATUS` (role
 * `coordinator`) is how a Voluntary-on-a-locked-ward combination is reached at all — no seeded
 * movement carries that combination directly.
 */
function WorkspaceTestControls({ movementId, legalStatus }: { movementId: MovementId; legalStatus?: LegalStatus }) {
  const { dispatch, now, movements } = useWardFlow();
  // Read live, never from the frozen fixture: a release-then-repull must act on the unit the record
  // holds now, and `RELEASE_PULL` refuses a ward caller whose `actingUnitId` disagrees with it.
  const acceptedUnitId = movements.find((candidate) => candidate.id === movementId)?.acceptedUnitId;
  return (
    <>
      <button
        type="button"
        data-testid="test-advance-clock"
        onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 350 })}
      >
        advance clock
      </button>
      <button
        type="button"
        data-testid="test-advance-clock-far"
        onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 800 })}
      >
        advance clock far
      </button>
      {/*
       * The events that reach the orphaned-transport state. None has a control on THIS page —
       * pulling is the ward's act, booking is the sending team's, stepping back is the coordinator's
       * — so they are driven here exactly as `ADVANCE_CLOCK` and `CHANGE_LEGAL_STATUS` already are.
       * ⚠️ Owner ruling 2026-09-25: RELEASE_PULL now refuses outright while a transport job is
       * booked ("...has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the
       * pull") — until this ruling it cancelled a linked job automatically (WF-37 / Ruling 2), so
       * `test-cancel-transport` must be clicked first wherever a test needs RELEASE_PULL to succeed
       * on a movement with a booked job. Stepping back the stage behind the booking (STEP_BACK_STAGE)
       * still touches nothing else and leaves transport active without a bed held.
       * Driven through the REAL reducer rather than hand-built into a fixture: the whole finding
       * is that the reducer leaves the job behind, and a hand-built movement would assume it.
       */}
      <button
        type="button"
        data-testid="test-pull-patient"
        onClick={() => dispatch({ type: "PULL_PATIENT", role: "ward", now, movementId, unitId: acceptedUnitId ?? "" })}
      >
        pull
      </button>
      <button
        type="button"
        data-testid="test-book-transport"
        onClick={() =>
          dispatch({
            type: "BOOK_TRANSPORT",
            role: "ed",
            now,
            movementId,
            provider: "Patient transport service",
            escortRequired: true,
            cadNumber: "CAD-STUB-0001",
            transportLegalStatus: "voluntary",
            estimatedAt: 0,
          })
        }
      >
        book transport
      </button>
      <button
        type="button"
        data-testid="test-transport-needed"
        onClick={() => dispatch({ type: "RECORD_TRANSPORT_NEED", role: "ed", now, movementId, needed: true })}
      >
        transport needed
      </button>
      <button
        type="button"
        data-testid="test-transport-not-needed"
        onClick={() => dispatch({ type: "RECORD_TRANSPORT_NEED", role: "ed", now, movementId, needed: false })}
      >
        transport not needed
      </button>
      <button
        type="button"
        data-testid="test-cancel-transport"
        onClick={() =>
          dispatch({
            type: "CANCEL_TRANSPORT",
            role: "coordinator",
            now,
            movementId,
            reason: "provider_unavailable",
          })
        }
      >
        cancel transport
      </button>
      <button
        type="button"
        data-testid="test-release-pull"
        onClick={() =>
          dispatch({
            type: "RELEASE_PULL",
            role: "ward",
            now,
            movementId,
            actingUnitId: acceptedUnitId ?? "",
            reason: "bed_needed_for_another_patient",
          })
        }
      >
        release pull
      </button>
      <button
        type="button"
        data-testid="test-step-back"
        onClick={() =>
          dispatch({
            type: "STEP_BACK_STAGE",
            role: "coordinator",
            now,
            movementId,
            to: "accepted_awaiting_bed",
            reason: "recorded_in_error",
          })
        }
      >
        step back
      </button>
      {legalStatus ? (
        <button
          type="button"
          data-testid="test-change-legal-status"
          onClick={() =>
            dispatch({
              type: "CHANGE_LEGAL_STATUS",
              role: "coordinator",
              now,
              movementId,
              legalStatus,
              reason: "recorded_by_treating_team",
            })
          }
        >
          change legal status
        </button>
      ) : null}
    </>
  );
}

function renderWorkspaceWithControls(movementId: MovementId, legalStatus?: LegalStatus) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WorkspaceTestControls movementId={movementId} legalStatus={legalStatus} />
      <WardPatientWorkspace movementId={movementId} />
    </WardFlowProvider>,
  );
}

describe("the movement workspace's urgent-flag control", () => {
  it("fixture assumption: WF-001 is open and unflagged", () => {
    expect(WF_001?.closure).toBeUndefined();
    expect(WF_001?.flaggedUrgent).toBe(false);
  });

  /**
   * Item 37 (2026-09-17): the flag now needs a reason chosen from URGENT_MARK_REASONS before the
   * button does anything — a plain click used to flag immediately, and now must not.
   */
  it("keeps the flag button disabled until a reason is chosen", () => {
    renderWorkspace("WF-001");
    const button = screen.getByTestId("ward-console-urgent-flag-toggle");
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    // A refused click must leave the record exactly as it was.
    expect(within(screen.getByTestId("ward-patient-urgent-flag")).getByText(/not flagged/i)).toBeInTheDocument();
  });

  it("flags, once a reason is chosen, says so in words, and offers the way back", () => {
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-urgent-flag");

    // Before: the state is stated, not left to the button's label.
    expect(within(panel).getByText(/not flagged/i)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ward-console-urgent-flag-reason"), {
      target: { value: "cannot_safely_prevent_leaving" },
    });
    fireEvent.click(screen.getByTestId("ward-console-urgent-flag-toggle"));

    // After: the page has re-rendered FROM THE RECORD. A control holding its own boolean would
    // also flip the label here — what it could not do is survive the round trip through the
    // reducer, which is what the queue-ordering sentence below depends on.
    expect(within(panel).getByText(/leads the queue ahead of every urgency tier/i)).toBeInTheDocument();
    expect(screen.getByTestId("ward-console-urgent-flag-toggle")).toHaveTextContent(/remove the urgent flag/i);

    // And back down again — clearing needs no reason. A flag that could be set but not cleared
    // would be a new permanent state.
    fireEvent.click(screen.getByTestId("ward-console-urgent-flag-toggle"));
    expect(within(panel).getByText(/not flagged/i)).toBeInTheDocument();
  });
});

describe("the movement workspace's blocker control", () => {
  it("fixture assumption: WF-001 carries the fixture's own opening blocker", () => {
    expect(WF_001?.blocker).toBe("Confirming destination options");
  });

  it("records what a person typed, verbatim, and shows it back from the record", () => {
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-blocker");
    expect(within(panel).getByText("Confirming destination options")).toBeInTheDocument();

    const input = screen.getByTestId("ward-console-blocker-input");
    // One of the five values the owner's ruling turns on — free prose naming a party the model has
    // no field for. Typed through the real control rather than dispatched directly.
    fireEvent.change(input, { target: { value: "Awaiting specialling roster confirmation" } });
    fireEvent.submit(input.closest("form")!);

    expect(within(panel).getByText("Awaiting specialling roster confirmation")).toBeInTheDocument();
  });

  it("offers a Clear control, so nobody has to guess the magic words", () => {
    // ⚠️ The screen half of the repair. `hasActiveBlocker` recognises "nothing is blocking" by exact
    // match against a closed set, so a person TYPING "none — resolved" left the movement scoring ten
    // points as obstructed. This is the control that means they never have to.
    renderWorkspace("WF-001");
    const panel = screen.getByTestId("ward-patient-blocker");
    expect(within(panel).getByText("Confirming destination options")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-console-blocker-clear"));

    expect(within(panel).getByText("None — cleared")).toBeInTheDocument();
    // And it goes away once there is nothing left to clear — the reducer refuses a second clear,
    // and a control that will be refused teaches a clinician to distrust the controls.
    expect(screen.queryByTestId("ward-console-blocker-clear")).toBeNull();
  });

  it("cannot submit a blank, so an empty blocker never reaches the reducer", () => {
    renderWorkspace("WF-001");
    // Native `disabled` here is transient inertness — a form action awaiting validity — which is
    // what `docs/wiring-conventions.md` keeps `disabled` for. It is NOT an unavailable feature, so
    // `aria-disabled` would be the wrong pattern and the two together fail lint.
    const submit = screen.getByRole("button", { name: /record it/i });
    expect(submit).toBeDisabled();
    expect(submit).not.toHaveAttribute("aria-disabled");

    fireEvent.change(screen.getByTestId("ward-console-blocker-input"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /record it/i })).toBeDisabled();
  });
});

/**
 * ⚠️ THREE CLINICAL DEFECTS, movement-workspace-review-2026-09-04.md findings 1-3 — every one a
 * false statement on a screen a coordinator acts from. Each block below drives the real workspace
 * through the real provider, the same discipline the two describe blocks above already use, so a
 * fix that only changes a comment (or a helper nothing on screen calls) fails here.
 */
describe("finding 1 — a closed movement must not render as live and actionable", () => {
  it("fixture assumption: WF-008 is closed by self-discharge, not arrival, 20 minutes before now", () => {
    expect(WF_008?.closure).toEqual({
      at: NOW_ANCHOR - 20,
      outcome: "did_not_proceed",
      // Seed gap fixed 2026-09-04: the sentence used to say "before transport arrived" on a
      // movement that carries no `transport` at all — this stage never progressed past
      // accepted_awaiting_bed, so nothing was ever booked to arrive. Reworded to be true of the
      // record beside it.
      reason: "Patient self-discharged from ED before transport was arranged",
    });
    expect(WF_008?.stage).not.toBe("arrived");
  });

  it("carries a closure banner stating the outcome and reason, with a day-aware instant", () => {
    renderWorkspaceWithControls("WF-008");
    const banner = screen.getByTestId("workspace-closure-banner");
    expect(within(banner).getByText(/did not proceed/i)).toBeInTheDocument();
    expect(
      within(banner).getByText(/patient self-discharged from ed before transport was arranged/i),
    ).toBeInTheDocument();
    // Same day as `now` at mount (closure.at = NOW_ANCHOR - 20): the clock face alone, "10:22",
    // with no day suffix — this on its own cannot tell `formatInstantWithDay` from `formatInstant`,
    // which is exactly why the next assertion advances the clock across midnight.
    expect(banner.textContent).toMatch(/10:22/);
    expect(banner.textContent).not.toMatch(/yesterday|tomorrow|days ago|in \d+ days/);

    // Advance `now` by 800 minutes (13h20) — `closure.at` is fixed at seed time and does not move,
    // so `now` crosses into the next demo day relative to it. `formatInstant` would still print the
    // unchanged clock face "10:22"; `formatInstantWithDay` must say "yesterday" as well, which is
    // the exact defect finding 3 describes for the legal-form deadline one field over.
    fireEvent.click(screen.getByTestId("test-advance-clock-far"));
    expect(banner.textContent).toMatch(/10:22 yesterday/);
  });

  it("does not compute an eligibility verdict at all until somebody asks for one", () => {
    // ⚠️ WARD LEAD RULING 1, 2026-09-04, WHICH WITHDREW AN EARLIER INSTRUCTION TO SHOW THE VERDICT
    // WITH A CAVEAT BESIDE IT. This page will be printed or screenshotted into a review of a
    // patient who came to harm, and "Eligible now" beside somebody who never got a bed reads as an
    // accusation that a bed was there and nobody took it. A caveat is exactly what a screenshot
    // crops and a reader skips; a control is not, because the caveat is the thing they clicked.
    renderWorkspace("WF-008");
    expect(screen.queryByTestId("ward-console-eligibility-summary")).toBeNull();
    expect(screen.queryByTestId("ward-console-alternatives")).toBeNull();
    expect(screen.queryByText(/eligible now/i)).toBeNull();

    fireEvent.click(screen.getByTestId("ward-console-reveal-eligibility"));

    const summary = screen.getByTestId("ward-console-eligibility-summary");
    // And the caveat is now unavoidable: it is the first thing inside the block that was revealed.
    expect(
      within(summary).getByText(/This is a calculation against the wards as they are right now/i),
    ).toBeInTheDocument();
    expect(within(summary).getByText(/not a record of what was true when this movement closed/i)).toBeInTheDocument();
  });

  it("says the movement STOPPED at a stage rather than calling it the current one", () => {
    // ⚠️ "Current stage" IS THE WRONG NOUN ON A CLOSED MOVEMENT. It stopped there; it is not
    // currently anything. Proved against the open case too, so the label is not simply gone.
    renderWorkspace("WF-008");
    expect(screen.getByText("Stopped at")).toBeInTheDocument();
    expect(screen.queryByText("Current stage")).toBeNull();

    cleanup();
    renderWorkspace("WF-001");
    expect(screen.getByText("Current stage")).toBeInTheDocument();
    expect(screen.queryByText("Stopped at")).toBeNull();
  });

  it("marks no step as current on a closed movement, and exactly one on an open one", () => {
    // Observed 2026-09-04: the closure banner said the movement was over while step 3 rendered in
    // accent blue as though it were live. The step track is the third place a closed movement used
    // to claim it was running, and `data-state` is what the stylesheet keys the accent off — so
    // this asserts the attribute the paint actually depends on, not the paint.
    renderWorkspace("WF-008");
    const closedTrack = screen.getByTestId("ward-console-track");
    expect(closedTrack.querySelectorAll('[data-state="current"]')).toHaveLength(0);
    expect(closedTrack.querySelectorAll('[data-state="stopped"]')).toHaveLength(1);
    // A future step is not clickable, and neither is a past one: this is a record, not a control.
    expect(closedTrack.querySelectorAll("button")).toHaveLength(0);
    expect(closedTrack.querySelectorAll("li")).toHaveLength(MOVEMENT_STAGES.length);

    cleanup();
    renderWorkspace("WF-001");
    const openTrack = screen.getByTestId("ward-console-track");
    expect(openTrack.querySelectorAll('[data-state="current"]')).toHaveLength(1);
    expect(openTrack.querySelectorAll('[data-state="stopped"]')).toHaveLength(0);
  });

  it("'Tier N' never claims to lead, on an open movement or a closed one", () => {
    // Item 4: this is a statement about the sort key, not about this patient's position, and it is
    // removed from the page ENTIRELY — proved on an OPEN movement (WF-001) so the removal cannot be
    // mistaken for a side effect of the closed-movement arrangement tested above. The tier itself
    // is still stated, as a chip in the masthead.
    renderWorkspace("WF-001");
    expect(screen.getByText("Tier 1")).toBeInTheDocument();
    expect(screen.queryByText(/leads the queue/i)).toBeNull();
    expect(screen.queryByText(/Tier \d leads/i)).toBeNull();
  });

  it("a closed movement's Transport lines do not assert an outstanding booking, in either panel", () => {
    // ⚠️ THE TRANSPORT SENTENCE MOVED (Ward Lead judgement, 2026-09-04). Readiness and the
    // Transport panel printed `transportReadinessLine` word for word — one of the five
    // duplications the cold read counted. The FACT now lives in the Transport panel; Readiness
    // states only the travelling verdict. Both are asserted here so the move cannot quietly
    // become a deletion, and neither may go back to claiming a booking is outstanding.
    renderWorkspace("WF-008");
    const readiness = screen.getByTestId("ward-console-readiness");
    const transport = screen.getByTestId("ward-console-transport-panel");
    expect(within(transport).getByText("No transport was arranged before this movement closed")).toBeInTheDocument();
    expect(within(readiness).getByText("Nothing was arranged before this movement closed.")).toBeInTheDocument();
    expect(within(readiness).queryByText(/not yet requested/i)).toBeNull();
    expect(within(transport).queryByText(/not yet requested/i)).toBeNull();
  });
});

describe("finding 2 — the voluntary-on-locked warning must render, not just reorder", () => {
  it("fixture assumption: WF-008 is Voluntary, with RPH and FSH Adult Secure among its alternatives", () => {
    // WF-008 is ALSO closed (finding 1's fixture) — `eligibleCandidatesAmong` computes Alternatives
    // from the units and the movement's own clinical fields, not from `isOpen`, so the closed
    // movement in finding 1 and the stripped-warning movement in finding 2 are the same record.
    expect(WF_008?.legalStatus).toBe("Voluntary");
    expect(WF_008?.security).toBe("Open");
  });

  it("shows the warning text on every locked-ward alternative, marked with data-restriction, without touching eligibility", () => {
    renderWorkspace("WF-008");
    // WF-008 is closed, so the eligibility block sits behind its own control (ruling 1 above). The
    // warning still has to survive being asked for — a legal risk that only appears on movements
    // nobody looked at twice would be worse than useless.
    fireEvent.click(screen.getByTestId("ward-console-reveal-eligibility"));
    const alternatives = screen.getByTestId("ward-console-alternatives");
    // Review finding 2 named both: "Ward 2K" and "FSH Adult Secure" each offered as
    // "Eligible now" with the legal warning stripped. Both rows carry it, so both are checked.
    // Selected by the RESTRICTION ATTRIBUTE, not by the sentence. The attribute is the contract
    // between the derivation and the screen; the sentence is rendering, and the owner is rewording
    // these pages. Finding the notices by their text made a reworded warning look like a MISSING
    // warning — the same red as the defect this test exists for, which is the one thing it must
    // never be confused with.
    const notices = Array.from(alternatives.querySelectorAll<HTMLElement>('[data-restriction="voluntary_on_locked"]'));
    expect(notices, "both locked-ward alternatives must carry the restriction marker").toHaveLength(2);
    for (const notice of notices) {
      expectSays(notice.textContent ?? "", "the locked-ward legal-status warning", ["voluntary", "locked", "legal"]);
      // Information, never a gate: the row this notice sits on still reads its own real verdict.
      // Walked by DOM structure (span -> row), never by CSS-module class name — the vitest
      // CSS-module proxy fabricates a class for any property asked of it, so a
      // `.closest(".alternativeRow")` selector would silently match nothing rather than fail loudly.
      const row = notice.closest("li")!;
      expect(within(row).getByText("Eligible", { selector: "b" })).toBeInTheDocument();
    }
  });

  it("also shows the warning for the CHOSEN destination once it is voluntary-on-locked", () => {
    // No seeded movement carries this combination on its OWN accepted unit — WF-004 is accepted at
    // BTY Adult Secure (a locked ward) as an involuntary inpatient. `CHANGE_LEGAL_STATUS` is a real,
    // already-tested reducer event (`tests/ward-legal-status-change.test.ts` proves the event
    // itself); dispatching it here reaches the combination through the real record rather than
    // inventing a fixture the model does not have.
    renderWorkspaceWithControls("WF-004", "Voluntary");
    expect(screen.queryByTestId("ward-console-destination-restriction")).toBeNull();

    fireEvent.click(screen.getByTestId("test-change-legal-status"));

    const notice = screen.getByTestId("ward-console-destination-restriction");
    expectSays(notice.textContent ?? "", "the locked-ward legal-status warning", ["voluntary", "locked", "legal"]);
    expect(notice).toHaveAttribute("data-restriction", "voluntary_on_locked");
  });
});

describe("finding 3 — a statutory deadline must carry its day and its breach state", () => {
  it("fixture assumption: WF-004's Form 4C is due 5 hours after NOW_ANCHOR, not yet breached", () => {
    expect(WF_004?.legalForm).toEqual({ code: "4C", kind: "transfer", dueAt: NOW_ANCHOR + 300 });
  });

  it("prints the due day-and-time where the form lives, and reports overdue in words there and in the rail", () => {
    // ⚠️ THE FORM LINE HAS ONE HOME NOW (Ward Lead judgement, 2026-09-04). It was printed in
    // Readiness AND in the legal panel, character for character. The original defect this test
    // exists for — a bare clock face reading "due 08:48" unchanged straight through a breach —
    // is unchanged and still asserted; what moved is WHERE, and that a second copy is gone.
    renderWorkspaceWithControls("WF-004");

    // Finding 11: the four "tabs" were never tabs — the Overview grid rendered byte-identical
    // under all four selections and the others appended below it. They are gone, so this panel is
    // simply on the page and needs no navigation to reach.
    expect(screen.queryByRole("button", { name: /legal & forms/i })).toBeNull();
    const legalPanel = screen.getByTestId("ward-console-legal-panel");
    expect(within(legalPanel).getByText(/due 15:42/)).toBeInTheDocument();
    expect(within(legalPanel).queryByText(/overdue/i)).toBeNull();

    // Readiness states the verdict and points at the panel above. It must not carry a second copy
    // of the clock face — that is the duplication the ruling names.
    const readiness = screen.getByTestId("ward-console-readiness");
    expect(within(readiness).getByText("Recorded, and its deadline is still ahead.")).toBeInTheDocument();
    expect(within(readiness).queryByText(/15:42/)).toBeNull();

    // Advance `now` by 350 minutes: the deadline (NOW_ANCHOR + 300) is now 50 minutes in the past.
    fireEvent.click(screen.getByTestId("test-advance-clock"));

    expect(within(legalPanel).getByText(/due 15:42 — 50m overdue/)).toBeInTheDocument();
    // And the breach reaches the reader who is scanning rather than reading: the attention rail
    // carries the minutes, and Readiness says the deadline has passed and where to read it.
    expect(
      within(readiness).getByText("Recorded, and its deadline has passed. Needs attention says by how much."),
    ).toBeInTheDocument();
    const rail = screen.getByTestId("ward-console-attention");
    expect(within(rail).getByText(/50m overdue/)).toBeInTheDocument();
  });
});

/**
 * ⚠️ THE COLD READ OF 2026-09-04 — six defects and one judgement, every one of them a thing a
 * coordinator would read wrongly off a page whose tests were all green. The judgement block is
 * last and is the one that matters: the page was harder to scan than what it replaced, because
 * the same fact met the reader up to four times and each encounter cost a decision about whether
 * it was new.
 */
describe("D1 — a figure tile must count the thing its label promises", () => {
  it("fixture assumption: WF-004 has no open referral and one ward that accepted", () => {
    expect(WF_004?.referredUnitIds).toEqual([]);
    expect(WF_004?.acceptedUnitId).toBe("bty-adult-secure");
  });

  it("names open referrals, so 'None' is true on a movement a ward has already accepted", () => {
    // ⚠️ "Wards referred to · None" WAS FALSE ON TWO OF THE THREE FIXTURES. `referredUnitIds` holds
    // the referrals still OPEN — an answered one leaves it — so on WF-004 the big figure read
    // "nobody was asked" on a page that says twice over that Bentley accepted. The number is what
    // gets scanned; a correcting sub-line underneath is read second or not at all.
    renderWorkspace("WF-004");
    const figures = screen.getByTestId("ward-console-figures");
    expect(within(figures).getByText("Referrals still open")).toBeInTheDocument();
    expect(within(figures).queryByText("Wards referred to")).toBeNull();
    expect(
      within(figures).getByText("No referral is open. No ward declined, and BTY Adult Secure accepted."),
    ).toBeInTheDocument();
  });

  it("says the same 'None' differently on the movement five wards refused", () => {
    // The third meaning the identical tile used to carry: asked five times, refused five times.
    renderWorkspace("WF-009");
    const figures = screen.getByTestId("ward-console-figures");
    expect(within(figures).getByText("Referrals still open")).toBeInTheDocument();
    expect(within(figures).getByText("No referral is open. 5 wards declined and none accepted.")).toBeInTheDocument();
  });
});

describe("D2 — the shortlist denominator is the cohort, and a shortlist with nothing in it says so", () => {
  it("counts the movement's own cohort, derived from the live units and never hardcoded", () => {
    // ⚠️ `eligibleCandidatesAmong` filters `unit.cohort === movement.cohort` BEFORE ranking, so
    // "3 of 23" credited the search with seven wards that were never candidates. Computed here
    // from the same source the component reads, so a ward added to the map moves both together.
    const adultWards = allUnits().filter((unit) => unit.cohort === "Adult").length;
    expect(adultWards).toBe(15);
    expect(allUnits()).toHaveLength(22);

    renderWorkspace("WF-009");
    const shortlist = screen.getByTestId("ward-console-alternatives").closest("section")!;
    expect(within(shortlist).getByText(`3 of ${adultWards}`)).toBeInTheDocument();
    expect(within(shortlist).queryByText("3 of 22")).toBeNull();
    expect(within(shortlist).getByText(/15 adult wards in the network/)).toBeInTheDocument();
  });

  it("says on the page when no ward on the list could take this patient", () => {
    // ⚠️ WF-009 IS THE ONE PATIENT NOBODY CAN PLACE, and the panel headed "Other wards, ranked"
    // listed three wards of which two had already declined and the third fails a secure gate. A
    // coordinator reads that heading as somewhere left to try.
    renderWorkspace("WF-009");
    expect(screen.getByTestId("ward-console-no-usable-alternative")).toHaveTextContent(
      /No ward on this list could take this patient/,
    );
  });

  it("does not say it on a movement whose shortlist does hold a usable ward", () => {
    // The anti-vacuity half: a note that appeared on every movement would say nothing at all.
    renderWorkspace("WF-001");
    expect(screen.queryByTestId("ward-console-no-usable-alternative")).toBeNull();
  });
});

describe("D3 — the audit timeline must not promise ten kinds of event and deliver one", () => {
  it("fixture assumption: WF-004 records a bed hold that ran out, and no stage change at all", () => {
    expect(WF_004?.pullExpiresAt).toBe(NOW_ANCHOR - 10);
    expect(WF_004?.stageChanges).toEqual([]);
    expect(WF_004?.acceptedAt).toBeUndefined();
  });

  it("emits the dated facts the record holds, including the bed hold the figure strip already prints", () => {
    // ⚠️ ONE ROW, "Movement opened", on a movement that reached step 4, had a ward accept it, and
    // had a bed hold run out at 05:40 — a dated fact printed in its own tile on the same page.
    renderWorkspace("WF-004");
    const timeline = screen.getByTestId("ward-console-timeline");
    expect(within(timeline).getByText("Movement opened")).toBeInTheDocument();

    /*
     * ⚠️ **THIS WAS AN EXACT-STRING `getByText` ON RENDERED COPY UNTIL 2026-09-06, AND IT WENT RED
     * THE MOMENT THAT COPY WAS CORRECTED.** The label said "The hold on the bed at … ran out"; the
     * owner has ruled a reserved bed is a PULL, so the label changed and this assertion had to move
     * with it — which is the tell. **A guard that must be edited every time correct copy is reworded
     * is a tripwire on the redesign, not on the defect**, and the owner's standing instruction is
     * that testing works with redesigns rather than fighting them.
     *
     * Re-pinning the new sentence verbatim would have moved the tripwire one rewording along and
     * cost the same edit again next time. So it asserts the CLAIM instead: this timeline names the
     * bed reservation ending, at the named destination. Reword it freely; it may not stop saying it.
     *
     * The vocabulary itself is pinned where it belongs — `ward-pull-vocabulary.dom.test.tsx` for
     * the rendered controls, and `ward-delay-cause-vocabulary.test.ts` for the copy table. This
     * assertion deliberately does NOT check which word is used, because two guards over one fact
     * disagree eventually and the wording one is already owned elsewhere.
     */
    // Found by the DESTINATION, which is data rather than copy and so cannot be reworded. My first
    // attempt at this located the row by matching "ran out" — swapping one pinned phrase for
    // another, which is the same defect one step quieter.
    const bedRow = within(timeline)
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "")
      .find((text) => text.includes("BTY Adult Secure"));
    expect(
      bedRow,
      "the timeline no longer carries a dated row naming BTY Adult Secure. The bed reservation " +
        "ending is a DATED fact the record holds and the figure strip already prints, so its " +
        "absence here is the short-list defect this test exists for — not a wording change.",
    ).toBeDefined();
    // Measured 2026-09-08, reword arm on the real component. The single spelling ["bed"] went RED
    // on a plausible reword of this very label — `The pull on the bed at X ran out` shortened to
    // `The pull at X lapsed`, which drops "bed" as redundant and says the identical thing. That is
    // this assertion fighting the redesign its own comment above says it must not fight.
    //
    // Widened to the spellings a redesign would actually reach for. The deletion arm was re-run
    // after widening and still goes RED (`Timeline entry at BTY Adult Secure` — the row present,
    // the reservation unnamed), so this is a tolerance gain, not a guard that stopped discriminating.
    expectSays(bedRow ?? "", "the bed-reservation row", ["bed", "pull", "reservation"]);
    expectSays(bedRow ?? "", "the bed-reservation row's ending", ["ran out", "expired", "lapsed", "ended"]);

    expect(timeline.querySelectorAll("li").length).toBeGreaterThan(1);
  });

  it("names what happened that nothing timed, rather than dropping it out of a list calling itself complete", () => {
    // ⚠️ THE BLURB IS WHAT MADE THE SHORT LIST HARMFUL: it turned "nothing was timed" into
    // "nothing happened". An undated fact cannot be placed in a chronological record without
    // inventing an instant, so it is named underneath instead.
    renderWorkspace("WF-004");
    const untimed = screen.getByTestId("ward-console-untimed");
    expect(within(untimed).getByText(/reached step 4 of 7/)).toBeInTheDocument();
    expect(within(untimed).getByText(/BTY Adult Secure accepted this patient/)).toBeInTheDocument();
    const timelinePanel = screen.getByTestId("ward-console-timeline").closest("section")!;
    expect(within(timelinePanel).queryByText(/stage transitions, legal-status and urgency changes/)).toBeNull();
  });
});

describe("D4, D5, D6 — a closed movement must not contradict itself", () => {
  it("does not say a closed movement is held up and unholdable-up on one screen", () => {
    // ⚠️ WF-008 SAID BOTH: Readiness "what is holding it up: Patient declined transfer", and the
    // control "nothing can be holding it up and no new blocker can be recorded against it".
    renderWorkspace("WF-008");
    expect(screen.queryByText(/nothing can be holding it up/i)).toBeNull();
    const readiness = screen.getByTestId("ward-console-readiness");
    expect(within(readiness).queryByText("Patient declined transfer")).toBeNull();
    expect(
      within(readiness).getByText(/A note was recorded before this movement closed\. Nothing is holding it up now/),
    ).toBeInTheDocument();
    // The note itself survives, once, where it can be read beside the controls that change it.
    const blockerPanel = screen.getByTestId("ward-patient-blocker");
    expect(within(blockerPanel).getByText("Patient declined transfer")).toBeInTheDocument();
    expect(within(blockerPanel).getByText(/The note above is what was recorded before it stopped/)).toBeInTheDocument();
  });

  it("gives the readiness panel the tense every other panel already had", () => {
    // ⚠️ D5: the header still read "before this patient can travel" about a patient who will never
    // travel. Proved against the open case too, so the wording is not simply gone.
    renderWorkspace("WF-008");
    expect(screen.getByText("Readiness when this stopped")).toBeInTheDocument();
    expect(screen.queryByText(/have to be true before this patient can travel/)).toBeNull();

    cleanup();
    renderWorkspace("WF-001");
    expect(screen.getByText("Readiness")).toBeInTheDocument();
    expect(screen.queryByText("Readiness when this stopped")).toBeNull();
  });

  it("does not claim a closed patient is ordered in the queue like everybody else", () => {
    // ⚠️ D6: "Not flagged. This patient is ordered by urgency tier and waiting time, like everybody
    // else" sat DIRECTLY ABOVE "it is not in the queue at all". Adjacent, and contradictory.
    renderWorkspace("WF-008");
    const flagPanel = screen.getByTestId("ward-patient-urgent-flag");
    expect(within(flagPanel).queryByText(/like everybody else/)).toBeNull();
    expect(within(flagPanel).getByText(/it is not in the queue at all/)).toBeInTheDocument();
    // One sentence, not two to reconcile.
    expect(flagPanel.querySelectorAll("p")).toHaveLength(1);

    cleanup();
    renderWorkspace("WF-001");
    expect(within(screen.getByTestId("ward-patient-urgent-flag")).getByText(/like everybody else/)).toBeInTheDocument();
  });
});

/**
 * ⚠️ THE JUDGEMENT, AND THE ONE NUMBER WARD LEAD SAID HE WOULD CHECK.
 *
 * On WF-004 the sentence "Escort provider organising secure transport" appeared FOUR times — in
 * the attention rail, in the blocker control, in Readiness as "what is holding it up", and in
 * Movement facts as "recorded by hand as holding this up". A coordinator scanning for what is
 * wrong met the same blocker four times and had to work out, each time, whether it was new.
 *
 * The rule the page now follows is that every fact has ONE home and a panel that would repeat it
 * points at that home instead. The blocker keeps two, and only two, deliberately: the rail says
 * what is wrong (that is what the rail is for), and the control shows the value because nobody
 * should clear a clinical note they cannot see. Everything else points.
 *
 * ⚠️ COUNTED OVER THE WHOLE RENDERED PAGE, not within a panel — a duplication that moves to a new
 * panel is not a fix, and only a whole-document count can see that.
 */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("the judgement — one fact, one home", () => {
  it("fixture assumption: WF-004's blocker is the sentence the cold read counted four times", () => {
    expect(WF_004?.blocker).toBe("Escort provider organising secure transport");
  });

  it("prints the blocker sentence exactly twice on WF-004: the rail that says what is wrong, and the control that changes it", () => {
    renderWorkspace("WF-004");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(occurrences(page, "Escort provider organising secure transport")).toBe(2);
    expect(
      within(screen.getByTestId("ward-console-attention")).getByText(/Escort provider organising secure transport/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("ward-patient-blocker")).getByText("Escort provider organising secure transport"),
    ).toBeInTheDocument();
  });

  it("answers the transport question in one place, and the job question in another", () => {
    // Two duplications, one fixture. Readiness printed `transportReadinessLine` word for word, and
    // the Job row re-answered the "Is transport needed?" row directly above it. Three surfaces now
    // say three different things about transport, and the page asserts the unanswered need once.
    renderWorkspace("WF-004");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(occurrences(page, "nobody has recorded whether one is needed")).toBe(0);
    expect(occurrences(page, "Nobody has recorded an answer either way")).toBe(1);
    const transport = screen.getByTestId("ward-console-transport-panel");
    expect(within(transport).getByText("No job has been raised.")).toBeInTheDocument();
  });

  it("prints a closure reason twice on WF-008 — the banner that dominates the page, and the step it stopped on", () => {
    // The same rule applied to the closed arrangement: both controls used to repeat the reason in
    // a parenthesis, making four copies on one screen. The panel at the top of the page is the
    // loudest thing on it; the controls point at it instead of quoting it.
    renderWorkspace("WF-008");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(occurrences(page, "Patient self-discharged from ED before transport was arranged")).toBe(2);
  });

  it("prints the legal status twice — the masthead descriptor and the record — never three times", () => {
    renderWorkspace("WF-004");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(occurrences(page, "Involuntary inpatient")).toBe(2);
  });
});

/**
 * ═══ THE TWO CORRECTION CONTROLS — AND THE ASSERTION THAT THEY ARE TWO ═══
 *
 * ⚠️ **BOTH REDUCER CASES WERE COMPLETE AND UNREACHABLE FOR DAYS.** `WITHDRAW_ACCEPTANCE` and
 * `STEP_BACK_STAGE` had events, reducer cases, a role gate, a closed reason list, refusal paths
 * and audit-trail rendering. No screen in the product could raise either one. **Every reducer test
 * was green throughout**, which is the same gap `flaggedUrgent` sat in and the reason this file
 * exists: a reducer test cannot prove a SCREEN raises an event.
 *
 * ⚠️ **AND THE POINT OF THE DESIGN IS THAT THEY ARE SEPARATE CONTROLS.** One corrects a RECORD;
 * the other tells a WARD its earlier "yes" no longer stands. A single merged "undo" would pass
 * every reducer test too, so the separation is asserted here explicitly — two sections, two
 * reasons, and one that does not un-accept.
 */
const WF_003 = movementById("WF-003");

describe("the movement workspace's withdraw-acceptance control", () => {
  it("fixture assumption: WF-003 is open, accepted by a named ward, and awaiting a bed", () => {
    expect(WF_003?.closure).toBeUndefined();
    expect(WF_003?.stage).toBe("accepted_awaiting_bed");
    expect(WF_003?.acceptedUnitId).toBe("rph-adult-secure");
  });

  it("fixture assumption: WF-008 is at the same stage but CLOSED — the discriminating case", () => {
    // If the closed check were missing, this movement would render the live control, because its
    // stage satisfies the reducer's gate. A fixture that differed on both properties at once
    // could not tell the two guards apart.
    expect(WF_008?.stage).toBe("accepted_awaiting_bed");
    expect(WF_008?.closure).toBeDefined();
  });

  it("refuses to act until a reason is chosen, and records nothing when activated unchosen", () => {
    renderWorkspace("WF-003");
    const panel = screen.getByTestId("ward-patient-withdraw-acceptance");
    const button = screen.getByTestId("ward-console-withdraw-acceptance");

    // `aria-disabled`, never native `disabled` — the stated reason has to stay reachable by
    // keyboard, which native `disabled` would remove the tab stop for.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");

    fireEvent.click(button);

    // Nothing happened. Read off the RECORD as the page renders it, not off the button: the panel
    // still describes an acceptance that stands.
    expect(within(panel).getByText(/said yes and is holding this patient/i)).toBeInTheDocument();
  });

  it("withdraws, and the page then says no ward has accepted", () => {
    renderWorkspace("WF-003");
    const panel = screen.getByTestId("ward-patient-withdraw-acceptance");
    expect(within(panel).getByText(/said yes and is holding this patient/i)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ward-console-withdraw-reason"), { target: { value: "the_bed_was_lost" } });
    expect(screen.getByTestId("ward-console-withdraw-acceptance")).not.toHaveAttribute("aria-disabled");
    fireEvent.click(screen.getByTestId("ward-console-withdraw-acceptance"));

    // The round trip through the reducer, read back off the page. A control holding its own state
    // could relabel a button; it could not make THIS sentence appear, because the sentence is
    // chosen by `acceptedUnitId` on the live record.
    expect(
      within(screen.getByTestId("ward-patient-withdraw-acceptance")).getByText(/no ward has accepted this patient/i),
    ).toBeInTheDocument();
  });

  it("writes the chosen reason onto the audit trail in words, never as its stored value", () => {
    renderWorkspace("WF-003");
    fireEvent.change(screen.getByTestId("ward-console-withdraw-reason"), { target: { value: "the_bed_was_lost" } });
    fireEvent.click(screen.getByTestId("ward-console-withdraw-acceptance"));

    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    /*
     * 🔴 **THIS ASSERTION FOUND A LIVE DEFECT AND ITS FIRST DRAFT WAS WRONG ABOUT WHERE.**
     *
     * It was written expecting "Acceptance withdrawn · The bed was lost" — the `unwinds` wording
     * from `ward-derivations.ts`. This page does not use that helper: it composes its own
     * timeline from the record (see the docblock above `timeline`), and what it printed was
     * `Stage Accepted, awaiting bed → Destination review, by coordinator · the_bed_was_lost` —
     * **the stored value, in snake_case, on a coordinator's screen.**
     *
     * That line renders the reason for FIVE events from four different reason lists, so `DECLINE`
     * and `RELEASE_PULL` printed raw too. It is now `stageChangeReasonLabel`, and this is the
     * assertion that holds it there.
     */
    /*
     * ⚠️ **THE LINE NAMES THE WARD SINCE 2026-09-06** (Ward Lead's ruling). It used to read
     * "Accepted, awaiting bed → Destination review, by coordinator · The bed was lost" — a stage
     * transition, indistinguishable from a bookkeeping correction to the same stage.
     *
     * `UnwindRecord.unitId` is the only record of WHOSE acceptance this was: `WITHDRAW_ACCEPTANCE`
     * clears `acceptedUnitId` in the same update, so nothing else on the movement can say. **"An
     * acceptance was withdrawn" without the ward reads as a system that does not know, when it
     * does.**
     */
    expect(page).toContain("Acceptance by Dabakarn withdrawn, by coordinator · The bed was lost");
    // ⚠️ Never the raw value, in any form, anywhere on the page.
    expect(page).not.toContain("the_bed_was_lost");
  });

  it("✅ tells a withdrawal from a correction — the ruling that closed the handed-back question", () => {
    /*
     * ✅ **THIS TEST WENT RED WHEN THE RULING LANDED, WHICH IS WHAT IT WAS WRITTEN TO DO.** It used
     * to pin the two acts as INDISTINGUISHABLE — a measurement recorded as a finding rather than as
     * correct behaviour, with a note saying that if Ward Lead's answer made them distinguishable it
     * would go red and say why. It did, and this is the other side of it.
     *
     * **Ward Lead's ruling, 2026-09-06:** one line per event, whose text differs by `kind`. Not two
     * lines at one instant — that is the shape this page was corrected for in September, when a
     * closure reason printed four times. A withdrawal names the ward; a correction says what it did
     * not do.
     *
     * ⚠️ **WHY IT MATTERS, IN THE RULING'S OWN TERMS:** a record in which withdrawing a ward's
     * acceptance and correcting a stage read identically **cannot answer "did a ward lose a bed it
     * had committed?"** — the question the two events were separated to answer in the first place.
     *
     * ⚠️ **AND NO OTHER SCREEN CHANGED.** This is composed in `ward-management-console.tsx`'s own
     * timeline; `movementTimeline` in `ward-derivations.ts` is untouched, so the screens that read
     * it render exactly what they did before.
     */
    renderWorkspace("WF-003");
    fireEvent.change(screen.getByTestId("ward-console-withdraw-reason"), { target: { value: "recorded_in_error" } });
    fireEvent.click(screen.getByTestId("ward-console-withdraw-acceptance"));
    const afterWithdrawal = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    cleanup();

    renderWorkspace("WF-003");
    fireEvent.change(screen.getByTestId("ward-console-step-back-to"), { target: { value: "destination_review" } });
    fireEvent.change(screen.getByTestId("ward-console-step-back-reason"), { target: { value: "recorded_in_error" } });
    fireEvent.click(screen.getByTestId("ward-console-step-back-stage"));
    const afterCorrection = screen.getByTestId("ward-patient-workspace").textContent ?? "";

    // The withdrawal names the ward and the act. The correction names neither, and says instead
    // what it did NOT do — in the same words the control above uses.
    expect(afterWithdrawal).toContain("Acceptance by Dabakarn withdrawn, by coordinator · Recorded in error");
    expect(afterCorrection).toContain(
      "Stage record corrected to Destination review, by coordinator · Recorded in error — no bed released, no transport cancelled, no acceptance undone",
    );

    /*
     * ⚠️ **THE PROPERTY, NOT JUST THE TWO STRINGS.** Two `toContain`s would both pass if the page
     * printed BOTH sentences on both movements. This is what says the two records actually differ:
     * neither may carry the other's line.
     */
    expect(afterWithdrawal).not.toContain("Stage record corrected");
    expect(afterCorrection).not.toContain("withdrawn, by coordinator");

    // ⚠️ And ONE line per act, never two at one instant — the September defect this ruling avoided.
    expect(afterWithdrawal).not.toContain("Accepted, awaiting bed → Destination review");
  });

  it("states why it is unavailable rather than hiding, on each of the three unavailable states", () => {
    // No acceptance at all.
    renderWorkspace("WF-001");
    expect(
      within(screen.getByTestId("ward-patient-withdraw-acceptance")).getByText(/no ward has accepted this patient/i),
    ).toBeInTheDocument();
    cleanup();

    // Accepted, but a bed is already pulled — the owner's narrow gate, stated as an outstanding
    // decision rather than as a ruling that the act is wrong.
    renderWorkspace("WF-004");
    expect(
      within(screen.getByTestId("ward-patient-withdraw-acceptance")).getByText(/a bed has already been pulled/i),
    ).toBeInTheDocument();
    cleanup();

    // Closed. WF-008 satisfies the reducer's stage gate, so only the closure check keeps it inert.
    renderWorkspace("WF-008");
    expect(
      within(screen.getByTestId("ward-patient-withdraw-acceptance")).getByText(/no longer running/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ward-console-withdraw-acceptance")).not.toBeInTheDocument();
  });
});

describe("the movement workspace's step-back-stage control", () => {
  it("offers only stages strictly earlier than the record's own", () => {
    renderWorkspace("WF-004");
    const options = within(screen.getByTestId("ward-console-step-back-to"))
      .getAllByRole("option")
      .map((option) => option.textContent);

    // WF-004 is at "pulled": three earlier stages plus the blank. A forward "skip a step" is
    // explicitly out of scope (owner ruling 4), so no later stage may be offerable at all.
    expect(options).toEqual(["Choose a stage…", "Placement requested", "Destination review", "Accepted, awaiting bed"]);
  });

  it("needs BOTH the stage and the reason before it will act", () => {
    renderWorkspace("WF-004");
    const button = screen.getByTestId("ward-console-step-back-stage");
    expect(button).toHaveAttribute("aria-disabled", "true");

    // Stage alone is not enough — a correction with no recorded reason is the thing this whole
    // reason list exists to prevent.
    fireEvent.change(screen.getByTestId("ward-console-step-back-to"), { target: { value: "destination_review" } });
    expect(screen.getByTestId("ward-console-step-back-stage")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId("ward-console-step-back-stage"));
    expect(screen.getByTestId("ward-patient-workspace").textContent ?? "").not.toContain("Stage corrected");

    fireEvent.change(screen.getByTestId("ward-console-step-back-reason"), { target: { value: "recorded_in_error" } });
    expect(screen.getByTestId("ward-console-step-back-stage")).not.toHaveAttribute("aria-disabled");
  });

  it("corrects the record and names the reason in words on the audit trail", () => {
    renderWorkspace("WF-004");
    fireEvent.change(screen.getByTestId("ward-console-step-back-to"), { target: { value: "destination_review" } });
    fireEvent.change(screen.getByTestId("ward-console-step-back-reason"), { target: { value: "recorded_in_error" } });
    fireEvent.click(screen.getByTestId("ward-console-step-back-stage"));

    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    // Names the correction as a correction, and says what it left alone. A coordinator meets the
    // same sentence in the control and in the record.
    expect(page).toContain(
      "Stage record corrected to Destination review, by coordinator · Recorded in error — no bed released, no transport cancelled, no acceptance undone",
    );
    expect(page).not.toContain("recorded_in_error");
  });

  it("does NOT un-accept — and the withdrawal control says so instead of claiming nobody accepted", () => {
    // 🔴 THE DEFECT THIS PINS. `STEP_BACK_STAGE` deliberately never writes `acceptedUnitId`, so a
    // movement can sit at Destination review with a ward still named as having accepted it. A
    // withdrawal control gated on the STAGE printed "No ward has accepted this patient" over the
    // top of a page whose masthead named that ward — two clicks apart on one screen.
    renderWorkspace("WF-003");
    fireEvent.change(screen.getByTestId("ward-console-step-back-to"), { target: { value: "destination_review" } });
    fireEvent.change(screen.getByTestId("ward-console-step-back-reason"), { target: { value: "recorded_in_error" } });
    fireEvent.click(screen.getByTestId("ward-console-step-back-stage"));

    const panel = screen.getByTestId("ward-patient-withdraw-acceptance");
    expect(
      within(panel).getByText(/still says so, but the recorded stage has been corrected back to/i),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/no ward has accepted this patient/i)).not.toBeInTheDocument();
  });

  it("says why it is unavailable at the first stage and on a closed movement", () => {
    renderWorkspace("WF-001");
    expect(
      within(screen.getByTestId("ward-patient-step-back-stage")).getByText(/nothing earlier to correct it to/i),
    ).toBeInTheDocument();
    cleanup();

    renderWorkspace("WF-008");
    expect(
      within(screen.getByTestId("ward-patient-step-back-stage")).getByText(/stage record is closed/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ward-console-step-back-stage")).not.toBeInTheDocument();
  });
});

describe("the two corrections are two controls, not one", () => {
  it("renders both sections, each with its own reason picker", () => {
    renderWorkspace("WF-003");
    // ⚠️ A single merged "undo" control would pass every reducer test and every assertion above
    // that touches only one act. This is the assertion it fails.
    expect(screen.getByTestId("ward-patient-withdraw-acceptance")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-step-back-stage")).toBeInTheDocument();
    expect(screen.getByTestId("ward-console-withdraw-reason")).not.toBe(
      screen.getByTestId("ward-console-step-back-reason"),
    );
  });

  it("keeps the two reasons apart — choosing one does not answer the other", () => {
    renderWorkspace("WF-003");
    fireEvent.change(screen.getByTestId("ward-console-withdraw-reason"), { target: { value: "the_bed_was_lost" } });

    // A shared draft is the first step to merging the two acts, and it would show up here as a
    // step-back button that became available without anybody choosing a step-back reason.
    expect(screen.getByTestId("ward-console-step-back-reason")).toHaveValue("");
    expect(screen.getByTestId("ward-console-step-back-stage")).toHaveAttribute("aria-disabled", "true");
  });

  it("describes them as different acts — one reaches a ward, the other does not", () => {
    renderWorkspace("WF-003");
    const withdraw = screen.getByTestId("ward-patient-withdraw-acceptance").textContent ?? "";
    const stepBack = screen.getByTestId("ward-patient-step-back-stage").textContent ?? "";

    // The withdrawal names the consequence for the ward; the correction denies exactly that
    // consequence. If these two ever read the same, the controls have merged in substance even
    // if two sections remain on the page.
    expect(withdraw).toMatch(/does not re-refer/i);
    expect(stepBack).toMatch(/does not release a bed, cancel transport or undo/i);
    expect(withdraw).not.toBe(stepBack);
  });
});

describe("the workspace timeline's withdrawn-referral line", () => {
  /**
   * ⚠️ **THIS FILE EXISTS BECAUSE A MUTATION SURVIVED.** Reverting this line to
   * `reason.replaceAll("_", " ")` left all fifty tests green — the fix was real and completely
   * unproven, because no movement any of them rendered carries a withdrawn referral. WF-006 is
   * the only one in the fixture that does, and nothing had ever rendered it here.
   *
   * **A fix with no failing mutation is indistinguishable from a fix that does nothing**, and the
   * only reason this was noticed is that the mutation was run rather than assumed.
   */
  it("fixture assumption: WF-006 is the one movement carrying a withdrawn referral", () => {
    expect(movementById("WF-006")?.withdrawnReferrals).toHaveLength(1);
    expect(movementById("WF-006")?.withdrawnReferrals[0]?.reason).toBe("another_unit_accepted");
  });

  it("renders the label the field's own comment demands, never the stored code", () => {
    renderWorkspace("WF-006");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";

    // `Movement.withdrawnReferrals`: "Render `withdrawalReasonLabels[reason]`, never the code."
    expect(page).toContain("Withdrawn — another unit accepted this patient.");
    // The tidied-up code, which is what this line printed before: "another unit accepted".
    expect(page).not.toContain("another_unit_accepted");
    expect(page).not.toContain("withdrawn · another unit accepted");
  });

  it("names no destination — the privacy property that label was written for", () => {
    // FD-23: this line once read "Referral withdrawn once RGH Adult Secure confirmed the bed",
    // telling FSH in plain English which ward took the patient. The label names no ward, and the
    // only ward this line may name is the one whose own referral was withdrawn.
    renderWorkspace("WF-006");
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(page).toContain("Referral to FSH Adult Secure · Withdrawn — another unit accepted this patient.");
  });
});

describe("a transport job that outlived the bed it was booked against", () => {
  /**
   * 🔴 Under WF-37 (Ruling 2), `RELEASE_PULL` cancels linked transport automatically.
   * Stepping back the stage behind the booking (`STEP_BACK_STAGE` to `accepted_awaiting_bed`)
   * touches nothing else and leaves the transport job active without a bed held.
   *
   * Every step below goes through the real reducer. **A hand-built fixture would assume the very
   * thing under test.**
   */
  function driveToOrphan(movementId: MovementId) {
    renderWorkspaceWithControls(movementId);
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    fireEvent.click(screen.getByTestId("test-book-transport"));
    fireEvent.click(screen.getByTestId("test-step-back"));
  }

  it("says nothing at all while the job and its bed still agree", () => {
    /*
     * ⚠️ **THE CONTROL, AND IT IS THE ONE THAT MATTERS MOST HERE.** The predicate was first written
     * as "a job exists and no pull is held", which reads perfectly and flags ALL FOURTEEN seeded
     * movements carrying transport, because `pullExpiresAt` is written only by the reducer and no
     * hand-authored fixture sets it. A surface that fires on every moving patient is worse than
     * none. This pins that it fires on neither the pulled-and-booked state nor a seeded journey.
     */
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    fireEvent.click(screen.getByTestId("test-book-transport"));
    expect(screen.queryByTestId("ward-patient-orphaned-transport")).not.toBeInTheDocument();
    cleanup();

    // WF-006 is seeded mid-journey with a live job — the shape the naive predicate misread.
    renderWorkspace("WF-006");
    expect(screen.queryByTestId("ward-patient-orphaned-transport")).not.toBeInTheDocument();
  });

  it("names the provider and explains the stage was moved back behind the booking", () => {
    driveToOrphan("WF-003");
    const panel = screen.getByTestId("ward-patient-orphaned-transport");
    // The provider, because that is who would actually turn up.
    expect(within(panel).getByText(/Patient transport service/)).toBeInTheDocument();
    expect(
      within(panel).getByText(
        /The recorded stage has been moved back behind the booking\. Correcting a stage does not release a bed, so the ward may still be holding one — check with them before cancelling Patient transport service\./,
      ),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/the ward may still be holding one/i)).toBeInTheDocument();
  });

  it("⚠️ names who may cancel, rather than offering a control that would be refused", () => {
    /*
     * Ward Lead's decoupling requirement, 2026-09-06: `BOOK_TRANSPORT` permits ed/ward/community,
     * `CANCEL_TRANSPORT` permits only coordinator/ed, and that asymmetry is with the owner. This
     * surface must be useful whichever way he rules — **a button that exists and is refused is
     * worse than no button; it teaches people the screen is lying to them.**
     */
    driveToOrphan("WF-003");
    const panel = screen.getByTestId("ward-patient-orphaned-transport");
    expect(
      within(panel).getByText(/cancelled by the flow coordinator or by the referring emergency department/i),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/cannot cancel it themselves/i)).toBeInTheDocument();
  });

  it("raises it at the top of the attention rail, as a real vehicle rather than a record", () => {
    driveToOrphan("WF-003");
    const rail = screen.getByTestId("ward-console-attention");
    expect(within(rail).getByText(/Transport booked with Patient transport service/i)).toBeInTheDocument();
    expect(within(rail).getByText(/Record behind/i)).toBeInTheDocument();
    expect(
      within(rail).getByText(/the ward may still be holding one — check with them before cancelling/i),
    ).toBeInTheDocument();
  });

  it("refuses to cancel until a reason is chosen, then cancels and the surface goes", () => {
    driveToOrphan("WF-003");
    const button = screen.getByTestId("ward-console-cancel-transport");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    // Still there: nothing was dispatched.
    expect(screen.getByTestId("ward-patient-orphaned-transport")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ward-console-cancel-transport-reason"), {
      target: { value: "destination_changed" },
    });
    fireEvent.click(screen.getByTestId("ward-console-cancel-transport"));

    // Read off the record as the page renders it: the job is gone, so the surface is gone.
    expect(screen.queryByTestId("ward-patient-orphaned-transport")).not.toBeInTheDocument();
  });

  it("distinguishes a released bed from a record that was merely stepped back", () => {
    /*
     * ⚠️ **THE TWO CAUSES ARE NOT THE SAME SITUATION AND MUST NOT READ THE SAME.**
     * `STEP_BACK_STAGE` corrects the RECORD and never touches the bed, so the ward may still be
     * holding one. Saying "the bed has been given back" there would state something more definite
     * than the record supports — the defect class this page keeps paying for.
     */
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    fireEvent.click(screen.getByTestId("test-book-transport"));
    fireEvent.change(screen.getByTestId("ward-console-step-back-to"), { target: { value: "accepted_awaiting_bed" } });
    fireEvent.change(screen.getByTestId("ward-console-step-back-reason"), { target: { value: "recorded_in_error" } });
    fireEvent.click(screen.getByTestId("ward-console-step-back-stage"));

    const panel = screen.getByTestId("ward-patient-orphaned-transport");
    expect(within(panel).getByText(/the ward may still be holding one/i)).toBeInTheDocument();
    expect(within(panel).queryByText(/given back to the ward/i)).not.toBeInTheDocument();
    // And the rail says check, not act.
    expect(within(screen.getByTestId("ward-console-attention")).getByText(/Record behind/i)).toBeInTheDocument();
  });

  it("🔴 does not relabel one actor's act with another's, at the same instant", () => {
    /*
     * ⚠️ **WRITTEN BECAUSE A MUTATION SURVIVED.** Loosening the audit-line join from
     * (instant AND actor) to (instant alone) changed nothing across all 66 tests — so the actor
     * half was defensive code with no proof behind it, which is indistinguishable from
     * unnecessary code.
     *
     * **And the collision turns out to be trivially reachable, not exotic.** Every event fired in
     * these tests carries the provider's `now`, which only `ADVANCE_CLOCK` moves — so a test that
     * clicks four controls puts four events at ONE instant. The clock is not what separates them.
     *
     * The sequence below puts a WARD's `RELEASE_PULL` and a COORDINATOR's `STEP_BACK_STAGE` at the
     * same instant. `RELEASE_PULL` writes a `pull_released` unwind, which this join deliberately
     * ignores; with the actor half removed, the ward's release finds the coordinator's
     * `stage_corrected` unwind instead and **the ward's act is printed as the coordinator's** —
     * wrong actor and wrong act, on the audit trail, looking entirely legitimate.
     */
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    fireEvent.click(screen.getByTestId("test-book-transport"));
    // Owner ruling 2026-09-25: RELEASE_PULL refuses while a transport job is booked ("...has a
    // transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the pull") — cancel it
    // first so the release below still reaches the same-instant collision this test is about.
    fireEvent.click(screen.getByTestId("test-cancel-transport"));
    fireEvent.click(screen.getByTestId("test-release-pull"));
    fireEvent.change(screen.getByTestId("ward-console-step-back-to"), { target: { value: "destination_review" } });
    fireEvent.change(screen.getByTestId("ward-console-step-back-reason"), { target: { value: "recorded_in_error" } });
    fireEvent.click(screen.getByTestId("ward-console-step-back-stage"));

    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";

    // The ward's release keeps its own generic stage line, by "ward".
    expect(page).toContain("by ward");
    // Exactly ONE correction line, and it belongs to the coordinator. Two would mean the ward's
    // release had been relabelled as a correction it did not make.
    expect(page.split("Stage record corrected").length - 1, "an act was relabelled as another actor's").toBe(1);
    expect(page).toContain("Stage record corrected to Destination review, by coordinator");
    // ⚠️ The control for this control: the collision really was constructed. If the two acts landed
    // at different instants, the mutation this test exists for would not be reachable and the
    // assertions above would prove nothing.
    expect(page).toContain("Stage Bed pulled → Accepted, awaiting bed, by ward");
  });

  it("counts itself honestly in the blurb a coordinator reads", () => {
    // The page states how many controls it offers. A conditional control that did not move that
    // sentence would make the page lie about itself.
    renderWorkspaceWithControls("WF-003");
    expect(screen.getByTestId("ward-patient-workspace").textContent ?? "").toContain("Five controls");

    // Stepping back behind the booking leaves an active transport job with no bed held (an orphaned
    // transport control), so the blurb honestly counts Six controls.
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    fireEvent.click(screen.getByTestId("test-book-transport"));
    fireEvent.click(screen.getByTestId("test-step-back"));
    expect(screen.getByTestId("ward-patient-orphaned-transport")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-workspace").textContent ?? "").toContain("Six controls");

    // Owner ruling 2026-09-25: RELEASE_PULL refuses while a transport job is booked, so the job is
    // cancelled first; the release then leaves no orphaned transport job — the count remains Five.
    cleanup();
    renderWorkspaceWithControls("WF-003");
    expect(screen.getByTestId("ward-patient-workspace").textContent ?? "").toContain("Five controls");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    fireEvent.click(screen.getByTestId("test-book-transport"));
    fireEvent.click(screen.getByTestId("test-cancel-transport"));
    fireEvent.click(screen.getByTestId("test-release-pull"));
    expect(screen.queryByTestId("ward-patient-orphaned-transport")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-workspace").textContent ?? "").toContain("Five controls");
  });
});

describe("the prompt that tells the sending team a bed is ready to book against", () => {
  /**
   * 🔴 **`TR-D4`'s MITIGATION, WHICH NEVER SHIPPED WHILE THE COST IT MITIGATES DID.** `TR-D1` puts
   * booking on the SENDING team, and its recorded cost is that they have the weakest reason to
   * chase it — the patient is leaving them either way. `TR-D4` is the answer: the receiving ward,
   * which knows when it is ready, triggers them, **so they are not relying on their own memory.**
   * `TR-D1` shipped; its mitigation did not, and the ledger's status audit named it the one row to
   * act on.
   *
   * ⚠️ **NO NEW EVENT AND NO NEW FIELD.** The readiness signal already exists and it is
   * `PULL_PATIENT`, which `BOOK_TRANSPORT` refuses to run before. What was missing was somebody
   * being told.
   */
  it("says nothing while no bed is held — the prompt is about a bed, not about a referral", () => {
    renderWorkspaceWithControls("WF-003");
    expect(
      within(screen.getByTestId("ward-console-attention")).queryByText(/no transport job exists/i),
    ).not.toBeInTheDocument();
  });

  it("fires the moment the ward pulls, and names the ward holding the bed", () => {
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const rail = screen.getByTestId("ward-console-attention");
    expect(within(rail).getByText(/has a bed held for this patient and no transport job exists/i)).toBeInTheDocument();
    // The ward is named because "a bed is ready" without saying whose is not actionable.
    expect(within(rail).getByText(/Dabakarn/)).toBeInTheDocument();
    expect(within(rail).getByText(/Not booked/i)).toBeInTheDocument();
  });

  it("stops the moment a job exists — the control that keeps it from nagging", () => {
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    expect(
      within(screen.getByTestId("ward-console-attention")).getByText(/no transport job exists/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("test-book-transport"));
    expect(
      within(screen.getByTestId("ward-console-attention")).queryByText(/no transport job exists/i),
    ).not.toBeInTheDocument();
  });

  it("⚠️ never fires against somebody's answer that no transport is needed", () => {
    /*
     * "Not needed" is an ANSWER, not a gap. Prompting a booking against it would be the software
     * overriding a person who recorded a decision — the thing `MovementTransportNeed`'s own doc
     * comment forbids collapsing, and the reason `transportNeedState` keeps three states.
     */
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-transport-not-needed"));
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const rail = screen.getByTestId("ward-console-attention");
    expect(within(rail).queryByText(/no transport job exists/i)).not.toBeInTheDocument();
    expect(within(rail).queryByText(/transport is recorded as needed/i)).not.toBeInTheDocument();
  });

  it("says something different once transport IS recorded as needed", () => {
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-transport-needed"));
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const rail = screen.getByTestId("ward-console-attention");
    // Answered: the only thing outstanding is the booking itself.
    expect(within(rail).getByText(/transport is recorded as needed, but no job has been raised/i)).toBeInTheDocument();
    // Unanswered wording must NOT also be present — one sentence per situation.
    expect(within(rail).queryByText(/that answer is owed first/i)).not.toBeInTheDocument();
  });

  it("🔴 sends the reader to the ward before the provider — owner ruling 17", () => {
    /*
     * ⚠️ **OWNER RULING 17, 2026-09-06, read at source before this was written:** *"It stays a
     * convenience, and a 'confirm with the ward' step goes on any placement action."* The hazard he
     * settled is drift — **a good board becomes the source of truth without anybody deciding it
     * has**, and he decided it has not.
     *
     * **This prompt is exactly that shape.** It reads a bed off the board and tells somebody to
     * commit a real vehicle to it, and the board can be behind: `RELEASE_PULL` hands the bed back
     * and only this page knows. A booking on a stale figure is a crew dispatched to a bed that is
     * gone — the defect the orphaned-job surface catches AFTER the fact. Confirming first is what
     * stops it happening.
     */
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const rail = screen.getByTestId("ward-console-attention");
    expect(within(rail).getByText(/ring the ward and confirm the bed before booking/i)).toBeInTheDocument();
    expect(within(rail).getByText(/convenience, not the record/i)).toBeInTheDocument();
  });

  it("carries the ruling in BOTH wordings of the prompt, in the same words", () => {
    /*
     * The prompt says something different depending on whether the transport question has been
     * answered. **A ruling that reached only one branch would be absent exactly when a coordinator
     * is least sure what to do** — and two hand-typed copies of his sentence would be two rulings.
     * One constant, asserted from both branches.
     */
    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-transport-needed"));
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const answered = screen.getByTestId("ward-console-attention").textContent ?? "";
    cleanup();

    renderWorkspaceWithControls("WF-003");
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const unanswered = screen.getByTestId("ward-console-attention").textContent ?? "";

    const clause = "Ring the ward and confirm the bed before booking — this board is a convenience, not the record.";
    expect(answered, "the answered branch does not carry the ruling").toContain(clause);
    expect(unanswered, "the unanswered branch does not carry the ruling").toContain(clause);
  });

  it("⚠️ does not put the ruling on prompts that are not placement actions", () => {
    /*
     * ⚠️ **THE CONTROL, AND IT IS ABOUT SCOPE RATHER THAN PRESENCE.** Ruling 17 obliges a confirm
     * step on a PLACEMENT action. Printing it on every sentence on the page would make it wallpaper
     * — a caveat a reader stops seeing is a caveat that is not there — and it would also read as
     * "nothing here is reliable", which the ruling explicitly does not license: **it bounds the
     * claim, not the care.**
     *
     * The urgent-flag control records a fact about this patient and commits nothing to a ward, so it
     * must not carry it.
     */
    renderWorkspaceWithControls("WF-003");
    const urgent = screen.getByTestId("ward-patient-urgent-flag").textContent ?? "";
    expect(urgent).not.toContain("convenience, not the record");
    // And the clause appears once, not on every rail item.
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const page = screen.getByTestId("ward-patient-workspace").textContent ?? "";
    expect(page.split("convenience, not the record").length - 1, "the ruling is repeated on the page").toBe(1);
  });

  it("⚠️ never puts two transport items in the rail at once", () => {
    /*
     * 🔴 **THE FAILURE THIS RAIL WAS CORRECTED FOR IN SEPTEMBER.** Two items about transport, on one
     * movement, at one moment, reads as two systems each noticing something — and a coordinator
     * trusts neither. The pre-existing "nobody has recorded whether transport is needed" item and
     * this new one are made exclusive by a stage boundary, and `pulled` is that boundary for BOTH
     * so no stage falls between them.
     *
     * Asserted by COUNTING the rail's transport rows across the boundary, not by reading one of
     * them — a test that checked only the new item would pass with both on screen.
     */
    /*
     * ⚠️ COUNTS ROWS, NOT TEXT MATCHES, and the first draft of this counted matches and reported 2
     * where the truth was 1: an attention row carries the word "transport" in BOTH its `who` label
     * and its `say` sentence, so every single row scored two. A count is only a count of the thing
     * you meant if the unit is right.
     */
    const transportRows = () =>
      [...screen.getByTestId("ward-console-attention").querySelectorAll("li")].filter((row) =>
        /transport/i.test(row.textContent ?? ""),
      ).length;

    renderWorkspaceWithControls("WF-003");
    const beforePull = transportRows();
    fireEvent.click(screen.getByTestId("test-pull-patient"));
    const afterPull = transportRows();

    // Before the pull: the "is it needed" item. After it: the "book it" item. Never both, and
    // never none — a boundary that dropped a stage would show as 0 on one side.
    expect(beforePull, "no transport item before the pull, so the boundary drops a stage").toBeGreaterThan(0);
    expect(afterPull, "no transport item after the pull, so the boundary drops a stage").toBeGreaterThan(0);
    expect(beforePull, "two transport items at once before the pull").toBe(1);
    expect(afterPull, "two transport items at once after the pull").toBe(1);
  });
});
