/**
 * Master audit M32 (10 Nov 2026): several tabs per person. Acting in one tab updates or warns the
 * others. For each main action this runs both halves of a two-tab exchange over the tabs' sync
 * channel (`ward-flow-sync`):
 *   1. tab A does the action and sends its saved day;
 *   2. a fresh tab B takes that day, so the action shows there (updates);
 *   3. a tab C that has its own worked day keeps it and says the tabs have split (warns).
 * Sign-out across tabs is covered in tests/ward-supabase-shared.dom.test.tsx ("signs this tab out,
 * says why and stays quiet, when another tab signs out"). Synthetic seed data only.
 */
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_DEMO_STORAGE_KEY } from "@/components/ward-management/ward-flow-demo-storage";
import {
  OTHER_TAB_DAY_NOTICE,
  WardOtherTabDayNote,
  resetOtherTabDayForTests,
} from "@/components/ward-management/shell/ward-other-tab-day";

type Message = { type?: string; eventType?: string; senderId?: string; payload?: string };
const posted: Message[] = [];
const channels = new Set<FakeChannel>();

/** BroadcastChannel between tabs of one browser: delivered to every other channel of that name. */
class FakeChannel {
  onmessage: ((event: { data: Message }) => void) | null = null;
  constructor(readonly name: string) {
    channels.add(this);
  }
  postMessage(data: Message) {
    posted.push(data);
    for (const other of channels)
      if (other !== this && other.name === this.name) void Promise.resolve().then(() => other.onmessage?.({ data }));
  }
  close() {
    channels.delete(this);
  }
}

async function settle() {
  await act(async () => {
    await import("@/components/ward-management/ward-flow-demo-restore");
  });
  for (let i = 0; i < 6; i++) await act(async () => Promise.resolve());
}

/** Settles until `done()` holds (a multi-step press waits for the tab's saved day to be read first). */
async function settleUntil(done: () => boolean) {
  for (let turn = 0; turn < 20 && !done(); turn += 1) await settle();
}

beforeEach(() => {
  posted.length = 0;
  channels.clear();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  resetOtherTabDayForTests();
});

/** The main actions, each as the events a person's press sends (seeded from the synthetic network). */
function mainActions(): { name: string; events: (state: WardFlowState, now: number) => WardFlowEvent[] }[] {
  const openMovement = (state: WardFlowState) => {
    const movement = state.movements.find(
      (candidate) =>
        candidate.referredUnitIds.length > 0 &&
        !candidate.acceptedUnitId &&
        !candidate.closure &&
        !candidate.transport &&
        (state.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
    )!;
    return { movementId: movement.id, unitId: movement.referredUnitIds[0]! };
  };
  const accept = (state: WardFlowState, now: number) => {
    const { movementId, unitId } = openMovement(state);
    return {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now,
      movementId,
      unitId,
      overrideReason: "The bed information is known to be out of date",
    } as unknown as WardFlowEvent;
  };
  return [
    {
      name: "confirm a ward's bed count",
      events: (state, now) => {
        const unit = state.units[0];
        return [
          {
            type: "CONFIRM_CAPACITY",
            role: "ward",
            now,
            unitId: unit.id,
            actingUnitId: unit.id,
            value: unit.allocatable.value,
            expectedRevision: unit.allocatable.revision ?? 0,
          } as unknown as WardFlowEvent,
        ];
      },
    },
    { name: "accept a referral in principle", events: (state, now) => [accept(state, now)] },
    {
      name: "pull a patient to the ward",
      events: (state, now) => {
        const { movementId, unitId } = openMovement(state);
        return [
          accept(state, now),
          { type: "PULL_PATIENT", role: "ward", now: now + 1, movementId, unitId } as unknown as WardFlowEvent,
        ];
      },
    },
    {
      name: "record the transport need",
      events: (state, now) => {
        const { movementId, unitId } = openMovement(state);
        return [
          accept(state, now),
          { type: "PULL_PATIENT", role: "ward", now: now + 1, movementId, unitId } as unknown as WardFlowEvent,
          {
            type: "RECORD_TRANSPORT_NEED",
            role: "ed",
            now: now + 2,
            movementId,
            needed: false,
          } as unknown as WardFlowEvent,
        ];
      },
    },
    {
      name: "set an expected discharge",
      events: (state, now) => [
        {
          type: "UPDATE_EXPECTED_DISCHARGE",
          role: "coordinator",
          now,
          admissionId: state.admissions[0].id,
          expectedDischargeAt: now + 1440,
        } as unknown as WardFlowEvent,
      ],
    },
    {
      name: "move the demo clock on",
      events: (_state, now) => [{ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 } as WardFlowEvent],
    },
  ];
}

/** Tab A: runs the action once its saved day is read, as one press, then reports that it did. */
function Act({ build, done }: { build: (state: WardFlowState, now: number) => WardFlowEvent[]; done: () => void }) {
  const flow = useWardFlow();
  // A person presses once the page shows its day (the saved session has been read).
  const ready = flow.sessionAdopted;
  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const state = { ...seedWardFlowState(), ...pickState(flow) };
      for (const event of build(state, flow.now)) await flow.dispatch(event);
      done();
    })();
    // Run once: the action is one press.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}

function pickState(flow: ReturnType<typeof useWardFlow>): Partial<WardFlowState> {
  return { units: flow.units, movements: flow.movements, admissions: flow.admissions } as Partial<WardFlowState>;
}

/** What a tab shows of the world, enough to see that an action arrived. */
function Probe() {
  const flow = useWardFlow();
  return <p data-testid="world">{JSON.stringify([flow.now, flow.units, flow.movements, flow.admissions])}</p>;
}

describe("M32: acting in one demo tab updates or warns the others", () => {
  for (const action of mainActions()) {
    it(`${action.name}: tab A sends it, a fresh tab B takes it, a working tab C is warned`, async () => {
      // Tab A acts.
      let acted = false;
      const tabA = render(
        <WardFlowProvider>
          <Act build={action.events} done={() => (acted = true)} />
          <Probe />
        </WardFlowProvider>,
      );
      await settleUntil(() => acted);
      expect(acted).toBe(true);
      await settle();
      const sent = posted.filter((message) => message.eventType === "SYNC_SAVED_STATE" && message.payload).at(-1);
      expect(sent?.payload).toBeTruthy();
      const worldInA = screen.getByTestId("world").textContent;
      tabA.unmount();

      // Tab B opens fresh (its own sessionStorage, as a new tab has) and receives A's saved day.
      window.sessionStorage.clear();
      const tabB = render(
        <WardFlowProvider>
          <Probe />
        </WardFlowProvider>,
      );
      await settle();
      const seedInB = screen.getByTestId("world").textContent;
      expect(seedInB).not.toBe(worldInA);
      const peer = new FakeChannel("ward-flow-sync");
      peer.postMessage({
        type: "WARD_FLOW_DISPATCH",
        eventType: "SYNC_SAVED_STATE",
        senderId: "tab-a",
        payload: sent!.payload,
      });
      await settle();
      expect(screen.getByTestId("world").textContent).toBe(worldInA);
      tabB.unmount();
      peer.close();

      // Tab C has worked its own day (a different clock), so it keeps it and says the tabs split.
      window.sessionStorage.clear();
      resetOtherTabDayForTests();
      let cActed = false;
      render(
        <WardFlowProvider>
          <Act
            build={(_state, now) => [{ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 47 } as WardFlowEvent]}
            done={() => (cActed = true)}
          />
          <WardOtherTabDayNote />
          <Probe />
        </WardFlowProvider>,
      );
      await settleUntil(() => cActed);
      await settle();
      expect(cActed).toBe(true);
      const ownInC = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
      expect(ownInC).toBeTruthy();
      expect(screen.queryByTestId("ward-other-tab-day")).toBeNull();
      const peerAgain = new FakeChannel("ward-flow-sync");
      peerAgain.postMessage({
        type: "WARD_FLOW_DISPATCH",
        eventType: "SYNC_SAVED_STATE",
        senderId: "tab-a",
        payload: sent!.payload,
      });
      await settle();
      expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBe(ownInC);
      expect(screen.getByTestId("ward-other-tab-day")).toHaveTextContent(OTHER_TAB_DAY_NOTICE);
      peerAgain.close();
    });
  }
});
