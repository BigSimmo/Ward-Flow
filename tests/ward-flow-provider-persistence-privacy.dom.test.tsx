import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { COHORTS, HOME_REGIONS, REFERRAL_SOURCES, TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";
import {
  WARD_FLOW_DEMO_STORAGE_KEY,
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
  WARD_FLOW_TYPED_TEXT_EVENT_TYPES,
  WardFlowProvider,
  findWardFlowEventTypeCoverageGaps,
  useWardFlow,
} from "@/components/ward-management/ward-flow-provider";

/*
 * Y4 privacy remediation, 2026-09-17 — Opus adversarial review findings F2, F3, F4, F7 (round 1)
 * and P2/P3 findings 1–8 (round 2, "fix round from the Opus privacy review"). These tests pin the
 * DEFAULT-DENY replacement for the old two-field blanking scheme:
 *
 *   - a session that has DISPATCHED a typed-text-carrying event — accepted OR refused — never writes
 *     another byte to `sessionStorage`, from that dispatch onward, for the rest of the session (P2
 *     findings 4–6: locking used to require ACCEPTANCE, read off `rejections.length`; the controller
 *     redesigned it to lock on dispatch alone, because a rejection record can itself quote the typed
 *     payload back, and because dispatch-based locking needed no proof that every rejection path was
 *     accounted for);
 *   - a session that has dispatched only allowlisted events persists the seed's own prose unchanged
 *     rather than blanking it (F3 — covered directly in `ward-flow-provider.dom.test.tsx`'s D-11
 *     test; this file asserts the accompanying default-deny half);
 *   - `state.configuration` is validated on restore, not trusted;
 *   - a demo reset re-enables persistence after a typed-text lock, however it was dispatched;
 *   - the union-coverage guard (event type NAMES) fails the moment a new event type is added to
 *     `WardFlowEvent` without a decision recorded on one of the two lists; the SEPARATE compile-time
 *     guard (payload SHAPE) lives in `ward-flow-provider.tsx` itself and is proven by
 *     `tests/ward-flow-provider-safe-payload-shape-guard.test.ts`, not by anything runtime here.
 *
 * No clock mock is installed here (unlike `ward-flow-provider.dom.test.tsx`'s top-of-file
 * `vi.mock("@/components/ward-management/ward-clock", …)`): `vi.useFakeTimers()` plus
 * `vi.setSystemTime(...)` alone is enough, because the real `wallClockNow()`/`demoDayZero()` both
 * read `new Date()`, which fake timers already control — the same approach this file's sibling
 * "demo state persistence — schema version, clock honesty" describe block already relies on.
 */
describe("ward-flow-provider default-deny persistence privacy", () => {
  const FIXED_SYSTEM_TIME = new Date(2026, 8, 17, 10, 42, 0);

  function readStoredState(): { version: number; state: Record<string, unknown> } | null {
    const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  let current: ReturnType<typeof useWardFlow> | undefined;
  function Capture() {
    current = useWardFlow();
    return null;
  }

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_SYSTEM_TIME);
    current = undefined;
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  describe("typed-text events lock persistence for the rest of the session, on DISPATCH", () => {
    it("writes no payload once ADD_PATIENT carrying a typed given name is dispatched, and a remount finds nothing to restore", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      // The seeded world persists before any typed text — proves the lock is triggered BY the typed
      // event below, not by persistence being broken from the start.
      expect(readStoredState()).not.toBeNull();

      act(() => {
        current!.dispatch({
          type: "ADD_PATIENT",
          role: "coordinator",
          now: current!.now,
          umrn: "UMRN-TEST-001",
          givenName: "Josephine",
          familyName: "Typiste",
          dateOfBirth: "1990-01-01",
        });
      });
      expect(readStoredState()).toBeNull();
      // A patient really was added — this is a genuine acceptance, so the "even a rejected one
      // locks" property is left to its own test below rather than conflated with this one.
      expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(true);

      // The lock outlives the triggering dispatch: a later ALLOWLISTED event must not resurrect a
      // payload, let alone one containing the typed name.
      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
      });
      expect(readStoredState()).toBeNull();

      // 🔴 P3 finding 8: "nothing later restores it" was asserted only within the SAME mounted
      // session — the property that actually matters is that a REMOUNT, which is the only way this
      // storage is ever read back at all, finds nothing OF THE LOCKED SESSION's to restore. Unmount
      // and remount to prove it directly, rather than trusting that a null `sessionStorage` key
      // implies a null restore. The fresh mount legitimately WRITES its own payload again — nothing
      // was left to restore, so it reseeds from the fixture and that fresh (safe) world persists as
      // normal — so the proof is that the typed name never comes back, not that storage stays empty.
      unmount();
      render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(false);
      const restored = readStoredState();
      expect(restored).not.toBeNull();
      expect(JSON.stringify(restored)).not.toContain("Josephine");
    });

    it("writes no payload once RECORD_MOVEMENT_BLOCKER carrying typed text is dispatched", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const movement = current!.movements.find((candidate) => !candidate.closure);
      if (!movement) throw new Error("Fixture must carry at least one open movement");

      act(() => {
        current!.dispatch({
          type: "RECORD_MOVEMENT_BLOCKER",
          role: "coordinator",
          now: current!.now,
          movementId: movement.id,
          blocker: "Waiting on the family, who are driving up from Bunbury this afternoon",
        });
      });
      expect(readStoredState()).toBeNull();
      const updated = current!.movements.find((candidate) => candidate.id === movement.id);
      expect(updated?.blocker).toContain("Bunbury");
      unmount();
    });

    /**
     * 🔴 P2 findings 4–6, and the whole reason for the redesign: a REJECTED typed-text dispatch now
     * locks too. `RECORD_MOVEMENT_BLOCKER` refuses a blank blocker (`ward-flow-reducer.ts`'s own
     * case), so this dispatch is genuinely turned away — `rejections` grows and `blocker` is never
     * written — and the lock must engage anyway, because the finding is that a rejection record can
     * itself carry the typed payload back (`makeRejection`'s `reason` sometimes interpolates the
     * offending value), so "it was refused" is not "there was nothing to protect".
     */
    /**
     * Owner's third ruling, 2026-09-17: `BOOK_TRANSPORT` now carries a typed CAD transport number
     * (`cadNumber`), so the whole event moved from `WARD_FLOW_TEXT_SAFE_EVENT_TYPES` to
     * `WARD_FLOW_TYPED_TEXT_EVENT_TYPES` (`ward-flow-persistence-classification.ts`) — the same
     * "one typed field decides the event" rule `RECORD_MOVEMENT_BLOCKER` above already holds to.
     */
    it("writes no payload once BOOK_TRANSPORT carrying a typed CAD number is dispatched, and locks the session", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const movement = current!.movements.find((candidate) => candidate.stage === "pulled");
      if (!movement) throw new Error("Fixture must carry at least one bed-pulled movement");

      act(() => {
        current!.dispatch({
          type: "BOOK_TRANSPORT",
          role: "ed",
          now: current!.now,
          movementId: movement.id,
          provider: TRANSPORT_PROVIDERS[0],
          escortRequired: true,
          cadNumber: "CAD-2026-0917",
          transportLegalStatus: "voluntary",
          estimatedAt: current!.now + 30,
        });
      });
      expect(current!.rejections).toEqual([]);
      const updated = current!.movements.find((candidate) => candidate.id === movement.id);
      expect(updated?.transport?.cadNumber).toBe("CAD-2026-0917");
      expect(readStoredState()).toBeNull();

      // And still locked: an allowlisted event afterwards must not be written.
      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
      });
      expect(readStoredState()).toBeNull();
      unmount();
    });

    it("locks persistence on a REJECTED RECORD_MOVEMENT_BLOCKER dispatch too, not only an accepted one", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const movement = current!.movements.find((candidate) => !candidate.closure);
      if (!movement) throw new Error("Fixture must carry at least one open movement");
      const rejectionsBefore = current!.rejections.length;

      act(() => {
        current!.dispatch({
          type: "RECORD_MOVEMENT_BLOCKER",
          role: "coordinator",
          now: current!.now,
          movementId: movement.id,
          blocker: "",
        });
      });
      // Genuinely rejected, not accepted — the premise of this test.
      expect(current!.rejections.length).toBeGreaterThan(rejectionsBefore);
      const updated = current!.movements.find((candidate) => candidate.id === movement.id);
      expect(updated?.blocker).not.toBe("");

      // And still locked: an allowlisted event afterwards must not be written.
      expect(readStoredState()).toBeNull();
      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
      });
      expect(readStoredState()).toBeNull();
      unmount();
    });

    it("locks persistence on a REJECTED RECEIVE_REFERRAL dispatch (community intake)", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      act(() => {
        current!.dispatch({
          type: "RECEIVE_REFERRAL",
          role: "community",
          now: current!.now,
          ageBand: COHORTS[0],
          // Refused: "RECEIVE_REFERRAL needs at least one destination" — the first content check
          // this case makes after `ageBand`, so nothing past it (including `suburb`/`source`) needs
          // to resolve to anything real for this dispatch to be genuinely turned away.
          destinations: [],
          homeRegion: HOME_REGIONS[0],
          suburb: { kind: "named", name: "Test Suburb" },
          source: REFERRAL_SOURCES[0],
          urgency: 1,
          originSiteCode: "TEST-SITE",
          transportNeeded: false,
          history: "",
        });
      });
      expect(current!.rejections.length).toBeGreaterThan(0);
      expect(readStoredState()).toBeNull();
      unmount();
    });

    it("locks persistence on a REJECTED REFER_TO_COMMUNITY_TEAM dispatch", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const movement = current!.movements.find((candidate) => !candidate.closure);
      if (!movement) throw new Error("Fixture must carry at least one open movement");
      act(() => {
        current!.dispatch({
          type: "REFER_TO_COMMUNITY_TEAM",
          role: "ed",
          now: current!.now,
          movementId: movement.id,
          // Refused: not on `communityTeamOptions()` — `case "REFER_TO_COMMUNITY_TEAM"`'s own
          // membership check.
          team: "not-a-real-community-team",
        });
      });
      expect(current!.rejections.length).toBeGreaterThan(0);
      expect(readStoredState()).toBeNull();
      unmount();
    });

    it("locks persistence on a REJECTED RECORD_ESCALATION dispatch", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      act(() => {
        current!.dispatch({
          type: "RECORD_ESCALATION",
          role: "coordinator",
          now: current!.now,
          // Refused: "no movement found for id …" — no fixture movement carries this id.
          movementId: "not-a-real-movement-id",
          triedUnitIds: [],
          contact: "Duty psychiatrist",
        });
      });
      expect(current!.rejections.length).toBeGreaterThan(0);
      expect(readStoredState()).toBeNull();
      unmount();
    });

    /**
     * RB7 (build plan item 27, 2026-09-17): `ADD_REFERRAL_CORRECTION.note` is human-typed prose,
     * appended to `Referral.corrections` — the same shape `history` on `RECEIVE_REFERRAL` already
     * is, and D-11 CRITICAL per the build brief: this event must be classified NOT text-safe, and
     * this test is the proof that dispatching it (a genuine acceptance here — a correction really
     * is written) locks persistence exactly as the ADD_PATIENT test at the top of this block does.
     */
    it("writes no payload once ADD_REFERRAL_CORRECTION carrying a typed note is dispatched", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const referral = current!.referrals[0];
      if (!referral) throw new Error("Fixture must carry at least one referral");

      act(() => {
        current!.dispatch({
          type: "ADD_REFERRAL_CORRECTION",
          role: "coordinator",
          now: current!.now,
          referralId: referral.id,
          note: "Corrected: the patient's escort arrived at 14:05, not 14:00 as first written.",
        });
      });
      expect(readStoredState()).toBeNull();
      // A correction really was added — a genuine acceptance, so the "even a rejected one locks"
      // property is left to a different event's own test above rather than conflated with this one.
      const updated = current!.referrals.find((candidate) => candidate.id === referral.id);
      expect(updated?.corrections?.some((correction) => correction.note.includes("14:05"))).toBe(true);
      unmount();
    });

    /**
     * 🔴 P2 finding 1, second review round: a REFUSED dispatch of a SAFE-listed event now locks too
     * — not only a typed-text event type. `RECORD_TRANSPORT_NEED` is on
     * `WARD_FLOW_TEXT_SAFE_EVENT_TYPES` (its payload is `movementId`/`needed`, no free text field at
     * all), but `case "RECORD_TRANSPORT_NEED"` quotes an unresolved `movementId` straight into
     * `Rejection.reason` — confirmed by reading the reducer — so a caller passing MARKER TEXT as
     * `movementId` gets it echoed into `state.rejections`, which the OLD design would have happily
     * persisted (the event type itself was never on the typed-text list). The fix in
     * `trackWardFlowTypedTextDispatch`: lock on ANY rejection, whatever the event type.
     */
    // Josh, D-18 (25 Sept 2026, "Only for typed text"): a refused SAFE-listed dispatch no longer
    // stops saving. The privacy property this test exists for is unchanged: the marker the refusal
    // quotes must never reach storage, because refusal records are never written.
    it("keeps saving after a REJECTED SAFE-listed dispatch whose id quotes marker text, stores no refusal, and no stored string contains the marker", () => {
      const setItemSpy = vi.spyOn(window.sessionStorage, "setItem");
      try {
        const { unmount } = render(
          <WardFlowProvider>
            <Capture />
          </WardFlowProvider>,
        );
        const MARKER = "MARKER-ID-8f3c1a-NOT-A-REAL-MOVEMENT";
        act(() => {
          current!.dispatch({
            type: "RECORD_TRANSPORT_NEED",
            role: "ed",
            now: current!.now,
            movementId: MARKER,
            needed: true,
          });
        });
        // Genuinely rejected, and the rejection genuinely quotes the marker — the premise of this
        // test, not merely asserted.
        expect(current!.rejections.length).toBeGreaterThan(0);
        expect(current!.rejections.at(-1)!.reason).toContain(MARKER);
        expect(readStoredState(), "saving continues").not.toBeNull();
        expect(readStoredState()!.state.rejections).toEqual([]);

        act(() => {
          current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
        });
        expect(readStoredState(), "a later safe event still saves").not.toBeNull();
        expect(readStoredState()!.state.rejections).toEqual([]);
        for (const call of setItemSpy.mock.calls) {
          const [, value] = call;
          expect(typeof value === "string" ? value : "").not.toContain(MARKER);
        }
        unmount();
      } finally {
        setItemSpy.mockRestore();
      }
    });

    /**
     * The contrast case fix 1 also asks for: an ACCEPTED safe-listed dispatch (no rejection, no
     * typed-text event type) must still save normally — the new "lock on any rejection" rule must
     * not become "lock on any safe-listed dispatch at all".
     */
    it("an ACCEPTED safe-listed dispatch still saves normally", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const movement = current!.movements.find((candidate) => !candidate.closure);
      if (!movement) throw new Error("Fixture must carry at least one open movement");
      const rejectionsBefore = current!.rejections.length;

      act(() => {
        current!.dispatch({
          type: "RECORD_TRANSPORT_NEED",
          role: "ed",
          now: current!.now,
          movementId: movement.id,
          needed: true,
        });
      });
      expect(current!.rejections.length).toBe(rejectionsBefore);
      expect(readStoredState()).not.toBeNull();
      expect(readStoredState()?.state.clockOffsetMinutes).toBe(0);
      unmount();
    });

    /**
     * 🔴 P3 finding 8: proves the privacy property directly against what actually reaches the
     * browser API, rather than trusting that every code path that could write does so through
     * `tryWriteDemoState`. A `setItem` spy sees every write attempt, however it was made; searching
     * every recorded call's VALUE for the typed marker text is a stronger claim than "the key ended
     * up null", because it also catches a bug that wrote the marker under a different key.
     */
    it("no sessionStorage.setItem call ever carries the typed marker text, across a lock-triggering session", () => {
      // Spied on `Storage.prototype`, not the `window.sessionStorage` INSTANCE: jsdom defines
      // `setItem` on the prototype, and spying the instance silently shadows it with a mock that
      // never delegates to the real implementation — confirmed empirically, 2026-09-17: the instance
      // form recorded zero calls AND stopped sessionStorage actually writing at all, which would have
      // made every assertion below (and the "at least one real call" check just below) pass
      // vacuously for the wrong reason.
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      try {
        const { unmount } = render(
          <WardFlowProvider>
            <Capture />
          </WardFlowProvider>,
        );
        const MARKER = "MARKER-TEXT-THAT-MUST-NEVER-BE-STORED-8f3c1a";
        act(() => {
          current!.dispatch({
            type: "ADD_PATIENT",
            role: "coordinator",
            now: current!.now,
            umrn: "UMRN-TEST-003",
            givenName: MARKER,
            familyName: "Marker",
            dateOfBirth: "1990-01-01",
          });
        });
        act(() => {
          current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
        });
        // 🔴 P3 finding 4: this spy checked NOTHING before the loop below could run — if the
        // provider stopped calling `setItem` entirely (a regression that would also make the
        // "never contains the marker" loop below vacuously pass), this test would still read
        // GREEN. Assert the spy actually saw a real write to THIS key first, so the loop that
        // follows is checking something rather than iterating zero calls.
        expect(
          setItemSpy.mock.calls.some(([key]) => key === WARD_FLOW_DEMO_STORAGE_KEY),
          "the spy recorded no setItem call to the demo storage key at all — the loop below would " +
            "have passed vacuously",
        ).toBe(true);
        for (const call of setItemSpy.mock.calls) {
          const [, value] = call;
          expect(typeof value === "string" ? value : "").not.toContain(MARKER);
        }
        unmount();
      } finally {
        setItemSpy.mockRestore();
      }
    });
  });

  it("keeps writing through allowlisted events, and a remount restores the seed's own text plus the change made before reload", () => {
    const { unmount: firstUnmount } = render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    const seededMovements = current!.movements.map((movement) => ({ id: movement.id, blocker: movement.blocker }));
    const seededReferrals = current!.referrals.map((referral) => ({ id: referral.id, history: referral.history }));
    // The fixture seeds real prose into both — otherwise the equality checks below would pass
    // whether or not restoration actually worked.
    expect(seededMovements.some((movement) => movement.blocker !== "")).toBe(true);
    expect(seededReferrals.some((referral) => referral.history !== "")).toBe(true);

    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 20 });
    });
    expect(readStoredState()?.state.clockOffsetMinutes).toBe(20);
    firstUnmount();

    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    expect(readStoredState()?.state.clockOffsetMinutes).toBe(20);
    expect(current!.movements.map((movement) => ({ id: movement.id, blocker: movement.blocker }))).toEqual(
      seededMovements,
    );
    expect(current!.referrals.map((referral) => ({ id: referral.id, history: referral.history }))).toEqual(
      seededReferrals,
    );
  });

  it("discards a save whose configuration is out of range", () => {
    const { unmount } = render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 20 });
    });
    const stored = readStoredState();
    expect(stored).not.toBeNull();
    const storedConfiguration = stored!.state.configuration as Record<string, unknown>;
    // 100 is well outside `ED_ACCESS_TARGET_RANGE_MINUTES` (`min: 720, max: 2160` — `ward-model.ts`).
    const corrupted = {
      ...stored,
      state: { ...stored!.state, configuration: { ...storedConfiguration, edAccessTargetMinutes: 100 } },
    };
    window.sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify(corrupted));
    unmount();

    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    // Discarded — a fresh seed, clockOffsetMinutes back to 0, never the out-of-range draft restored.
    expect(readStoredState()?.state.clockOffsetMinutes).toBe(0);
  });

  describe("a demo reset re-enables saving after a typed-text lock", () => {
    it("via the context's own resetDemoState()", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      // A deliberately unmistakable synthetic name — not one already in the seed fixture's own
      // patient list, so its absence after reset actually proves the reseed happened rather than
      // coincidentally matching a name the fixture already carries.
      const TYPED_GIVEN_NAME = "Zzyzx-Test-Only";
      act(() => {
        current!.dispatch({
          type: "ADD_PATIENT",
          role: "coordinator",
          now: current!.now,
          umrn: "UMRN-TEST-002",
          givenName: TYPED_GIVEN_NAME,
          familyName: "Draft",
          dateOfBirth: "1985-05-05",
        });
      });
      expect(readStoredState()).toBeNull();
      expect(current!.patients.some((patient) => patient.givenName === TYPED_GIVEN_NAME)).toBe(true);

      act(() => {
        current!.resetDemoState();
      });
      // A genuine reseed (RESET_SCENARIO, accepted — `worldGeneration` increments) replaces the
      // whole world with fresh fixture data carrying no typed text, so saving may resume.
      expect(readStoredState()).not.toBeNull();
      expect(current!.patients.some((patient) => patient.givenName === TYPED_GIVEN_NAME)).toBe(false);

      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 10 });
      });
      expect(readStoredState()?.state.clockOffsetMinutes).toBe(10);
      unmount();
    });

    /**
     * 🔴 P3 finding 8: `ward-demo-controls.tsx`'s own reset button does NOT call
     * `resetDemoState()` — it dispatches `RESET_SCENARIO` directly
     * (`dispatch({ type: "RESET_SCENARIO", role: "demo", now })`), bypassing the context helper and
     * its explicit `clearWardFlowDemoState()` call entirely. The lock-clearing therefore has to be
     * driven by the reducer's own `worldGeneration` change (`trackWardFlowTypedTextDispatch`'s own
     * comment in `ward-flow-provider.tsx`), not by `resetDemoState()`'s side effect — this test
     * dispatches the RAW event, the way the demo-controls menu actually does, to prove that path
     * re-enables saving on its own.
     */
    it("via a raw RESET_SCENARIO dispatch that bypasses resetDemoState() entirely, the way ward-demo-controls.tsx's reset button does", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const TYPED_GIVEN_NAME = "Zzyzx-Raw-Reset-Only";
      act(() => {
        current!.dispatch({
          type: "ADD_PATIENT",
          role: "coordinator",
          now: current!.now,
          umrn: "UMRN-TEST-004",
          givenName: TYPED_GIVEN_NAME,
          familyName: "Draft",
          dateOfBirth: "1985-05-05",
        });
      });
      expect(readStoredState()).toBeNull();

      // The raw dispatch `ward-demo-controls.tsx`'s `reset()` handler performs — no
      // `clearWardFlowDemoState()` call anywhere in this test.
      act(() => {
        current!.dispatch({ type: "RESET_SCENARIO", role: "demo", now: current!.now });
      });
      expect(readStoredState()).not.toBeNull();
      expect(current!.patients.some((patient) => patient.givenName === TYPED_GIVEN_NAME)).toBe(false);

      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 10 });
      });
      expect(readStoredState()?.state.clockOffsetMinutes).toBe(10);
      unmount();
    });
  });

  /**
   * P3 finding 6: `case "SET_SCENARIO"` used to pass `event.scenario` straight through with no
   * runtime check, and `isValidStoredWardFlowState` restored `state.scenario` back with only a
   * `typeof === "string"` check. Both are now checked against the same `WARD_SCENARIOS` list
   * (`ward-scenarios.ts`).
   *
   * P3 finding 8 (its own bullet): a REFUSED `RESET_SCENARIO` (wrong role) must KEEP a live lock —
   * proving the top-level `wardFlowReducer`'s `worldGeneration`-bump condition was fixed to require
   * `next.movements !== state.movements`, not role alone (see that condition's own comment,
   * `ward-flow-reducer.ts`) — and an ACCEPTED `SET_SCENARIO` must CLEAR one, proving the fix did not
   * accidentally stop a genuine reseed from clearing the lock at all.
   */
  describe("SET_SCENARIO validation, and its interaction with the typed-text lock", () => {
    it("refuses a scenario not on WARD_SCENARIOS, and does not clear a live lock", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const TYPED_GIVEN_NAME = "Zzyzx-Bad-Scenario-Only";
      act(() => {
        current!.dispatch({
          type: "ADD_PATIENT",
          role: "coordinator",
          now: current!.now,
          umrn: "UMRN-TEST-005",
          givenName: TYPED_GIVEN_NAME,
          familyName: "Draft",
          dateOfBirth: "1985-05-05",
        });
      });
      expect(readStoredState()).toBeNull();
      const worldGenerationBefore = current!.worldGeneration;
      const rejectionsBefore = current!.rejections.length;

      act(() => {
        current!.dispatch({
          type: "SET_SCENARIO",
          role: "demo",
          now: current!.now,
          scenario: "not-a-real-scenario" as never,
        });
      });
      // Genuinely refused — worldGeneration unchanged, a new rejection recorded — not a silent
      // no-op and not an accepted reseed under a different name.
      expect(current!.worldGeneration).toBe(worldGenerationBefore);
      expect(current!.rejections.length).toBeGreaterThan(rejectionsBefore);
      expect(current!.patients.some((patient) => patient.givenName === TYPED_GIVEN_NAME)).toBe(true);
      // The lock is still live: an allowlisted event afterwards must not be written.
      expect(readStoredState()).toBeNull();
      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
      });
      expect(readStoredState()).toBeNull();
      unmount();
    });

    it("an ACCEPTED SET_SCENARIO clears a live lock", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const TYPED_GIVEN_NAME = "Zzyzx-Good-Scenario-Only";
      act(() => {
        current!.dispatch({
          type: "ADD_PATIENT",
          role: "coordinator",
          now: current!.now,
          umrn: "UMRN-TEST-006",
          givenName: TYPED_GIVEN_NAME,
          familyName: "Draft",
          dateOfBirth: "1985-05-05",
        });
      });
      expect(readStoredState()).toBeNull();
      const worldGenerationBefore = current!.worldGeneration;

      act(() => {
        current!.dispatch({ type: "SET_SCENARIO", role: "demo", now: current!.now, scenario: "scarce" });
      });
      expect(current!.worldGeneration).toBeGreaterThan(worldGenerationBefore);
      expect(current!.scenario).toBe("scarce");
      expect(current!.patients.some((patient) => patient.givenName === TYPED_GIVEN_NAME)).toBe(false);
      expect(readStoredState()).not.toBeNull();

      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
      });
      expect(readStoredState()?.state.clockOffsetMinutes).toBe(5);
      unmount();
    });

    /** P3 finding 8: a REFUSED `RESET_SCENARIO` (wrong role) must keep a live lock rather than
     *  clearing it — the `worldGeneration`-bump condition's role-only half was never wrong on its
     *  own; this test pins it stays correct after the companion `next.movements !== state.movements`
     *  check was added for `SET_SCENARIO`'s sake. */
    it("refuses a RESET_SCENARIO raised by a role EVENT_ROLE does not permit, and does not clear a live lock", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      const TYPED_GIVEN_NAME = "Zzyzx-Bad-Role-Reset-Only";
      act(() => {
        current!.dispatch({
          type: "ADD_PATIENT",
          role: "coordinator",
          now: current!.now,
          umrn: "UMRN-TEST-007",
          givenName: TYPED_GIVEN_NAME,
          familyName: "Draft",
          dateOfBirth: "1985-05-05",
        });
      });
      expect(readStoredState()).toBeNull();
      const worldGenerationBefore = current!.worldGeneration;

      act(() => {
        // "coordinator" is not on EVENT_ROLE.RESET_SCENARIO (["demo"] only).
        current!.dispatch({ type: "RESET_SCENARIO", role: "coordinator", now: current!.now });
      });
      expect(current!.worldGeneration).toBe(worldGenerationBefore);
      expect(current!.patients.some((patient) => patient.givenName === TYPED_GIVEN_NAME)).toBe(true);
      expect(readStoredState()).toBeNull();
      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
      });
      expect(readStoredState()).toBeNull();
      unmount();
    });

    it("discards a stored save whose scenario is not on WARD_SCENARIOS", () => {
      const { unmount } = render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      act(() => {
        current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 20 });
      });
      const stored = readStoredState();
      expect(stored).not.toBeNull();
      const corrupted = { ...stored, state: { ...stored!.state, scenario: "not-a-real-scenario" } };
      window.sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify(corrupted));
      unmount();

      render(
        <WardFlowProvider>
          <Capture />
        </WardFlowProvider>,
      );
      // Discarded — a fresh seed, clockOffsetMinutes back to 0, never the invalid scenario restored.
      expect(readStoredState()?.state.clockOffsetMinutes).toBe(0);
    });
  });

  describe("event-type coverage guard (names only — the payload-shape guard is compile-time, see ward-flow-provider-safe-payload-shape-guard.test.ts)", () => {
    it("covers every real WardFlowEvent type with exactly one of the two lists", () => {
      // `EVENT_ROLE` is typed `Record<WardFlowEvent["type"], …>`, so `tsc` already refuses to
      // compile it missing a member — this turns that static guarantee into a runtime assertion
      // that fires the moment a new event type lands without a decision recorded on either list.
      const allTypes = Object.keys(EVENT_ROLE);
      expect(findWardFlowEventTypeCoverageGaps(allTypes)).toEqual([]);

      const overlap = allTypes.filter(
        (type) =>
          WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(type as WardFlowEvent["type"]) &&
          WARD_FLOW_TYPED_TEXT_EVENT_TYPES.has(type as WardFlowEvent["type"]),
      );
      expect(overlap).toEqual([]);
    });

    it("reports a synthetic event type present on neither list — the sentinel proving the helper can fail", () => {
      // Proves the helper is a real check rather than one that vacuously returns empty for any
      // input — see `docs/agents/*` on checks that cannot fail.
      expect(findWardFlowEventTypeCoverageGaps(["NOT_A_REAL_WARD_FLOW_EVENT_TYPE"])).toEqual([
        "NOT_A_REAL_WARD_FLOW_EVENT_TYPE",
      ]);
    });
  });
});
