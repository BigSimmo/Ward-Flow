import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WardDemoNotSavedNote } from "@/components/ward-management/shell/ward-demo-saving";
import {
  WARD_FLOW_DEMO_STORAGE_KEY,
  WardFlowProvider,
  useWardFlow,
} from "@/components/ward-management/ward-flow-provider";
import { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-typed-text-ledger";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

/*
 * A9-07 (Audit 9, approved by Josh 13 Nov 2026): adding a person, or sending a referral whose
 * referrer role is the desk's prefilled "Community team", stopped every later save for the session,
 * so a reload lost everything since. Saving now carries on with only the typed values left out.
 */
const store: { current?: ReturnType<typeof useWardFlow> } = {};
function Capture({ onStore }: { onStore: (value: ReturnType<typeof useWardFlow>) => void }) {
  onStore(useWardFlow());
  return null;
}

function communityReferral(now: number, unitId: string): WardFlowEvent {
  return {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now,
    patientId: "PT-091",
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Bellevue" },
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId,
        sex: "Male",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    source: "community",
    originSiteCode: "SJGM",
    sendingTeamName: "Midland Community Team",
    urgency: 3,
    transportNeeded: true,
    history: "",
    intake: {
      catchment: { teamName: "Midland Community Team", confirmed: true },
      reasonForReferral: "",
      legalStatus: "Voluntary",
      riskFlags: [],
      medicalClearance: { cleared: false },
      triageAndRampCompleted: false,
      additionalDocuments: false,
      charts: [],
      chartsToFollow: ["medication", "observation"],
      // The community desk's own profile, prefilled as the referrer (settings-profile.ts).
      referrer: {
        name: "L. Hart",
        role: "Community team",
        phone: "+61 8 5550 0283",
        email: "l.hart@example.org",
        location: "Community mental health team",
      },
      arrival: { transport: "", reference: "" },
    },
  } as unknown as WardFlowEvent;
}

function stored(): string {
  return window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY) ?? "";
}

describe("A9-07: saving carries on after typed text", () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it("keeps saving after Add patient and a community referral, and a reload holds both", async () => {
    const first = render(
      <WardFlowProvider>
        <Capture onStore={(value) => (store.current = value)} />
        <WardDemoNotSavedNote />
      </WardFlowProvider>,
    );
    await waitFor(() => expect(stored()).not.toBe(""));
    const patientsBefore = store.current!.patients.length;
    const referralsBefore = store.current!.referrals.length;
    act(() => {
      store.current!.dispatch({
        type: "ADD_PATIENT",
        role: "coordinator",
        now: store.current!.now,
        umrn: "UM999001",
        givenName: "Synthetic-given-j2",
        familyName: "Synthetic-family-j2",
        dateOfBirth: "1990-02-01",
      });
    });
    expect(store.current!.patients).toHaveLength(patientsBefore + 1);
    const unit = store.current!.units.find((candidate) => candidate.id === "sjgm-adult-open")!;
    act(() => {
      store.current!.dispatch(communityReferral(store.current!.now, unit.id));
    });
    expect(store.current!.referrals).toHaveLength(referralsBefore + 1);
    const sentId = store.current!.referrals.at(-1)!.id;

    await waitFor(() => expect(stored()).toContain(sentId));
    expect(store.current!.savingOnDevice).toBe(true);
    expect(screen.queryByTestId("ward-demo-not-saved")).toBeNull();
    // D-18: the typed values themselves never reach the device.
    for (const typed of ["UM999001", "Synthetic-given-j2", "Synthetic-family-j2", "1990-02-01"])
      expect(stored()).not.toContain(typed);
    expect(stored()).toContain(TYPED_TEXT_NOT_KEPT);

    first.unmount();
    store.current = undefined;
    render(
      <WardFlowProvider>
        <Capture onStore={(value) => (store.current = value)} />
      </WardFlowProvider>,
    );
    await waitFor(() => expect(store.current!.referrals.some((referral) => referral.id === sentId)).toBe(true));
    expect(store.current!.patients).toHaveLength(patientsBefore + 1);
    expect(store.current!.patients.at(-1)!.dateOfBirth).toBe(TYPED_TEXT_NOT_KEPT);
  });

  it("still says so when a save cannot be made safely", async () => {
    render(
      <WardFlowProvider>
        <Capture onStore={(value) => (store.current = value)} />
        <WardDemoNotSavedNote />
      </WardFlowProvider>,
    );
    await waitFor(() => expect(stored()).not.toBe(""));
    // An event type nobody has classified is default deny: no safe copy, so saving stops and says so.
    act(() => {
      store.current!.dispatch({
        type: "SYNTHETIC_UNCLASSIFIED_EVENT",
        role: "coordinator",
        now: store.current!.now,
      } as never);
    });
    await waitFor(() =>
      expect(screen.getByTestId("ward-demo-not-saved")).toHaveTextContent(
        "Demonstration state is not saved on this device",
      ),
    );
  });
});
