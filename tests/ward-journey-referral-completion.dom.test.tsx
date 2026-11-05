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
import { ReferralPatientStep } from "@/components/ward-management/referrals/ward-referral-drawer-patient-step";
import { ReferralConfirmation } from "@/components/ward-management/referrals/ward-referral-drawer-letter";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";

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
function Probe({ footer = false, panels = false }: { footer?: boolean; panels?: boolean }) {
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
  return <ProbeView s={value} footer={footer} panels={panels} />;
}
function ProbeView({ s, footer, panels }: { s: WardReferralDrawerState; footer: boolean; panels: boolean }) {
  const { drawerRef, bodyRef, confirmationOpen } = s;
  return (
    <div ref={drawerRef}>
      {panels ? (
        <div ref={bodyRef}>
          <ReferralPatientStep s={s} alreadyOpen={undefined} alreadyOpenHref={undefined} />
          {confirmationOpen ? <ReferralConfirmation s={s} /> : null}
        </div>
      ) : null}
      {footer ? <ReferralDrawerFoot s={s} /> : null}
      <WardLiveRegion />
    </div>
  );
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
  resetWardLiveRegionForTests();
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
    const savedAnnouncement = screen.getByTestId("ward-live-region").textContent;
    expect(savedAnnouncement).toContain("Referral saved");
    expect(screen.getByRole("link", { name: "Open referrals board" })).toHaveAttribute("href", "/ward-flow/referrals");
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Confirm and send" })).not.toBeInTheDocument();
    act(() => state.confirmAndSend({ preventDefault() {} } as React.FormEvent));
    expect(dispatch).toHaveBeenCalledTimes(1);
    act(() => snapshot([...baseline.referrals, record(event)]));
    await waitFor(() => expect(state.sentReferralId).toBe("RF-999"));
    expect(screen.getByTestId("ward-live-region").textContent).toBe(savedAnnouncement);
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
    setup(<Probe panels />);
    act(() => {
      state.setActiveSection("patient");
      state.setNewPatientOpen(true);
    });
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
    const add = screen
      .getByTestId("ward-referral-new-patient")
      .querySelector<HTMLButtonElement>("button[type=submit]")!;
    add.focus();
    fireEvent.click(add);
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
    await waitFor(() => expect(screen.getByRole("heading", { name: "Patient", level: 3 })).toHaveFocus());
    expect(screen.getByTestId("ward-live-region")).toHaveTextContent("Selected patient");
  });
  it("keeps registration focus and entered values after an asynchronous refusal", async () => {
    setup(<Probe panels />);
    act(() => {
      state.setActiveSection("patient");
      state.setNewPatientOpen(true);
      state.setNewPatient({
        givenName: "Synthetic",
        familyName: "New",
        umrn: "UM999991",
        dateOfBirth: "1990-01-01",
        gender: "",
        suburb: "",
      });
    });
    const add = screen
      .getByTestId("ward-referral-new-patient")
      .querySelector<HTMLButtonElement>("button[type=submit]")!;
    add.focus();
    fireEvent.click(add);
    await act(async () =>
      resolve({ commandId: "registration-refused", status: "refused", message: "Synthetic refusal" }),
    );
    expect(add).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Synthetic refusal");
    expect(screen.getByLabelText("Given name")).toHaveValue("Synthetic");
  });
  it("focuses the first invalid contact field when confirmation is refused", async () => {
    setup(<Probe panels footer />);
    ready();
    act(() => {
      state.setContact((contact) => ({ ...contact, name: "", email: "" }));
      state.handleDispatch();
    });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Confirm and send" })).toHaveFocus());
    const confirm = screen.getByRole("button", { name: "Confirm and send" });
    confirm.focus();
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByLabelText("Your name")).toHaveFocus());
    expect(screen.getByLabelText("Your name")).toHaveAttribute("aria-invalid", "true");
    expect(dispatch).not.toHaveBeenCalled();
    expect(state.contact.phone).toBe("0412345678");
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

it.each(["direct", "later confirmation", "initial answer after close"])(
  "retires a kept referral after its drawer unmounts on %s acceptance",
  async (mode) => {
    const view = setup();
    ready();
    act(() => state.setClinicalSummary("Synthetic pending referral draft."));
    send();
    let confirm!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((yes) => {
      confirm = yes;
    });
    if (mode === "later confirmation") {
      await act(async () => resolve({ commandId: "held-referral", status: "failed", confirmation }));
    }
    act(() => state.requestClose());
    expect(state.guardOpen).toBe(true);
    act(() => state.keepAndClose());
    view.unmount();
    expect(readKeptReferralDraft()).not.toBeNull();
    if (mode === "initial answer after close") {
      await act(async () => resolve({ commandId: "held-referral", status: "failed", confirmation }));
    }
    await act(async () => {
      const accepted: WardCommandOutcome = { commandId: "held-referral", status: "accepted" };
      if (mode === "direct") resolve(accepted);
      else confirm(accepted);
    });
    expect(readKeptReferralDraft()).toBeNull();
    setup();
    expect(state.clinicalSummary).not.toBe("Synthetic pending referral draft.");
  },
);

it("an old accepted referral preserves newer kept content after its drawer closes", async () => {
  const view = setup();
  ready();
  act(() => state.setClinicalSummary("Synthetic submitted revision."));
  send();
  act(() => state.keepAndClose());
  view.unmount();
  setup();
  act(() => state.setClinicalSummary("Synthetic newer unsent revision."));
  act(() => state.keepAndClose());
  await act(async () => resolve({ commandId: "old-referral", status: "accepted" }));
  expect(readKeptReferralDraft()).toMatchObject({ clinicalSummary: "Synthetic newer unsent revision." });
});

it("an old accepted referral preserves replacement chart bytes with identical metadata", async () => {
  const view = setup();
  ready();
  send();
  act(() => state.keepAndClose());
  view.unmount();
  setup();
  act(() =>
    state.setDocumentation({
      ...state.documentation,
      charts: state.documentation.charts.map((chart) => ({ ...chart, base64: "ZGVm" })),
    }),
  );
  act(() => state.keepAndClose());
  await act(async () => resolve({ commandId: "old-chart-referral", status: "accepted" }));
  expect(readKeptReferralDraft()).toMatchObject({
    documentation: {
      charts: [expect.objectContaining({ base64: "ZGVm" }), expect.objectContaining({ base64: "ZGVm" })],
    },
  });
});
