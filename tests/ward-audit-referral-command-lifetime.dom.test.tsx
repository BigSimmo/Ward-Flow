import React, { type ReactNode } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  WardFlowOverride,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import {
  useWardReferralDrawerState,
  type WardReferralDrawerState,
} from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import { ReferralPatientStep } from "@/components/ward-management/referrals/ward-referral-drawer-patient-step";
import { ReferralDrawerFoot } from "@/components/ward-management/referrals/ward-referral-drawer-rail";
import {
  useReferralCommandCompletion,
  useReferralPatientRegistration,
} from "@/components/ward-management/referrals/use-referral-command-completion";
import {
  clearReferralDraftSession,
  referralDraftSessionVersion,
} from "@/components/ward-management/referrals/referral-draft-cache";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { ReferralIntakeDetails } from "@/components/ward-management/referrals/referral-submission";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { PatientRegistrationScope } from "@/components/ward-management/ward-patient-registration";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/ed/rph", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => route,
  useSearchParams: () => new URLSearchParams(),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  void promise.catch(() => {});
  return { promise, resolve, reject };
}
const draft = {
  givenName: "Synthetic",
  familyName: "Registration",
  umrn: "UM999991",
  dateOfBirth: "1990-01-01",
  gender: "" as const,
  suburb: "",
};
afterEach(() => {
  cleanup();
  clearReferralDraftSession();
  vi.restoreAllMocks();
});

function hostHarness(patientStep = true) {
  const completion = deferred<WardCommandOutcome>();
  const dispatch = vi.fn((_event: WardFlowEvent) => {
    void _event;
    return completion.promise;
  });
  let host!: WardReferralDrawerState;
  let baseline!: WardFlowContextValue;
  let updatePatients!: (patients: WardFlowContextValue["patients"]) => void;
  let updateReferrals!: (referrals: WardFlowContextValue["referrals"]) => void;
  function Bridge({ children }: { children: ReactNode }) {
    const base = useWardFlow();
    const [patients, setPatients] = React.useState(base.patients);
    const [referrals, setReferrals] = React.useState(base.referrals);
    React.useEffect(() => {
      baseline = base;
      updatePatients = setPatients;
      updateReferrals = setReferrals;
    }, [base]);
    return <WardFlowOverride value={{ ...base, patients, referrals, dispatch }}>{children}</WardFlowOverride>;
  }
  function Host() {
    const value = useWardReferralDrawerState({
      onClose: vi.fn(),
      onRestart: vi.fn(),
      view: "new",
      onViewChange: vi.fn(),
      initialPatientId: "PT-023",
      initialCategory: "ed",
    });
    React.useEffect(() => {
      host = value;
    });
    return patientStep ? (
      <ReferralPatientStep s={value} alreadyOpen={undefined} alreadyOpenHref={undefined} />
    ) : (
      <ReferralDrawerFoot s={value} />
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Bridge>
        <Host />
      </Bridge>
    </WardFlowProvider>,
  );
  return {
    host: () => host,
    baseline: () => baseline,
    dispatch,
    completion,
    patients: (patients: WardFlowContextValue["patients"]) => updatePatients(patients),
    referrals: (referrals: WardFlowContextValue["referrals"]) => updateReferrals(referrals),
    added: () => ({ ...baseline.patients[0]!, id: "PT-991" as const, ...draft, gender: undefined }),
  };
}

it.each(["cancel and reopen", "choose another patient", "edit the registration"] as const)(
  "does not let a late registration replace current host intent: %s",
  async (change) => {
    const h = hostHarness();
    fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
    act(() => h.host().setNewPatient(draft));
    fireEvent.click(
      within(screen.getByTestId("ward-referral-new-patient")).getByRole("button", { name: /^Add patient$/ }),
    );
    expect(h.dispatch).toHaveBeenCalledTimes(1);
    if (change === "cancel and reopen") {
      fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
      fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
    } else if (change === "choose another patient") {
      fireEvent.click(screen.getByRole("button", { name: /^Change patient$/ }));
      const next = h.baseline().patients.find((patient) => patient.id !== "PT-023" && patient.umrn)!;
      fireEvent.change(screen.getByRole("combobox", { name: "Find a patient" }), { target: { value: next.umrn } });
      fireEvent.click(within(screen.getByRole("listbox", { name: "Matching patients" })).getAllByRole("option")[0]!);
    } else fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Synthetic newer draft" } });
    const selected = h.host().activePatientKey;
    const currentDraft = h.host().newPatient;
    act(() => h.host().setClinicalSummary("Synthetic newer referral edit"));
    act(() => h.patients([...h.baseline().patients, h.added()]));
    await act(async () =>
      h.completion.resolve({ commandId: "synthetic-registration", status: "accepted", isCurrent: () => true }),
    );
    expect(h.host().activePatientKey).toBe(selected);
    expect(h.host().newPatient).toEqual(currentDraft);
    expect(h.host().clinicalSummary).toBe("Synthetic newer referral edit");
    expect(h.host().newPatientError).toBeNull();
  },
);

it("still selects an unchanged registration after its own accepted record arrives", async () => {
  const h = hostHarness();
  fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
  act(() => h.host().setNewPatient(draft));
  fireEvent.click(
    within(screen.getByTestId("ward-referral-new-patient")).getByRole("button", { name: /^Add patient$/ }),
  );
  await act(async () =>
    h.completion.resolve({ commandId: "synthetic-registration", status: "accepted", isCurrent: () => true }),
  );
  expect(h.host().activePatientKey).not.toBe("patient:PT-991");
  act(() => h.patients([...h.baseline().patients, h.added()]));
  expect(h.host().activePatientKey).toBe("patient:PT-991");
});

it("an old registration cannot consume a newer pending registration after Cancel and reopen", async () => {
  const h = hostHarness();
  fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
  act(() => h.host().setNewPatient(draft));
  fireEvent.click(
    within(screen.getByTestId("ward-referral-new-patient")).getByRole("button", { name: /^Add patient$/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
  fireEvent.click(screen.getByTestId("ward-referral-new-patient-toggle"));
  act(() => h.host().setNewPatient({ ...draft, umrn: "UM999992" }));
  const newer = deferred<WardCommandOutcome>();
  h.dispatch.mockImplementationOnce(() => newer.promise);
  fireEvent.click(
    within(screen.getByTestId("ward-referral-new-patient")).getByRole("button", { name: /^Add patient$/ }),
  );
  expect(h.dispatch).toHaveBeenCalledTimes(2);
  act(() => h.patients([...h.baseline().patients, h.added(), { ...h.added(), id: "PT-992", umrn: "UM999992" }]));
  await act(async () =>
    h.completion.resolve({ commandId: "synthetic-old-registration", status: "accepted", isCurrent: () => true }),
  );
  expect(h.host().pendingNewPatient.current?.umrn).toBe("um999992");
  expect(h.host().activePatientKey).not.toBe("patient:PT-991");
  await act(async () =>
    newer.resolve({ commandId: "synthetic-new-registration", status: "accepted", isCurrent: () => true }),
  );
  expect(h.host().activePatientKey).toBe("patient:PT-992");
});

it.each(["sender role", "registration scope", "world", "session"] as const)(
  "fences registration completion when its %s changes",
  async (change) => {
    const completion = deferred<WardCommandOutcome>();
    const onSelect = vi.fn();
    const initial: {
      role: "ed" | "community";
      registrationScope: PatientRegistrationScope;
      generation: number;
      patients: WardFlowContextValue["patients"];
    } = { role: "ed", registrationScope: { kind: "ed", placeId: "rph" }, generation: 1, patients: [] };
    const { result, rerender } = renderHook(
      (props) =>
        useReferralPatientRegistration({
          ...props,
          now: NOW_ANCHOR,
          allowed: true,
          patient: draft,
          dispatch: () => completion.promise,
          onSelect,
        }),
      { initialProps: initial },
    );
    act(() => result.current.addNewPatient({ preventDefault() {} } as React.FormEvent));
    const changed = {
      ...initial,
      patients: [
        {
          id: "PT-991" as const,
          umrn: draft.umrn,
          givenName: draft.givenName,
          familyName: draft.familyName,
          dateOfBirth: draft.dateOfBirth,
        },
      ],
      role: change === "sender role" ? ("community" as const) : initial.role,
      registrationScope:
        change === "registration scope" ? { kind: "ed" as const, placeId: "another-ed" } : initial.registrationScope,
      generation: change === "world" ? 2 : 1,
    };
    if (change === "session") clearReferralDraftSession();
    rerender(changed);
    await act(async () =>
      completion.resolve({ commandId: "synthetic-registration", status: "accepted", isCurrent: () => true }),
    );
    expect(onSelect).not.toHaveBeenCalled();
  },
);

it("does not select an accepted registration whose command lifetime ended before its record arrived", async () => {
  const completion = deferred<WardCommandOutcome>();
  const onSelect = vi.fn();
  let current = true;
  const { result, rerender } = renderHook(
    ({ patients }) =>
      useReferralPatientRegistration({
        patients,
        generation: 1,
        dispatch: () => completion.promise,
        now: NOW_ANCHOR,
        role: "ed",
        allowed: true,
        patient: draft,
        onSelect,
      }),
    { initialProps: { patients: [] as WardFlowContextValue["patients"] } },
  );
  act(() => result.current.addNewPatient({ preventDefault() {} } as React.FormEvent));
  await act(async () =>
    completion.resolve({ commandId: "synthetic-registration", status: "accepted", isCurrent: () => current }),
  );
  current = false;
  rerender({
    patients: [
      {
        id: "PT-991" as const,
        umrn: draft.umrn,
        givenName: draft.givenName,
        familyName: draft.familyName,
        dateOfBirth: draft.dateOfBirth,
      },
    ],
  });
  expect(onSelect).not.toHaveBeenCalled();
});

function ready(h: ReturnType<typeof hostHarness>) {
  act(() => {
    const s = h.host();
    s.setCatchmentConfirmed(true);
    s.setCatchmentTeam("Inner City Clinic");
    s.setCatchmentService("East Metro");
    s.setHomeRegion("Perth Metropolitan");
    s.setOriginSiteCode("RPH");
    s.setSourceKind("ed");
    s.setUrgency("2");
    s.setSelectedUnitIds(["rph-adult-secure"]);
    s.setDocumentation({
      medical: "yes",
      expectedAt: "",
      contactName: "",
      contactPhone: "",
      triage: "yes",
      additional: "no",
      charts: ["medication", "observation"].map((kind) => ({
        kind: kind as "medication" | "observation",
        name: "synthetic.pdf",
        mimeType: "application/pdf",
        sizeBytes: 3,
        base64: "YWJj",
      })),
    });
    s.setContact({
      name: "Synthetic Sender",
      email: "synthetic@example.test",
      phone: "0412345678",
      role: "Nurse",
      location: "Synthetic ED",
    });
  });
}

it("keeps the actual host Send locked through uncertain same-command confirmation and retires the accepted draft", async () => {
  const h = hostHarness(false);
  ready(h);
  act(() => h.host().confirmAndSend({ preventDefault() {} } as React.FormEvent));
  expect(h.dispatch).toHaveBeenCalledTimes(1);
  const event = h.dispatch.mock.calls[0]![0] as Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }>;
  const confirmation = deferred<WardCommandOutcome>();
  await act(async () =>
    h.completion.resolve({
      commandId: "synthetic-referral-command",
      status: "failed",
      message: "Synthetic uncertain save",
      confirmation: confirmation.promise,
      isCurrent: () => true,
    }),
  );
  expect(h.host().sendPending).toBe(true);
  expect(h.host().submissionRef.current?.id).toBe(event.submissionId);
  expect(screen.getByRole("button", { name: /Sending/ })).toBeDisabled();
  act(() => h.host().confirmAndSend({ preventDefault() {} } as React.FormEvent));
  expect(h.dispatch).toHaveBeenCalledTimes(1);
  await act(async () =>
    confirmation.resolve({ commandId: "synthetic-referral-command", status: "accepted", isCurrent: () => true }),
  );
  expect(h.host().flowError).toBeNull();
  expect(h.host().submissionAwaitingRecord).toBe(true);
  expect(h.host().sentReferralId).toBeNull();
  expect(screen.getByRole("link", { name: "Open referrals board" })).toBeInTheDocument();
  act(() => h.host().confirmAndSend({ preventDefault() {} } as React.FormEvent));
  expect(h.dispatch).toHaveBeenCalledTimes(1);
  const record = JSON.parse(JSON.stringify({ ...h.baseline().referrals[0], ...event, id: "RF-999" }));
  act(() => h.referrals([...h.baseline().referrals, record]));
  expect(h.host().sentReferralId).toBe("RF-999");
  expect(h.host().sendPending).toBe(false);
});

function submissionHarness() {
  const confirmation = deferred<WardCommandOutcome>();
  const failed: WardCommandOutcome = {
    commandId: "synthetic-referral-command",
    status: "failed",
    confirmation: confirmation.promise,
    isCurrent: () => true,
  };
  const dispatch = vi.fn((_event: WardFlowEvent) => {
    void _event;
    return Promise.resolve(failed);
  });
  const onCommitted = vi.fn();
  const onAccepted = vi.fn();
  const onError = vi.fn();
  const owner = referralDraftSessionVersion();
  const { result, rerender } = renderHook(
    ({ referrals, generation }) => {
      const [pending, setPending] = React.useState(false);
      return {
        ...useReferralCommandCompletion({
          dispatch,
          referrals,
          generation,
          draftOwnerVersion: owner,
          setPending,
          onError,
          onCommitted,
          onAccepted,
        }),
        pending,
      };
    },
    { initialProps: { referrals: [] as WardFlowContextValue["referrals"], generation: 1 } },
  );
  const event = {
    type: "RECEIVE_REFERRAL",
    role: "ed",
    now: NOW_ANCHOR,
    intake: {} as ReferralIntakeDetails,
  } as Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }> & { intake: ReferralIntakeDetails };
  return { confirmation, failed, dispatch, onCommitted, onAccepted, onError, result, rerender, event };
}

it("commits a matching confirmed referral exactly once and accepts only its matching record", async () => {
  const h = submissionHarness();
  await act(async () => h.result.current.submitReferral(h.event));
  const id = h.result.current.submissionRef.current!.id;
  await act(async () =>
    h.confirmation.resolve({ commandId: h.failed.commandId, status: "accepted", isCurrent: () => true }),
  );
  expect(h.onCommitted).toHaveBeenCalledTimes(1);
  expect(h.onAccepted).not.toHaveBeenCalled();
  const record = { id: "RF-SYNTHETIC", submissionId: id } as WardFlowContextValue["referrals"][number];
  h.rerender({ referrals: [record], generation: 1 });
  h.rerender({ referrals: [{ ...record }], generation: 1 });
  expect(h.onCommitted).toHaveBeenCalledTimes(1);
  expect(h.onAccepted).toHaveBeenCalledTimes(1);
});

it.each(["mismatched command", "rejected confirmation", "retired outcome", "changed world"] as const)(
  "never commits an uncertain referral on %s",
  async (change) => {
    const h = submissionHarness();
    await act(async () => h.result.current.submitReferral(h.event));
    if (change === "changed world") h.rerender({ referrals: [], generation: 2 });
    await act(async () => {
      if (change === "rejected confirmation") h.confirmation.reject(new Error("Synthetic unconfirmed result"));
      else
        h.confirmation.resolve({
          commandId: change === "mismatched command" ? "another-synthetic-command" : h.failed.commandId,
          status: "accepted",
          isCurrent: () => change !== "retired outcome",
        });
    });
    expect(h.onCommitted).not.toHaveBeenCalled();
    expect(h.onAccepted).not.toHaveBeenCalled();
    if (change === "mismatched command" || change === "rejected confirmation") {
      expect(h.result.current.pending).toBe(true);
      await act(async () => h.result.current.submitReferral(h.event));
      expect(h.dispatch).toHaveBeenCalledTimes(1);
    }
  },
);
