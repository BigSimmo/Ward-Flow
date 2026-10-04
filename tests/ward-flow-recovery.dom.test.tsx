import { useEffect, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  WARD_FLOW_DEMO_STORAGE_KEY,
  useWardFlow,
  useWardFlowClock,
  clearWardFlowDemoState,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

let current: ReturnType<typeof useWardFlow>;
let boardNow: number;
function Probe() {
  const value = useWardFlow();
  const clock = useWardFlowClock();
  useEffect(() => {
    current = value;
    boardNow = clock;
  }, [value, clock]);
  return null;
}
function mount() {
  return render(
    <WardFlowProvider>
      <Probe />
    </WardFlowProvider>,
  );
}
function saved() {
  return JSON.parse(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 23, 10, 0));
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe("conservative demo recovery", () => {
  it("accepts the current safe seed without fabricating records", () => {
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(seedWardFlowStateAt(0))))).toBe(true);
  });
  it.each(["above-stale-feed", "zero-with-recorded-locked-beds"] as const)(
    "restores an accepted aggregate capacity observation: %s",
    (scenario) => {
      const view = mount();
      const unit = current.units.find((candidate) =>
        scenario === "above-stale-feed" ? candidate.empty.value < candidate.beds : candidate.allocatableLocked > 0,
      )!;
      expect(unit).toBeDefined();
      const value = scenario === "above-stale-feed" ? unit.empty.value + 1 : 0;
      const previousRejections = current.rejections.length;
      act(() =>
        current.dispatch({
          type: "CONFIRM_CAPACITY",
          role: "ward",
          now: current.now,
          unitId: unit.id,
          actingUnitId: unit.id,
          expectedRevision: unit.allocatable.revision ?? 0,
          value,
        }),
      );
      expect(current.rejections).toHaveLength(previousRejections);
      const accepted = current.units.find((candidate) => candidate.id === unit.id)!;
      expect(accepted.allocatable).toEqual({
        ...unit.allocatable,
        value,
        source: "ward",
        confirmedAt: current.now,
        revision: (unit.allocatable.revision ?? 0) + 1,
      });
      expect(accepted.empty).toEqual(unit.empty);
      expect(accepted.allocatableLocked).toBe(unit.allocatableLocked);
      expect(saved().state.units.find((candidate: { id: string }) => candidate.id === unit.id)).toEqual(accepted);
      view.unmount();
      mount();
      expect(screen.queryByRole("status")).toBeNull();
      expect(current.units.find((candidate) => candidate.id === unit.id)).toEqual(accepted);
    },
  );
  it.each([
    [
      "null patient",
      (s: WardFlowState) => {
        s.patients = [null as never];
      },
    ],
    [
      "malformed optional patient text",
      (s: WardFlowState) => {
        s.patients[0].preferredName = {} as never;
      },
    ],
    [
      "malformed follow-up",
      (s: WardFlowState) => {
        s.admissions[0].followUp = {} as never;
      },
    ],
    [
      "malformed suburb",
      (s: WardFlowState) => {
        s.referrals[0].suburb = {} as never;
      },
    ],
    [
      "duplicate patient",
      (s: WardFlowState) => {
        s.patients.push(s.patients[0]);
      },
    ],
    [
      "broken patient reference",
      (s: WardFlowState) => {
        s.admissions[0].patientId = "PT-missing";
      },
    ],
    [
      "broken ward reference",
      (s: WardFlowState) => {
        s.admissions[0].unitId = "missing";
      },
    ],
    [
      "malformed history",
      (s: WardFlowState) => {
        s.movements[0].statusChanges = [null as never];
      },
    ],
    [
      "malformed capacity",
      (s: WardFlowState) => {
        s.units[0].allocatable = null as never;
      },
    ],
    [
      "excess capacity",
      (s: WardFlowState) => {
        s.units[0].allocatable.value = s.units[0].beds + 1;
      },
    ],
    [
      "negative counter",
      (s: WardFlowState) => {
        s.patientSequence = -1;
      },
    ],
    [
      "counter behind allocated id",
      (s: WardFlowState) => {
        s.admissions.push({ ...s.admissions[0], id: "AD-ARR-01", patientId: null, referralId: null, movementId: null });
      },
    ],
    [
      "fractional counter",
      (s: WardFlowState) => {
        s.admissionSequence = 1.5;
      },
    ],
    [
      "missing new collection",
      (s: WardFlowState) => {
        delete (s as Partial<WardFlowState>).clinicalContacts;
      },
    ],
    [
      "malformed rollup",
      (s: WardFlowState) => {
        s.morningRollupConfirmations = { missing: null as never };
      },
    ],
  ])("refuses %s before consumers see it", (_label, corrupt) => {
    const view = mount();
    const payload = saved();
    corrupt(payload.state);
    window.sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify(payload));
    view.unmount();
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("could not be restored safely");
    expect(current.patients.every(Boolean)).toBe(true);
    expect(current.now).toBe(NOW_ANCHOR);
  });
  it("keeps event time, board time and same-day time away coherent after reload", () => {
    const view = mount();
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(current.now).toBe(NOW_ANCHOR + 10);
    expect(boardNow).toBe(current.now);
    act(() => current.dispatch({ type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: current.now }));
    const payload = saved();
    expect(payload.state.handoverSignOffs.at(-1).at).toBe(NOW_ANCHOR + 10);
    view.unmount();
    vi.setSystemTime(new Date(2026, 8, 23, 10, 15));
    mount();
    expect(current.now).toBe(NOW_ANCHOR + 15);
    expect(boardNow).toBe(current.now);
    expect(saved().state.handoverSignOffs.at(-1).at).toBe(NOW_ANCHOR + 10);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it.each(["now", "savedAtAbsolute"])("rejects missing clock metadata %s", (key) => {
    const view = mount();
    const payload = saved();
    delete payload[key];
    window.sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify(payload));
    view.unmount();
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("could not be restored safely");
  });
  it("rejects conflicting explicit patient links", () => {
    const state = seedWardFlowStateAt(0);
    const referral = { ...state.referrals[0], id: "RF-recovery-test", patientId: state.patients[0].id };
    state.referrals.push(referral);
    const movement = state.movements.find((row) => !row.admissionId)!;
    movement.referralId = referral.id;
    movement.patientId = referral.patientId;
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    movement.patientId = state.patients[1].id;
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(false);
  });
  // Open item 5 (3 Oct 2026): adopting the saved session used to re-key the provider's world and
  // remount every screen about a second after load, so a click or half-typed entry in that window
  // landed on a discarded node. A first visit, or a reload with nothing changed, must keep its nodes.
  // A reload of a changed day must start each screen from the restored day, including state a
  // screen initialises only once (a settings draft, a first selection).
  let mounts = 0;
  let firstSeenAllocatable: Record<string, number> = {};
  function OneTimeConsumer() {
    const { units } = useWardFlow();
    const [initial] = useState(() => Object.fromEntries(units.map((unit) => [unit.id, unit.allocatable.value ?? -1])));
    useEffect(() => {
      mounts += 1;
      firstSeenAllocatable = initial;
    }, [initial]);
    return <input data-testid="mount-probe" />;
  }
  const consumerTree = () => (
    <WardFlowProvider>
      <Probe />
      <OneTimeConsumer />
    </WardFlowProvider>
  );
  it("keeps the same screen nodes on a first visit and on a reload with nothing changed", () => {
    mounts = 0;
    const first = render(consumerTree());
    const probe = screen.getByTestId("mount-probe");
    expect(mounts).toBe(1);
    expect(screen.getByTestId("mount-probe")).toBe(probe);
    expect(saved()).toBeTruthy();
    first.unmount();

    mounts = 0;
    render(consumerTree());
    expect(mounts).toBe(1);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("starts one-time screen state from the restored day when a changed day is reloaded", () => {
    const first = render(consumerTree());
    const unit = current.units.find((candidate) => candidate.empty.value < candidate.beds)!;
    const value = unit.empty.value + 1;
    act(() =>
      current.dispatch({
        type: "CONFIRM_CAPACITY",
        role: "ward",
        now: current.now,
        unitId: unit.id,
        actingUnitId: unit.id,
        expectedRevision: unit.allocatable.revision ?? 0,
        value,
      }),
    );
    first.unmount();

    render(consumerTree());
    expect(current.units.find((candidate) => candidate.id === unit.id)!.allocatable.value).toBe(value);
    expect(firstSeenAllocatable[unit.id]).toBe(value);
  });
  // PR #41 review (4 Oct 2026): an action dispatched before the saved day is adopted (a child's
  // mount effect runs first) must not be silently dropped when a changed day is restored. It is
  // replayed on the restored day, keeping its log entry and its typed-text lock.
  // Dispatches once per test, like one click: the restore remounts this node, which must not resend.
  let earlySent = false;
  function EarlyDispatcher({ event }: { event: (value: ReturnType<typeof useWardFlow>) => WardFlowEvent }) {
    const value = useWardFlow();
    const [dispatched] = useState(() => event(value));
    useEffect(() => {
      if (earlySent) return;
      earlySent = true;
      value.dispatch(dispatched);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
  }
  function capacityChange(value: ReturnType<typeof useWardFlow>, skip?: string): WardFlowEvent {
    const unit = value.units.find((candidate) => candidate.id !== skip && candidate.empty.value < candidate.beds)!;
    return {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: value.now,
      unitId: unit.id,
      actingUnitId: unit.id,
      expectedRevision: unit.allocatable.revision ?? 0,
      value: unit.empty.value + 1,
    };
  }
  function saveChangedDay() {
    earlySent = false;
    const view = mount();
    const event = capacityChange(current) as Extract<WardFlowEvent, { type: "CONFIRM_CAPACITY" }>;
    act(() => current.dispatch(event));
    view.unmount();
    return event;
  }
  it("replays an action taken before a changed saved day was adopted", () => {
    const savedChange = saveChangedDay();
    let early: Extract<WardFlowEvent, { type: "CONFIRM_CAPACITY" }> | undefined;
    render(
      <WardFlowProvider>
        <Probe />
        <EarlyDispatcher event={(value) => (early = capacityChange(value, savedChange.unitId) as typeof early)!} />
      </WardFlowProvider>,
    );
    const unitValue = (id: string) => current.units.find((candidate) => candidate.id === id)!.allocatable.value;
    expect(unitValue(savedChange.unitId)).toBe(savedChange.value);
    expect(unitValue(early!.unitId)).toBe(early!.value);
    expect(current.eventLog).toHaveLength(1);
    expect(saved().state.units.length).toBeGreaterThan(0);
  });
  it("keeps the typed-text lock from an action taken before a changed saved day was adopted", () => {
    saveChangedDay();
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).not.toBeNull();
    render(
      <WardFlowProvider>
        <Probe />
        <EarlyDispatcher
          event={(value) => ({
            type: "RECORD_REPATRIATION",
            role: "coordinator",
            now: value.now,
            admissionId: value.admissions[0].id,
            homeHospital: value.units[0].siteCode,
            receivingWardAgreed: true,
            mode: "road",
            provider: "Ambulance service",
            cadNumber: "Synthetic-private-CAD",
            transportLegalStatus: "voluntary",
            estimatedAt: value.now + 60,
          })}
        />
      </WardFlowProvider>,
    );
    expect(current.eventLog).toHaveLength(1);
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();
  });
  it("rejects a backward system clock", () => {
    const view = mount();
    view.unmount();
    vi.setSystemTime(new Date(2026, 8, 23, 9, 59));
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("could not be restored safely");
  });
});
describe("unavailable browser storage", () => {
  it("contains a throwing sessionStorage getter", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => mount()).not.toThrow();
    expect(() => clearWardFlowDemoState()).not.toThrow();
    expect(screen.getByRole("status")).toHaveTextContent("stay in memory");
    act(() => current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 5 }));
    expect(current.now).toBe(NOW_ANCHOR + 5);
  });
  it("does not write after storage read access was denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const write = vi.spyOn(Storage.prototype, "setItem");
    mount();
    act(() => current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 5 }));
    expect(write).not.toHaveBeenCalled();
  });
  it.each(["getItem", "setItem", "removeItem"] as const)("contains a throwing %s", (method) => {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => mount()).not.toThrow();
    act(() =>
      current.dispatch({
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: current.now,
        movementId: current.movements[0].id,
        blocker: "Synthetic private note",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("stay in memory");
    expect(() => clearWardFlowDemoState()).not.toThrow();
  });
});

describe("reviewed event privacy", () => {
  it("restores accepted clinical contact without typed prose", () => {
    const view = mount();
    act(() =>
      current.dispatch({
        type: "RECORD_CLINICAL_CONTACT",
        role: "coordinator",
        now: current.now,
        teamId: COMMUNITY_TEAM_PAGES[0].id,
      }),
    );
    expect(saved().state.clinicalContacts).toHaveLength(1);
    view.unmount();
    mount();
    expect(saved().state.clinicalContacts).toHaveLength(1);
  });
  // Josh, D-18 (25 Sept 2026): a refusal keeps saving, but the refusal record itself (which quotes
  // the caller's team id) is never written, so the arbitrary text never reaches storage.
  it("keeps saving after a refused clinical contact, and never stores the team id it quotes", () => {
    const view = mount();
    act(() =>
      current.dispatch({
        type: "RECORD_CLINICAL_CONTACT",
        role: "coordinator",
        now: current.now,
        teamId: "Synthetic-private-team-text",
      }),
    );
    expect(current.rejections.length).toBeGreaterThan(0);
    const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    expect(raw, "saving continues after a refusal").not.toBeNull();
    expect(raw).not.toContain("Synthetic-private-team-text");
    expect(saved().state.rejections).toEqual([]);

    // A later accepted action still saves and survives a reload.
    act(() => current.dispatch({ type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: current.now }));
    const signOffs = saved().state.handoverSignOffs.length;
    view.unmount();
    mount();
    expect(screen.queryByRole("status")).toBeNull();
    expect(saved().state.handoverSignOffs).toHaveLength(signOffs);
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).not.toContain("Synthetic-private-team-text");
  });
  it("never persists a repatriation CAD number, including after later safe events", () => {
    mount();
    const admission = current.admissions[0];
    act(() =>
      current.dispatch({
        type: "RECORD_REPATRIATION",
        role: "coordinator",
        now: current.now,
        admissionId: admission.id,
        homeHospital: current.units[0].siteCode,
        receivingWardAgreed: true,
        mode: "road",
        provider: "Ambulance service",
        cadNumber: "Synthetic-private-CAD",
        transportLegalStatus: "voluntary",
        estimatedAt: current.now + 60,
      }),
    );
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();
    act(() => current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 5 }));
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();
  });
});
