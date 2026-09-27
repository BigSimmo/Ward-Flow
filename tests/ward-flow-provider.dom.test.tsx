import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { absoluteWallClockMinutes, wallClockNow } from "@/components/ward-management/ward-clock";
import type { DischargeOpenHandle } from "@/components/ward-management/ward-discharge-records";
import { WardFlowProvider, useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Only `wallClockNow` is mocked — `elapsedMinutesSinceMount` and every other export stay real,
// so this proves the provider's own accumulation logic, not a stand-in for it.
vi.mock("@/components/ward-management/ward-clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-clock")>();
  return {
    ...actual,
    wallClockNow: vi.fn(actual.wallClockNow),
    absoluteWallClockMinutes: vi.fn(actual.absoluteWallClockMinutes),
  };
});

function Probe() {
  const { movements, units, rejections } = useWardFlow();
  const now = useWardFlowClock();
  return (
    <ul>
      <li data-testid="movements">{movements.length}</li>
      <li data-testid="units">{units.length}</li>
      <li data-testid="now">{now}</li>
      <li data-testid="rejections">{rejections.length}</li>
    </ul>
  );
}

/** Adds a control that raises a real, role-gated demo event, so a test can prove `dispatch`
 * is wired to the live reducer rather than being a no-op or resetting state on re-render. */
function DispatchProbe() {
  const { now, dispatch } = useWardFlow();
  return (
    <div>
      <span data-testid="now">{now}</span>
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 })}>
        advance
      </button>
    </div>
  );
}

describe("WardFlowProvider", () => {
  it("seeds the fixture and holds the clock at the injected instant", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
      </WardFlowProvider>,
    );
    // 48 -> 50 on 2026-08-30: WF-019 and WF-020, the two movements that have waited longer than a
    // day. Every other seeded wait caps at about sixteen hours, so until they existed the day-scale
    // clock work had nothing on the fixture to display.
    // 50 -> 61: the 17 Sept sample-data addition, WF-021..WF-031.
    // The current fixture includes 17 explicit rulings demonstrations on top of those 60.
    expect(screen.getByTestId("movements")).toHaveTextContent("77");
    // Was 22 before Phase 7 (spec "The front door") added `bty-youth` (East Metropolitan Youth
    // Unit) to the fixture in `ward-sites.ts`.
    // Back to 22 on 26 Sept 2026: Kununurra has no ward (owner-approved ward facts).
    expect(screen.getByTestId("units")).toHaveTextContent("22");
    expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR));
    expect(screen.getByTestId("rejections")).toHaveTextContent("0");
  });

  describe("a pinned clock other than the fixture's own anchor", () => {
    // Every other `initialNow` call site in the suite passes `NOW_ANCHOR`, which is exactly why
    // the prop's value being discarded was invisible: `NOW_ANCHOR + 0` and `initialNow` agree
    // when — and only when — the pinned instant IS `NOW_ANCHOR`. Nothing below may use
    // `NOW_ANCHOR` as the pinned value, or it stops testing anything.
    const PINNED_BEFORE_ANCHOR = 7 * 60 + 30; // 07:30 — before the 08:00 morning handover.
    const PINNED_AFTER_ANCHOR = 21 * 60 + 5; // 21:05 — a late-evening clock.

    it("reports the pinned instant as `now`, not the fixture anchor", () => {
      render(
        <WardFlowProvider initialNow={PINNED_BEFORE_ANCHOR}>
          <Probe />
        </WardFlowProvider>,
      );
      expect(screen.getByTestId("now")).toHaveTextContent(String(PINNED_BEFORE_ANCHOR));
      // Named explicitly so a regression that silently reverts to the anchor cannot pass by
      // coincidence, and so the failure message says which clock was actually served.
      expect(screen.getByTestId("now")).not.toHaveTextContent(String(NOW_ANCHOR));
    });

    it("reports a pinned instant later than the anchor too, so the fix is not a one-sided offset", () => {
      render(
        <WardFlowProvider initialNow={PINNED_AFTER_ANCHOR}>
          <Probe />
        </WardFlowProvider>,
      );
      expect(screen.getByTestId("now")).toHaveTextContent(String(PINNED_AFTER_ANCHOR));
    });

    it("still applies the in-app clock offset on top of the pinned instant", () => {
      // The offset must layer onto the pinned clock, not replace it — otherwise pinning would
      // work only until the first `ADVANCE_CLOCK`, which is how the demo controls move time.
      render(
        <WardFlowProvider initialNow={PINNED_BEFORE_ANCHOR}>
          <DispatchProbe />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      expect(screen.getByTestId("now")).toHaveTextContent(String(PINNED_BEFORE_ANCHOR + 15));
    });

    it("still refuses to tick when pinned away from the anchor", () => {
      // The value being honoured must not have cost the prop its other job: a pinned provider
      // never starts the interval, whatever instant it was pinned to.
      const setIntervalSpy = vi.spyOn(window, "setInterval");
      try {
        render(
          <WardFlowProvider initialNow={PINNED_BEFORE_ANCHOR}>
            <Probe />
          </WardFlowProvider>,
        );
        expect(setIntervalSpy).not.toHaveBeenCalled();
      } finally {
        setIntervalSpy.mockRestore();
      }
    });
  });

  it("refuses to be used outside the provider rather than returning an empty world", () => {
    // Conservative failure: a component rendered outside the provider must fail loudly, not
    // silently render zero patients, which would read as a quiet night.
    expect(() => render(<Probe />)).toThrow(/WardFlowProvider/);
  });

  describe("with the wall clock spied", () => {
    let setIntervalSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      setIntervalSpy = vi.spyOn(window, "setInterval");
    });

    afterEach(() => {
      setIntervalSpy.mockRestore();
    });

    it("never starts the ticking interval when a test pins the clock", () => {
      // This is the exact failure mode the brief calls out by name: a clock that ticks in
      // tests makes every later screen test flaky. `initialNow` must short-circuit the
      // interval entirely, not just cap its visible effect.
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Probe />
        </WardFlowProvider>,
      );
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });

  it("dispatches through the live reducer and keeps the result across re-renders, rather than a no-op or a silent re-seed", () => {
    // Neither test above ever calls `dispatch`. Without this, a `dispatch` wired to a no-op,
    // or a provider that quietly re-seeds its state on every render, would still pass every
    // other check here.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DispatchProbe />
      </WardFlowProvider>,
    );
    const button = screen.getByRole("button", { name: "advance" });
    fireEvent.click(button);
    expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR + 15));
    // A second dispatch must accumulate onto the first, not restart from the seeded state.
    fireEvent.click(button);
    expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR + 30));
  });

  describe("wall-clock elapsed time beyond one day", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.mocked(wallClockNow).mockReset();
      vi.mocked(absoluteWallClockMinutes).mockReset();
    });

    it("keeps accumulating elapsed minutes past a full day, which is now true by construction", () => {
      /*
       * REWRITTEN 2026-08-30. The property is unchanged and the mechanism is gone.
       *
       * The original defect: `wallClockNow()` returns a minute of the day, so a dashboard mounted for
       * exactly 24 hours read the same value again, the difference landed on zero, and elapsed time
       * silently reset - moving every deadline, wait and expired hold on every screen backward by up
       * to a day. It was fixed by accumulating each 30s delta so no comparison ever reached back to
       * the original mount instant.
       *
       * The provider now reads `absoluteWallClockMinutes()`, which carries the date. Two readings
       * cannot alias, so elapsed time is a plain subtraction and the rollover class cannot occur at
       * all. This test therefore no longer reproduces a rollover - there is none to reproduce - and
       * asserts the surviving property directly: 1,500 minutes of real time, past a full day, must
       * read as 1,500 minutes.
       *
       * It still bites. Regress the provider to a minute-of-day clock and the mocked absolute reading
       * stops being consulted, elapsed collapses to zero, and the final assertion fails.
       */
      const startMinute = 600; // 10:00, the minute-of-day the demo anchors onto
      const mountAbsolute = 29_000_000; // an arbitrary absolute minute; only the difference matters
      const elapsedMinutes = 1_500; // past one full day (1,440)

      vi.mocked(wallClockNow).mockImplementation(() => startMinute);
      vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute);

      render(
        <WardFlowProvider>
          <Probe />
        </WardFlowProvider>,
      );
      // The re-anchor: an unpinned provider mounting while the wall clock reads 10:00 shows 10:00,
      // not the fixture's authored 10:42.
      expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR));

      vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute + elapsedMinutes);
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(
        screen.getByTestId("now"),
        "elapsed time did not survive a span longer than a day. The provider must read an absolute " +
          "clock; a minute-of-day reading aliases every 24 hours and silently resets elapsed time to " +
          "zero, moving every deadline and wait on every screen backward by up to a day.",
      ).toHaveTextContent(String(NOW_ANCHOR + elapsedMinutes));
    });
  });

  describe("sessionStorage demo state persistence", () => {
    function PersistProbe() {
      const { now, dispatch, resetDemoState, movements } = useWardFlow();
      return (
        <div>
          <span data-testid="now">{now}</span>
          <span data-testid="movements-count">{movements.length}</span>
          <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 20 })}>
            advance
          </button>
          <button type="button" onClick={() => resetDemoState()}>
            reset
          </button>
        </div>
      );
    }

    beforeEach(() => {
      window.sessionStorage.clear();
    });

    afterEach(() => {
      window.sessionStorage.clear();
    });

    it("persists state to sessionStorage on state changes in live mode", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );

      const stored = window.sessionStorage.getItem("ward-flow-demo-state-v1");
      expect(stored).not.toBeNull();
      // The payload wraps the reducer state alongside the clock facts a restore needs to validate
      // (defect 3b) — the state itself now lives at `.state`, not at the payload's own top level.
      const parsed = JSON.parse(stored!);
      // 50 -> 61: the 17 Sept sample-data addition, WF-021..WF-031.
      // Includes the 17 explicit rulings demonstrations as well as the ordinary fixture.
      expect(parsed.state.movements).toHaveLength(77);

      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      const updated = window.sessionStorage.getItem("ward-flow-demo-state-v1");
      const parsedUpdated = JSON.parse(updated!);
      expect(parsedUpdated.state.clockOffsetMinutes).toBe(20);

      unmount();
    });

    it("hydrates from sessionStorage in unpinned live mode", () => {
      // Y4 privacy remediation, 2026-09-17 (Opus finding F4): this test used to carry a hidden
      // dependency on the two renders below landing inside the same real wall-clock minute, because
      // the provider discarded a save whose `anchorOffsetMinutes` no longer matched exactly. That
      // check is gone — the anchor is recomputed fresh at every mount and is no longer compared
      // against the save at all (see `tryReadDemoState`'s own comment) — so this restore is now
      // correct regardless of whether a real minute boundary falls between the two `render()` calls.
      const { unmount: firstUnmount } = render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      firstUnmount();

      render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      const stored = window.sessionStorage.getItem("ward-flow-demo-state-v1");
      const parsed = JSON.parse(stored!);
      expect(parsed.state.clockOffsetMinutes).toBe(40);
    });

    it("clears sessionStorage and resets state on resetDemoState()", () => {
      render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      expect(JSON.parse(window.sessionStorage.getItem("ward-flow-demo-state-v1")!).state.clockOffsetMinutes).toBe(20);

      fireEvent.click(screen.getByRole("button", { name: "reset" }));
      const stored = window.sessionStorage.getItem("ward-flow-demo-state-v1");
      expect(JSON.parse(stored!).state.clockOffsetMinutes).toBe(0);
    });

    it("never touches sessionStorage when clock is pinned (test mode)", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PersistProbe />
        </WardFlowProvider>,
      );
      expect(window.sessionStorage.getItem("ward-flow-demo-state-v1")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      expect(window.sessionStorage.getItem("ward-flow-demo-state-v1")).toBeNull();
    });
  });

  /*
   * Audit finding ISSUE-P1-83 (2026-09-16), defect 3. Owner ruling relayed mid-task: KEEP and FIX
   * Gemini's session persistence rather than remove it (defects 1, 2, 4, 5 are unchanged). These
   * tests pin the fix's properties: a save that no longer describes today's world (wrong schema
   * version, a different day) is discarded rather than replayed with shifted times; a save whose
   * clock anchor differs is RESTORED rather than discarded (Opus finding F4 — see the "restores a
   * save from a different clock anchor" test below, which is the corrected half of this comment,
   * itself corrected 2026-09-17 after previously — and wrongly — claiming an anchor mismatch was
   * discarded); a save missing a field the reducer's state actually needs is discarded rather than
   * patched with an invented default; and the discharge-record request-id counter continues past a
   * restored audit log rather than restarting at 0. Whether free text ever reaches storage (D-11) is
   * covered by `tests/ward-flow-provider-persistence-privacy.dom.test.tsx`, not by this block.
   *
   * Fake timers pin `new Date()` (and therefore `wallClockNow()`/`demoDayZero()`, both real
   * implementations under the module mock at the top of this file) to one instant, so
   * `anchorOffsetMinutes` and `dayZero` are fully deterministic across a render/unmount/render cycle
   * — the only way to construct a controlled "different day" or "different anchor" scenario.
   * `FIXED_SYSTEM_TIME`'s time-of-day is chosen to equal `NOW_ANCHOR` exactly (10:42), so
   * `anchorOffsetMinutes` is 0 on the unshifted path and every assertion below reads a plain,
   * unshifted `clockOffsetMinutes` off the stored payload rather than fighting clock arithmetic.
   */
  describe("demo state persistence — schema version, clock honesty, request-id continuity", () => {
    const STORAGE_KEY = "ward-flow-demo-state-v1";
    const FIXED_SYSTEM_TIME = new Date(2026, 8, 16, 10, 42, 0);

    function PersistProbe() {
      const { now, movements, dispatch } = useWardFlow();
      return (
        <div>
          <span data-testid="now">{now}</span>
          {/* One seeded instant, read straight from context rather than only from storage — proves
           *  the RESTORED, in-memory world carries it unshifted, not merely that the JSON does. */}
          <span data-testid="first-movement-opened-at">{movements[0]?.openedAt}</span>
          <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 20 })}>
            advance
          </button>
        </div>
      );
    }

    function readStoredState(): { version: number; state: Record<string, unknown> } {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error("Expected a stored demo payload");
      return JSON.parse(raw);
    }

    beforeEach(() => {
      window.sessionStorage.clear();
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_SYSTEM_TIME);
    });

    afterEach(() => {
      window.sessionStorage.clear();
      vi.useRealTimers();
    });

    it("keeps seeded Referral.history and Movement.blocker text intact — D-11 is now enforced by default-deny, not by blanking", () => {
      // Y4 privacy remediation, 2026-09-17 (Opus findings F2/F3/F7): this test used to assert the
      // OPPOSITE — that `sanitizeForStorage` blanked every `Movement.blocker` and `Referral.history`
      // to `""` before a write, seeded or typed alike. That was itself the defect: after a restore
      // the console showed every movement as `Blocked — Somebody wrote: ""`, the priority queue lost
      // its obstruction points, and every history read "Not written yet". D-11's actual concern is
      // runtime-TYPED text on a shared computer, and the fixture's own seeded prose is not a
      // disclosure — it ships inside the application bundle already. Protection now comes from
      // `WARD_FLOW_TYPED_TEXT_EVENT_TYPES`'s default-deny gate (see the new
      // `ward-flow-provider-persistence-privacy.dom.test.tsx` for typed-text coverage), so a session
      // that has dispatched nothing off that allowlist persists the seed's own prose unchanged.
      render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      const { state } = readStoredState();
      const movements = state.movements as { blocker: string }[];
      const referrals = state.referrals as { history: string }[];
      // The fixture seeds real prose into both fields — a check against an already-empty fixture
      // would pass whether or not persistence ran at all.
      expect(movements.length).toBeGreaterThan(0);
      expect(referrals.length).toBeGreaterThan(0);
      expect(movements.some((movement) => movement.blocker !== "")).toBe(true);
      expect(referrals.some((referral) => referral.history !== "")).toBe(true);
    });

    it("discards a save written by a schema version this build no longer writes", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      const stored = readStoredState();
      expect(stored.state.clockOffsetMinutes).toBe(20);
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, version: stored.version - 1 }));
      unmount();

      render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      expect(readStoredState().state.clockOffsetMinutes).toBe(0);
    });

    it("discards a save from yesterday rather than restoring it with shifted times", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      expect(readStoredState().state.clockOffsetMinutes).toBe(20);
      unmount();

      // Same time of day, one calendar day later — anchorOffsetMinutes is unchanged; only dayZero
      // moves, isolating this discard-on-a-different-day case from the different-anchor case below
      // (which restores rather than discards — see that test's own comment, F4).
      vi.setSystemTime(new Date(FIXED_SYSTEM_TIME.getTime() + 24 * 60 * 60_000));
      render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      expect(readStoredState().state.clockOffsetMinutes).toBe(0);
    });

    it("restores a save from a different clock anchor on the same day, rather than discarding it (F4)", () => {
      // Y4 privacy remediation, 2026-09-17 (Opus finding F4): this test used to assert the OPPOSITE
      // — that a save from a different `anchorOffsetMinutes` was discarded. That was the defect, not
      // a safeguard: the anchor is minutes since local midnight, so it advances by one on every real
      // minute that passes, and the exact-equality check this test pinned meant a reload even sixty
      // seconds after a save discarded a save that described the CURRENT world perfectly — "almost
      // never restores" in practice. See `tryReadDemoState`'s own comment for why dropping the
      // check is correct: `now` is recomputed from the live wall clock at every mount regardless, so
      // a fresh anchor reproduces real elapsed time rather than misdescribing the restored state.
      const { unmount } = render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      expect(readStoredState().state.clockOffsetMinutes).toBe(20);
      // `FIXED_SYSTEM_TIME`'s time-of-day equals `NOW_ANCHOR` exactly, so `anchorOffsetMinutes` is 0
      // here: `now = NOW_ANCHOR + 0 + elapsed(0) + clockOffsetMinutes(20) = NOW_ANCHOR + 20`.
      expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR + 20));
      const openedAtBefore = screen.getByTestId("first-movement-opened-at").textContent;
      expect(
        openedAtBefore,
        "the fixture's first movement must carry an openedAt, or nothing below is exercised",
      ).not.toBe("");
      unmount();

      // Same calendar day, one wall-clock minute later — dayZero is unchanged; only the minute the
      // anchor is recomputed from moves.
      vi.setSystemTime(new Date(FIXED_SYSTEM_TIME.getTime() + 60_000));
      render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      expect(readStoredState().state.clockOffsetMinutes).toBe(20);
      // 🔴 P3 finding 8: strengthened beyond `clockOffsetMinutes` alone. The restored `now` must be
      // exactly one minute AHEAD of what it was before the reload — `anchorOffsetMinutes` is now 1
      // (`wallClockNow() - NOW_ANCHOR` one real minute later), so
      // `now = NOW_ANCHOR + 1 + elapsed(0) + clockOffsetMinutes(20)` — proving `now` tracks real
      // elapsed time across the reload rather than either freezing or jumping by more than the
      // minute that actually passed. And the seeded `openedAt` this test captured before the reload
      // must come back byte-for-byte identical: an `Instant` is a fixed point once written, and
      // dropping the anchor-equality check must not, as a side effect, start re-deriving it from the
      // new anchor.
      expect(screen.getByTestId("now")).toHaveTextContent(String(NOW_ANCHOR + 21));
      expect(screen.getByTestId("first-movement-opened-at")).toHaveTextContent(openedAtBefore!);
    });

    it("discards a save missing one field the reducer's state requires, rather than filling in an invented default", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      const stored = readStoredState();
      expect(stored.state.notices).toBeDefined();
      const { notices: _notices, ...stateWithoutNotices } = stored.state;
      void _notices;
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, state: stateWithoutNotices }));
      unmount();

      render(
        <WardFlowProvider>
          <PersistProbe />
        </WardFlowProvider>,
      );
      expect(readStoredState().state.clockOffsetMinutes).toBe(0);
    });

    it("continues the discharge-record request-id counter past a restored audit log, so a request after restore is neither denied as a replay nor left unaudited", () => {
      const coordinator = { role: "coordinator" } as const;
      let current: ReturnType<typeof useWardFlow> | undefined;
      function RecordProbe() {
        const value = useWardFlow();
        useEffect(() => {
          current = value;
        });
        return null;
      }

      const first = render(
        <WardFlowProvider>
          <RecordProbe />
        </WardFlowProvider>,
      );
      const records = current!.readDischargeRecords(coordinator);
      if (records.status !== "allowed" || records.value.length < 2) {
        throw new Error("Fixture must carry at least two discharge-eligible admissions");
      }
      const [recordA, recordB] = records.value;

      // Two requests against recordA before the restore, so the restored audit log's requestIds
      // are 0 and 1 — the exact range a reset-to-0 counter would collide back into.
      act(() => {
        current!.openDischargeRecord(coordinator, recordA.admissionId);
      });
      act(() => {
        current!.openDischargeRecord(coordinator, recordA.admissionId);
      });
      first.unmount();

      const second = render(
        <WardFlowProvider>
          <RecordProbe />
        </WardFlowProvider>,
      );
      let handleForB: DischargeOpenHandle | null = null;
      act(() => {
        handleForB = current!.openDischargeRecord(coordinator, recordB.admissionId);
      });
      const read = current!.readDischargeRecord(coordinator, recordB.admissionId, handleForB!);
      // A reset-to-0 counter reuses requestId 0, which the restored log already ties to recordA —
      // `readDischargeRecord` would find that stale receipt, see its admissionId disagree with
      // recordB, and refuse this genuine request as though it were a replay.
      expect(read.status).toBe("allowed");
      second.unmount();
    });
  });
});
