import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ReactNode } from "react";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import {
  useWardReferralDrawerState,
  type WardReferralDrawerState,
} from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import {
  clearReferralDraftSession,
  readLastReferrerContact,
  readKeptReferralDraft,
} from "@/components/ward-management/referrals/referral-draft-store";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ReferralDrawerFoot } from "@/components/ward-management/referrals/ward-referral-drawer-rail";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/ed/rph", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => route,
  useSearchParams: () => new URLSearchParams(),
}));

let state: WardReferralDrawerState;
let snapshot: (referrals: WardFlowContextValue["referrals"]) => void;
let patientSnapshot: (patients: WardFlowContextValue["patients"]) => void;
let baseline: WardFlowContextValue;
let resolve: (outcome: WardCommandOutcome) => void;
let reject: (reason: Error) => void;
const dispatch = vi.fn(
  (_event: WardFlowEvent) =>
    new Promise<WardCommandOutcome>((yes, no) => {
      void _event;
      resolve = yes;
      reject = no;
    }),
);
function Bridge({ children }: { children: ReactNode }) {
  const base = useWardFlow();
  const [referrals, setReferrals] = React.useState(base.referrals);
  const [patients, setPatients] = React.useState(base.patients);
  React.useEffect(() => {
    baseline = base;
    snapshot = setReferrals;
    patientSnapshot = setPatients;
  }, [base]);
  return <WardFlowOverride value={{ ...base, referrals, patients, dispatch }}>{children}</WardFlowOverride>;
}
import * as React from "react";
function Probe({ footer = false }: { footer?: boolean }) {
  const value = useWardReferralDrawerState({
    onClose: vi.fn(),
    onRestart: vi.fn(),
    view: "new",
    onViewChange: vi.fn(),
    initialPatientId: "PT-023",
    initialCategory: "ed",
  });
  React.useEffect(() => {
    state = value;
  });
  return footer ? <ReferralDrawerFoot s={value} /> : null;
}
function setup(children = <Probe />, pathname = "/ward-flow/ed/rph") {
  dispatch.mockClear();
  route.pathname = pathname;
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Bridge>{children}</Bridge>
    </WardFlowProvider>,
  );
}
function ready() {
  act(() => {
    state.setCatchmentConfirmed(true);
    state.setCatchmentTeam("Inner City Clinic");
    state.setCatchmentService("East Metro");
    state.setHomeRegion("Perth Metropolitan");
    state.setOriginSiteCode("RPH");
    state.setSourceKind("ed");
    state.setUrgency("2");
    state.setSelectedUnitIds(["rph-adult-secure"]);
    state.setDocumentation({
      medical: "yes",
      expectedAt: "",
      contactName: "",
      contactPhone: "",
      triage: "yes",
      additional: "no",
      charts: ["medication", "observation"].map((kind) => ({
        kind: kind as "medication" | "observation",
        name: "synthetic.pdf",
        mimeType: "application/pdf" as const,
        sizeBytes: 3,
        base64: "YWJj",
      })),
    });
    state.setContact({
      name: "Synthetic Sender",
      email: "synthetic@example.test",
      phone: "0412345678",
      role: "Nurse",
      location: "Synthetic ED",
    });
  });
}
function send() {
  act(() => state.confirmAndSend({ preventDefault() {} } as React.FormEvent));
  expect(state.flowError).toBeNull();
  expect(dispatch).toHaveBeenCalledTimes(1);
  return dispatch.mock.calls[0]![0] as Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }>;
}
function record(event: Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }>, id = "RF-999") {
  // Simulates the JSON snapshot boundary; central reducer tests verify token persistence.
  return JSON.parse(JSON.stringify({ ...baseline.referrals[0], ...event, id, intake: event.intake }));
}
afterEach(() => {
  cleanup();
  clearReferralDraftSession();
  route.push.mockClear();
});

describe("referral command completion across shared snapshots", () => {
  it("ignores an identical concurrent intake and confirms only its accepted submission token", async () => {
    setup(<Probe footer />);
    ready();
    const event = send();
    expect(event.submissionId).toMatch(/^[0-9a-f-]{36}$/i);
    act(() => snapshot([...baseline.referrals, record({ ...event, submissionId: crypto.randomUUID() }, "RF-998")]));
    expect(state.sentReferralId).toBeNull();
    expect(state.sendPending).toBe(true);
    await act(async () => resolve({ commandId: "accepted", status: "accepted" }));
    expect(state.sentReferralId).toBeNull();
    expect(state.sendPending).toBe(false);
    expect(state.submissionAwaitingRecord).toBe(true);
    expect(state.footStatus.first).toContain("Referral saved");
    expect(screen.getByRole("link", { name: "Open referrals board" })).toHaveAttribute("href", "/ward-flow/referrals");
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Confirm and send" })).not.toBeInTheDocument();
    act(() => state.confirmAndSend({ preventDefault() {} } as React.FormEvent));
    expect(dispatch).toHaveBeenCalledTimes(1);
    act(() => snapshot([...baseline.referrals, record(event)]));
    await waitFor(() => expect(state.sentReferralId).toBe("RF-999"));
    expect(state.sendPending).toBe(false);
    expect(readLastReferrerContact()).toMatchObject({ email: "synthetic@example.test" });
    act(() => state.confirmAndSend({ preventDefault() {} } as React.FormEvent));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it.each(["refused", "failed", "cancelled"] as const)(
    "releases %s without losing entered values and permits a retry",
    async (status) => {
      setup();
      ready();
      send();
      await act(async () => resolve({ commandId: "no", status, message: "Synthetic refusal" }));
      expect(state.sendPending).toBe(false);
      expect(state.sentReferralId).toBeNull();
      expect(state.flowError).toBe("Synthetic refusal");
      expect(state.contact.email).toBe("synthetic@example.test");
      expect(state.documentation.charts).toHaveLength(2);
      act(() => state.confirmAndSend({ preventDefault() {} } as React.FormEvent));
      expect(dispatch).toHaveBeenCalledTimes(2);
    },
  );
  it("recovers after a thrown transport failure", async () => {
    setup();
    ready();
    send();
    await act(async () => reject(new Error("Synthetic offline")));
    expect(state.sendPending).toBe(false);
    expect(state.flowError).toContain("Check the Referrals board");
    expect(state.sentReferralId).toBeNull();
  });
  it("does not clear or announce success from a session that has ended", async () => {
    setup();
    ready();
    const event = send();
    clearReferralDraftSession();
    await act(async () => {
      snapshot([...baseline.referrals, record(event)]);
      resolve({ commandId: "old", status: "accepted" });
    });
    expect(state.sentReferralId).toBeNull();
    expect(state.sendPending).toBe(false);
    expect(readLastReferrerContact()).toBeNull();
  });
  it("selects only the accepted new patient, even if another registration arrives last", async () => {
    setup();
    act(() =>
      state.setNewPatient({
        givenName: "Synthetic",
        familyName: "New",
        umrn: "UM999991",
        dateOfBirth: "1990-01-01",
        gender: "",
        suburb: "",
      }),
    );
    act(() => state.addNewPatient({ preventDefault() {} } as React.FormEvent));
    const added = {
      ...baseline.patients[0]!,
      id: "PT-991" as const,
      givenName: "Synthetic",
      familyName: "New",
      umrn: "UM999991",
    };
    act(() => patientSnapshot([...baseline.patients, added, { ...added, id: "PT-992" as const, umrn: "UM999992" }]));
    expect(state.activePatientKey).not.toBe("patient:PT-991");
    await act(async () => resolve({ commandId: "registration", status: "accepted" }));
    expect(state.activePatientKey).toBe("patient:PT-991");
  });
  it.each([
    ["/ward-flow/ed/rph", "ed"],
    // D-80: a ward adds a patient in its own name, with no borrowed role.
    ["/ward-flow/ward/rph-adult-secure", "ward"],
  ] as const)("registers from %s using the supported source actor %s", (pathname, role) => {
    setup(<AddPatientForm />, pathname);
    fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM999993" } });
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Synthetic" } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "New" } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "01/01/1990" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "ADD_PATIENT", role }));
  });
});

it("retires an accepted hidden referral draft before autosave or drawer reopening can duplicate it", async () => {
  const view = setup();
  ready();
  act(() => state.setClinicalSummary("Synthetic accepted intake sentinel."));
  send();
  await act(async () => resolve({ commandId: "accepted-hidden", status: "accepted" }));
  expect(state.submissionAwaitingRecord).toBe(true);
  await act(async () => new Promise((done) => setTimeout(done, 650)));
  expect(readKeptReferralDraft()).toBeNull();
  act(() => state.requestClose());
  expect(state.guardOpen).toBe(false);
  view.unmount();
  expect(readKeptReferralDraft()).toBeNull();
  setup();
  expect(state.clinicalSummary).not.toBe("Synthetic accepted intake sentinel.");
});
