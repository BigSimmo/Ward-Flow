import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardObservationControl } from "@/components/ward-management/ward/ward-observation-control";
import { observationAt } from "@/components/ward-management/ward-observation";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { pickObservationLevel } from "./helpers/ward-choice-chips";
import { AddTimeDialog } from "@/components/ward-management/legal-forms/legal-forms-add-time";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { useEffect, useState } from "react";

function delayed<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(cleanup);

describe("completion owns only its submitted editor draft", () => {
  // Integration (5 Nov 2026): #1437 locks the observation choices while a save is in flight, so no
  // choice can be edited after submission and lost. This replaces #1433's edit-while-saving check.
  it("locks observation choices while the submitted level is saving", async () => {
    const answer = delayed<WardCommandOutcome>();
    const onSave = vi.fn(() => answer.promise);
    render(<WardObservationControl observation={observationAt("general")} now={NOW_ANCHOR} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    pickObservationLevel("two_staff");
    fireEvent.click(screen.getByTestId("ward-observation-save"));
    expect(
      within(screen.getByTestId("ward-observation-level")).getByRole("button", { name: "General" }),
    ).toBeDisabled();
    pickObservationLevel("general");
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => answer.resolve({ commandId: "synthetic-observation", status: "accepted" }));
    expect(screen.queryByTestId("ward-observation-save")).not.toBeInTheDocument();
  });

  it("does not let an unmounted legal time dialog close its replacement", () => {
    let accept!: () => void;
    const onClose = vi.fn();
    function Workspace() {
      const { movements } = useWardFlow();
      const dayZero = new Date("2026-09-23T00:00:00");
      const [opening, setOpening] = useState(0);
      const movement = movements.find((m) => m.legalForm?.code === "1A")!;
      return (
        <>
          <button onClick={() => setOpening((n) => n + 1)}>Replace editor</button>
          <AddTimeDialog
            key={opening}
            movement={movement}
            name="Synthetic record"
            umrn="SYNTHETIC"
            now={NOW_ANCHOR}
            dayZero={dayZero}
            refusal={undefined}
            onClose={onClose}
            onSave={(_written, callback) => {
              accept = callback;
            }}
          />
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Workspace />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Date written"), { target: { value: "23/09/2026" } });
    fireEvent.change(screen.getByPlaceholderText("HH:MM"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save time" }));
    expect(accept).toBeTypeOf("function");
    fireEvent.click(screen.getByRole("button", { name: "Replace editor" }));
    act(() => accept());
    expect(onClose).not.toHaveBeenCalled();
  });
});

// Exercise the real navigation guard against delayed shared outcomes.
import { DischargeCareJourney } from "@/components/ward-management/discharges/discharge-care-journey";
import { WardFlowOverride } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
function CareWorkspace({ recordCare }: { recordCare: WardCommandDispatch }) {
  const value = useWardFlow();
  const actor = { role: "coordinator" } as const;
  const admission = value.admissions.find((a) => a.state === "occupied" && a.patientId)!;
  const [handle, setHandle] = useState<ReturnType<typeof value.openDischargeRecord> | null>(null);
  const read = value.readDischargeRecord(actor, admission.id, handle);
  return (
    <>
      <button onClick={() => setHandle(value.openDischargeRecord(actor, admission.id, "ward-asked"))}>Open care</button>
      <WardFlowOverride
        value={{
          ...value,
          dispatch: (event) => (event.type === "RECORD_ADMISSION_CARE" ? recordCare(event) : value.dispatch(event)),
        }}
      >
        {read.status === "allowed" && <DischargeCareJourney record={read.value} actor={actor} />}
      </WardFlowOverride>
    </>
  );
}
function careStart(recordCare: WardCommandDispatch) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CareWorkspace recordCare={recordCare} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open care" }));
}
function choose(label: string, value: string) {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.input(field);
}
function leaveIsProtected() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
describe("care submissions preserve unsaved sections", () => {
  it("explains the shared lock and keeps a second section dirty after the first accepts", async () => {
    const answer = delayed<WardCommandOutcome>();
    const record = vi.fn(() => answer.promise);
    careStart(record);
    choose("Planning item", "crisis_plan");
    choose("Planning status", "completed");
    fireEvent.submit(screen.getByRole("button", { name: "Record planning item", hidden: true }).closest("form")!);
    choose("Document", "physical");
    choose("Document status", "completed");
    const second = screen.getByRole("button", { name: "Record clinical document", hidden: true });
    expect(second).toBeDisabled();
    fireEvent.submit(second.closest("form")!);
    await act(async () => answer.resolve({ commandId: "synthetic-care", status: "accepted" }));
    expect(record).toHaveBeenCalledTimes(1);
    expect(leaveIsProtected()).toBe(true);
  });
  it("retains unsaved protection after refusal", async () => {
    const answer = delayed<WardCommandOutcome>();
    careStart(() => answer.promise);
    choose("Planning item", "crisis_plan");
    choose("Planning status", "completed");
    fireEvent.submit(screen.getByRole("button", { name: "Record planning item", hidden: true }).closest("form")!);
    await act(async () =>
      answer.resolve({ commandId: "synthetic-refusal", status: "refused", message: "Synthetic refusal" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Synthetic refusal");
    expect(leaveIsProtected()).toBe(true);
  });
});

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
let publishOtherExtension: () => void;
function AlertWorkspace({ recordAlert }: { recordAlert: WardCommandDispatch }) {
  const value = useWardFlow();
  const [extra, setExtra] = useState<EventLogEntry[]>([]);
  useEffect(() => {
    publishOtherExtension = () =>
      setExtra([
        { sequence: 1000001, type: "EXTEND_BROADCAST_ALERT", role: "coordinator", now: NOW_ANCHOR, accepted: true },
      ]);
  }, []);
  const alert: BroadcastAlert = {
    id: "synthetic-alert-A",
    title: "Synthetic alert A",
    message: "Synthetic directive",
    kind: "directive",
    severity: "warning",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "Selected desks",
    targetUnitIds: [value.units[0]!.id],
    durationMinutes: 60,
    dispatchedAt: NOW_ANCHOR,
    expiresAt: NOW_ANCHOR + 60,
    dispatchedByRole: "coordinator",
    dispatchedByName: "Synthetic desk",
    status: "active",
    acknowledgedUnits: [],
  };
  return (
    <WardFlowOverride
      value={{
        ...value,
        eventLog: extra,
        broadcastAlerts: [alert],
        dispatch: (event) =>
          ["EXTEND_BROADCAST_ALERT", "ADD_BROADCAST_ALERT_UNITS"].includes(event.type)
            ? recordAlert(event)
            : value.dispatch(event),
      }}
    >
      <AlertsScreen />
    </WardFlowOverride>
  );
}
function alertStart(recordAlert: WardCommandDispatch) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertWorkspace recordAlert={recordAlert} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: /Broadcasts/u }));
}
afterEach(() => resetWardAccessStoreForTests());
describe("Alerts feedback belongs to its command", () => {
  it("confirms an accepted extension with an empty scoped event log", async () => {
    const answer = delayed<WardCommandOutcome>();
    alertStart(() => answer.promise);
    fireEvent.click(screen.getByRole("button", { name: /^Extend /u }));
    await act(async () => answer.resolve({ commandId: "synthetic-extension-A", status: "accepted" }));
    expect(screen.getByText('Extended "Synthetic alert A".')).toBeInTheDocument();
  });
  it("never lets an unrelated extension log confirm a refused repeated action", async () => {
    const answer = delayed<WardCommandOutcome>();
    alertStart(() => answer.promise);
    const extend = screen.getByRole("button", { name: /^Extend /u });
    fireEvent.click(extend);
    fireEvent.click(extend);
    await act(async () =>
      answer.resolve({ commandId: "synthetic-extension-A", status: "refused", message: "Synthetic alert stood down" }),
    );
    act(() => publishOtherExtension());
    expect(screen.queryByText('Extended "Synthetic alert A".')).not.toBeInTheDocument();
    expect(screen.getByText(/Synthetic alert stood down/u)).toBeInTheDocument();
  });
  it("keeps the chosen desks after a refused add", async () => {
    const answer = delayed<WardCommandOutcome>();
    alertStart(() => answer.promise);
    fireEvent.click(screen.getByRole("button", { name: "Add desks" }));
    const dialog = screen.getByRole("dialog", { name: "Add desks" });
    const checkbox = within(dialog).getAllByRole("checkbox")[0]!;
    fireEvent.click(checkbox);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 1 desk" }));
    expect(screen.getByRole("dialog", { name: "Add desks" })).toBeInTheDocument();
    await act(async () =>
      answer.resolve({ commandId: "synthetic-add", status: "refused", message: "Synthetic refusal" }),
    );
    expect(checkbox).toBeChecked();
    expect(within(dialog).getByText(/Synthetic refusal/u)).toBeInTheDocument();
  });
});

import { WardAcceptedReferralPlacementForm } from "@/components/ward-management/ward/ward-accepted-referral-placement-form";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import type { Referral } from "@/components/ward-management/ward-model";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { chooseChip } from "./helpers/ward-choice-chips";

function PlacementWorkspace({ dispatch, onStarted }: { dispatch: WardCommandDispatch; onStarted: () => void }) {
  const value = useWardFlow();
  const referral: Referral = {
    ...value.referrals[0]!,
    id: "synthetic-community-placement",
    source: "community",
    ageBand: "Adult",
    intake: undefined,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        decidedAt: NOW_ANCHOR,
      },
    ],
  };
  return (
    <WardFlowOverride
      value={{
        ...value,
        dispatch,
        referrals: [referral],
        wardReferralInbox: (id) => wardReferralInboxEntries([referral], id),
      }}
    >
      <WardAcceptedReferralPlacementForm unitId="scgh-adult-open" onStarted={onStarted} onMessage={() => {}} />
    </WardFlowOverride>
  );
}
function DepartureWorkspace({ recordDeparture }: { recordDeparture: () => Promise<WardCommandOutcome> }) {
  const value = useWardFlow();
  const release = value.bedReleases.find((r) => {
    const admission = value.admissions.find((a) => a.id === r.admissionId);
    return (
      r.state !== "discharged" &&
      admission?.state === "occupied" &&
      value.patients.find((p) => p.id === admission.patientId)?.legalStatus === "Voluntary"
    );
  })!;
  return (
    <WardFlowOverride value={{ ...value, recordWardDeparture: recordDeparture }}>
      <output data-testid="synthetic-departure-admission">{release.admissionId}</output>
      <WardScreen unitId={release.unitId} />
    </WardFlowOverride>
  );
}
describe("completion does not dismiss a newer placement or bed visit", () => {
  it("keeps a reopened placement for the same referral", async () => {
    const answer = delayed<WardCommandOutcome>();
    const onStarted = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PlacementWorkspace dispatch={() => answer.promise} onStarted={onStarted} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start placement" }));
    choose("Legal status", "Voluntary");
    choose("Legal form", "none");
    choose("Observation level", "general");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and start placement" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Start placement" }));
    choose("Observation level", "two_staff");
    await act(async () => answer.resolve({ commandId: "synthetic-placement", status: "accepted" }));
    expect(screen.getByLabelText("Observation level")).toHaveValue("two_staff");
    expect(onStarted).not.toHaveBeenCalled();
  });
  it("keeps the next bed drawer after an earlier departure accepts", async () => {
    window.history.replaceState(null, "", "/");
    const answer = delayed<WardCommandOutcome>();
    const recordDeparture = vi.fn(() => answer.promise);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DepartureWorkspace recordDeparture={recordDeparture} />
      </WardFlowProvider>,
    );
    const id = screen.getByTestId("synthetic-departure-admission").textContent!;
    fireEvent.click(document.querySelector(`[data-admission-id="${id}"]`)!);
    fireEvent.click(screen.getByRole("tab", { name: "Leaving" }));
    chooseChip("Where are they going?", "Discharged to the community");
    fireEvent.click(screen.getByRole("button", { name: /Record that they have left/u }));
    fireEvent.click(screen.getByRole("button", { name: "Record discharge" }));
    expect(recordDeparture).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Next bed" }));
    const nextTitle = document.getElementById("drawer-bed-title")!.textContent;
    await act(async () => answer.resolve({ commandId: "synthetic-departure", status: "accepted" }));
    expect(screen.getByTestId("bed-telemetry-drawer")).toBeInTheDocument();
    expect(document.getElementById("drawer-bed-title")!.textContent).toBe(nextTitle);
  });
});

import { renderHook } from "@testing-library/react";
import { useAlertCommandFeedback } from "@/components/ward-management/alerts/use-alert-command-feedback";
const actionA = { type: "EXTEND_BROADCAST_ALERT", ok: "Extended synthetic A", refused: "Synthetic A refused" };
const actionB = { type: "EXTEND_BROADCAST_ALERT", ok: "Extended synthetic B", refused: "Synthetic B refused" };
describe("receipt confirmation and feedback ownership", () => {
  it("follows a matching uncertain command's eventual confirmation", async () => {
    const confirmation = delayed<WardCommandOutcome>();
    const { result } = renderHook(() => useAlertCommandFeedback());
    act(() => {
      result.current.track(actionA, () => ({
        commandId: "synthetic-A",
        status: "failed",
        confirmation: confirmation.promise,
      }));
    });
    expect(result.current.result?.refused).toBe(true);
    await act(async () => confirmation.resolve({ commandId: "synthetic-A", status: "accepted" }));
    expect(result.current.result?.message).toBe(actionA.ok);
  });
  it("rejects another command's confirmation", async () => {
    const confirmation = delayed<WardCommandOutcome>();
    const { result } = renderHook(() => useAlertCommandFeedback());
    act(() => {
      result.current.track(actionA, () => ({
        commandId: "synthetic-A",
        status: "failed",
        confirmation: confirmation.promise,
      }));
    });
    await act(async () => confirmation.resolve({ commandId: "synthetic-B", status: "accepted" }));
    expect(result.current.result?.refused).toBe(true);
  });
  it("preserves normal FIFO feedback and ignores an older completion after a newer action", async () => {
    const old = delayed<WardCommandOutcome>();
    const { result } = renderHook(() => useAlertCommandFeedback());
    act(() => {
      result.current.track(actionA, () => ({ commandId: "synthetic-A", status: "accepted" }));
    });
    expect(result.current.result?.message).toBe(actionA.ok);
    act(() => {
      result.current.track(actionA, () => old.promise);
    });
    act(() => {
      result.current.track(actionB, () => ({ commandId: "synthetic-B", status: "accepted" }));
    });
    await act(async () => old.resolve({ commandId: "synthetic-A", status: "accepted" }));
    expect(result.current.result?.message).toBe(actionB.ok);
  });
});

describe("draft revision and opening protection", () => {
  it("keeps edits to the submitted care section after its earlier revision accepts", async () => {
    const answer = delayed<WardCommandOutcome>();
    careStart(() => answer.promise);
    choose("Planning item", "crisis_plan");
    choose("Planning status", "completed");
    fireEvent.submit(screen.getByRole("button", { name: "Record planning item", hidden: true }).closest("form")!);
    choose("Planning status", "in_progress");
    await act(async () => answer.resolve({ commandId: "synthetic-care-revision", status: "accepted" }));
    expect(leaveIsProtected()).toBe(true);
  });
  it("clears only an accepted unchanged care section", async () => {
    const answer = delayed<WardCommandOutcome>();
    careStart(() => answer.promise);
    choose("Planning item", "crisis_plan");
    choose("Planning status", "completed");
    fireEvent.submit(screen.getByRole("button", { name: "Record planning item", hidden: true }).closest("form")!);
    await act(async () => answer.resolve({ commandId: "synthetic-care-clean", status: "accepted" }));
    expect(leaveIsProtected()).toBe(false);
  });
  it("does not close a reopened Add desks chooser on the old acceptance", async () => {
    const answer = delayed<WardCommandOutcome>();
    alertStart(() => answer.promise);
    fireEvent.click(screen.getByRole("button", { name: "Add desks" }));
    const original = screen.getByRole("dialog", { name: "Add desks" });
    fireEvent.click(within(original).getAllByRole("checkbox")[0]!);
    fireEvent.click(within(original).getByRole("button", { name: "Add 1 desk" }));
    fireEvent.click(within(original).getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add desks" }));
    const reopened = screen.getByRole("dialog", { name: "Add desks" });
    const choice = within(reopened).getAllByRole("checkbox")[1]!;
    fireEvent.click(choice);
    await act(async () => answer.resolve({ commandId: "synthetic-old-add", status: "accepted" }));
    expect(reopened).toBeInTheDocument();
    expect(choice).toBeChecked();
  });
});

describe("broadcast composer stays closed after accepted send", () => {
  it("does not reopen when the next alert action replaces its feedback", () => {
    alertStart(() => ({ commandId: "synthetic-following-extension", status: "accepted" }));
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    fireEvent.click(screen.getByRole("radio", { name: /Tell desks something/u }));
    fireEvent.click(screen.getByRole("button", { name: "Blank" }));
    fireEvent.click(screen.getByRole("button", { name: /^ED desks/u }));
    fireEvent.change(screen.getByLabelText(/^Title$/u), { target: { value: "Synthetic sent directive" } });
    fireEvent.change(screen.getByLabelText(/^Message$/u), { target: { value: "Synthetic test only" } });
    fireEvent.click(screen.getByLabelText(/^I'm authorised to send this to /u));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
    expect(document.querySelector('[aria-labelledby="broadcast-title"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Extend /u }));
    expect(document.querySelector('[aria-labelledby="broadcast-title"]')).toBeNull();
  });
});

import { WardShellPublicProvider } from "@/components/ward-management/shell/ward-shell-public-context";
import { ConfirmHost } from "@/components/wf/confirm-dialog";
describe("returning scopes and delayed discard ownership", () => {
  it("does not resurrect success when returning to an earlier access lifetime", () => {
    const places = {
      unitSiteCode: () => undefined,
      unitService: () => undefined,
      edSiteCode: () => undefined,
      edService: () => undefined,
      teamSlug: (name: string) => name,
    };
    function Feedback() {
      const feedback = useAlertCommandFeedback();
      return (
        <>
          <button
            onClick={() => feedback.track(actionA, () => ({ commandId: "synthetic-scope-A", status: "accepted" }))}
          >
            Record synthetic action
          </button>
          <output data-testid="scoped-feedback">{feedback.result?.message}</output>
        </>
      );
    }
    function Fixture({ lifetime }: { lifetime: string }) {
      return (
        <WardShellPublicProvider
          value={{ places, placeLabel: "Synthetic desk", now: NOW_ANCHOR, accessLifetime: lifetime }}
        >
          <Feedback />
        </WardShellPublicProvider>
      );
    }
    const view = render(<Fixture lifetime="synthetic-A" />);
    fireEvent.click(screen.getByRole("button", { name: "Record synthetic action" }));
    expect(screen.getByTestId("scoped-feedback")).toHaveTextContent(actionA.ok);
    view.rerender(<Fixture lifetime="synthetic-B" />);
    expect(screen.getByTestId("scoped-feedback")).toBeEmptyDOMElement();
    view.rerender(<Fixture lifetime="synthetic-A" />);
    expect(screen.getByTestId("scoped-feedback")).toBeEmptyDOMElement();
  });
  it("does not let an old discard confirmation close a replacement legal editor", async () => {
    const onClose = vi.fn();
    function Editor({ opening }: { opening: number }) {
      const { movements } = useWardFlow();
      const movement = movements.find((m) => m.legalForm?.code === "1A")!;
      return (
        <AddTimeDialog
          key={opening}
          movement={movement}
          name="Synthetic record"
          umrn="SYNTHETIC"
          now={NOW_ANCHOR}
          dayZero={new Date("2026-09-23T00:00:00")}
          refusal={undefined}
          onClose={onClose}
          onSave={() => {}}
        />
      );
    }
    function Fixture({ opening }: { opening: number }) {
      return (
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <ConfirmHost />
          <Editor opening={opening} />
        </WardFlowProvider>
      );
    }
    const view = render(<Fixture opening={1} />);
    fireEvent.change(screen.getByPlaceholderText("HH:MM"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("button", { name: "Discard" });
    view.rerender(<Fixture opening={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await act(async () => {});
    expect(onClose).not.toHaveBeenCalled();
    // The replacement's own confirmation still permits an explicit discard.
    fireEvent.change(screen.getByPlaceholderText("HH:MM"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await act(async () => {});
    expect(onClose).toHaveBeenCalledOnce();
  });
});
