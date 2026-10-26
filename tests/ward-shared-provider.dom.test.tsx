import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WardDataModeSlot,
  useWardDataMode,
  type WardSharedConnection,
} from "../src/components/ward-management/ward-shared-access";
import { WardFlowProvider, useWardFlow } from "../src/components/ward-management/ward-flow-provider";
import { WardDemoMenu } from "../src/components/ward-management/shell/ward-demo-menu";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { AlertsScreen } from "../src/components/ward-management/alerts/alerts-screen";
import { eventLogEntryFor } from "../src/components/ward-management/ward-event-log";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  giveCover,
  readWardAccessSnapshot,
  setWardAccess,
  resetWardAccessStoreForTests,
} from "../src/components/ward-management/shell/ward-access-store";
import { allEmergencyDepartments } from "../src/components/ward-management/ward-sites";
import { breakGlassRefusal, scopeWorld, seedWorld } from "../backend/ward-flow/engine";
import { DowntimePackScreen } from "../src/components/ward-management/reports/downtime-pack-screen";
import { forgetDowntimePack, lastDowntimePack } from "../src/components/ward-management/reports/downtime-pack";
import { ToastProvider } from "../src/components/wf";
import {
  DocumentationPanel,
  EMPTY_DOCUMENTATION,
  ReferralDocumentLinks,
} from "../src/components/ward-management/referrals/referral-flow-panels";

const loadDemoMenu = async () => WardDemoMenu;
const fake = vi.hoisted(() => ({ connection: null as WardSharedConnection | null }));
vi.mock("../src/components/ward-management/ward-shared-access", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-shared-access")>();
  return { ...actual, useWardShared: (enabled: boolean) => ({ ...fake.connection!, enabled }) };
});
function Probe() {
  const { configuration, now, dispatch } = useWardFlow();
  return (
    <>
      <output>{configuration.pullHoldMinutes}</output>
      <input aria-label="Local draft" defaultValue="draft" />
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 })}>
        Advance
      </button>
    </>
  );
}
/** The phone menu's way into the hospital records notice (`useWardDataMode`). */
function HospitalRecordsLink() {
  const mode = useWardDataMode();
  return (
    <button type="button" onClick={mode?.openHospitalRecords}>
      Hospital records (unavailable)
    </button>
  );
}
function DataModeDetail() {
  return <p data-testid="data-mode-detail">{useWardDataMode()?.detail ?? "no data mode"}</p>;
}
function PatientIdsProbe() {
  const { patients } = useWardFlow();
  return (
    <>
      <output data-testid="patient-ids">{patients.map((patient) => patient.id).join(",")}</output>
      <input aria-label="Scoped draft" defaultValue="draft" />
    </>
  );
}
/** No standalone data-mode bar: without a header slot nothing is drawn, but the mode is still published. */
function expectNoStandaloneDataModeControl() {
  expect(screen.queryByRole("button", { name: /^Data mode: Synthetic prototype/ })).toBeNull();
  expect(screen.queryByRole("group", { name: "Data mode controls" })).toBeNull();
  expect(screen.queryByText("Data mode: Synthetic prototype")).toBeNull();
}
function connection(): WardSharedConnection {
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0)));
  state.configuration.pullHoldMinutes = 45;
  return {
    enabled: true,
    signedIn: true,
    status: "ready",
    error: null,
    eventLog: [],
    receivedAt: Date.now(),
    snapshot: {
      accessContext: "a".repeat(64),
      dataMode: "prototype",
      revision: 1,
      now: 642,
      payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
    },
    dispatch: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
  };
}
beforeEach(() => {
  fake.connection = connection();
  vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
});
afterEach(() => {
  forgetDowntimePack();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("shared provider boundary", () => {
  it("remounts desk forms after adopting a changed effective access context", () => {
    const tree = () => (
      <WardFlowProvider>
        <PatientIdsProbe />
      </WardFlowProvider>
    );
    const { rerender } = render(tree());
    const initial = screen.getByLabelText("Scoped draft");
    fireEvent.change(initial, { target: { value: "Synthetic previous desk draft" } });
    // A normal save must keep the current form's unsent edits.
    fake.connection = {
      ...fake.connection!,
      snapshot: { ...fake.connection!.snapshot!, revision: 2 },
    };
    rerender(tree());
    expect(screen.getByLabelText("Scoped draft")).toBe(initial);
    expect(initial).toHaveValue("Synthetic previous desk draft");
    // Cover/grant expiry can change context without another clinical revision.
    fake.connection = {
      ...fake.connection!,
      snapshot: { ...fake.connection!.snapshot!, accessContext: "b".repeat(64) },
    };
    rerender(tree());
    expect(screen.getByLabelText("Scoped draft")).not.toBe(initial);
    expect(screen.getByLabelText("Scoped draft")).toHaveValue("draft");
  });

  it("keeps the frozen report through ordinary same-account clinical snapshot adoption", () => {
    const tree = () => (
      <ToastProvider>
        <WardFlowProvider>
          <DowntimePackScreen />
        </WardFlowProvider>
      </ToastProvider>
    );
    const { rerender } = render(tree());
    const frozen = lastDowntimePack();
    expect(frozen).not.toBeNull();
    const snapshot = fake.connection!.snapshot!;
    fake.connection = {
      ...fake.connection!,
      snapshot: {
        ...snapshot,
        revision: snapshot.revision + 1,
        payload: {
          ...snapshot.payload,
          state: {
            ...snapshot.payload.state,
            configuration: { ...snapshot.payload.state.configuration, pullHoldMinutes: 60 },
          },
        },
      },
    };
    rerender(tree());
    expect(lastDowntimePack()).toBe(frozen);
  });

  it("takes a new account's same-revision report only after its narrower payload is adopted", () => {
    const tree = () => (
      <ToastProvider>
        <WardFlowProvider>
          <DowntimePackScreen />
        </WardFlowProvider>
      </ToastProvider>
    );
    const { rerender } = render(tree());
    const broad = lastDowntimePack()!;
    expect(broad.edQueue.length).toBeGreaterThan(0);
    const snapshot = fake.connection!.snapshot!;
    const access = { role: "ward", scope: { kind: "ward", unitIds: [snapshot.payload.state.units[0].id] } } as const;
    const own = scopeWorld(snapshot.payload, access, new Date(snapshot.payload.startedAt));
    const expected = own.state.movements
      .filter(
        (movement) =>
          movement.closure === undefined &&
          movement.stage !== "moving" &&
          movement.stage !== "arrived" &&
          movement.leftDepartmentAt === undefined,
      )
      .map((movement) => movement.id)
      .sort();
    expect(expected.length).toBeLessThan(broad.edQueue.length);
    fake.connection = {
      ...fake.connection!,
      actorId: "ACCOUNT-NEW",
      access,
      snapshot: { ...snapshot, payload: own },
    };
    rerender(tree());
    expect(lastDowntimePack()).not.toBe(broad);
    expect(
      lastDowntimePack()!
        .edQueue.map((line) => line.movementId)
        .sort(),
    ).toEqual(expected);
  });

  it("drops a broader frozen report when the same account's authoritative access context narrows", () => {
    const tree = () => (
      <ToastProvider>
        <WardFlowProvider>
          <DowntimePackScreen />
        </WardFlowProvider>
      </ToastProvider>
    );
    const { rerender } = render(tree());
    const broad = lastDowntimePack()!;
    expect(broad.edQueue.length).toBeGreaterThan(0);
    const snapshot = fake.connection!.snapshot!;
    const own = scopeWorld(
      snapshot.payload,
      {
        role: "ward",
        scope: { kind: "ward", unitIds: [snapshot.payload.state.units[0].id] },
      },
      new Date(snapshot.payload.startedAt),
    );
    fake.connection = {
      ...fake.connection!,
      snapshot: { ...snapshot, payload: own, accessContext: "b".repeat(64) },
    };
    rerender(tree());
    const current = lastDowntimePack()!;
    expect(current).not.toBe(broad);
    expect(current.edQueue.length).toBeLessThan(broad.edQueue.length);
    expect(
      current.edQueue.every((line) => own.state.movements.some((movement) => movement.id === line.movementId)),
    ).toBe(true);
  });

  it("withholds a shared report and print until the server confirms an access context", () => {
    fake.connection = { ...fake.connection!, snapshot: { ...fake.connection!.snapshot!, accessContext: undefined } };
    render(
      <ToastProvider>
        <WardFlowProvider>
          <DowntimePackScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    expect(lastDowntimePack()).toBeNull();
    expect(screen.queryByTestId("ward-downtime-print")).toBeNull();
    expect(screen.getByText(/current access must be confirmed/u)).toBeInTheDocument();
  });

  it("adopts opened and closed break-glass records at the same clinical revision without remounting drafts", () => {
    const at = new Date("2026-10-16T00:00:00Z");
    const world = seedWorld(at);
    const access = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } } as const;
    const own = scopeWorld(world, access, at);
    const patient = world.state.patients.find(
      (candidate) => breakGlassRefusal(world, access, candidate.id, at) === null,
    )!;
    const opened = scopeWorld(world, access, at, [
      { patientId: patient.id, until: new Date(at.getTime() + 30 * 60_000) },
    ]);
    expect(own.state.patients.some((row) => row.id === patient.id)).toBe(false);
    expect(opened.state.patients.some((row) => row.id === patient.id)).toBe(true);
    fake.connection = {
      ...fake.connection!,
      access,
      snapshot: { ...fake.connection!.snapshot!, payload: own },
    };
    const tree = () => (
      <WardFlowProvider>
        <PatientIdsProbe />
      </WardFlowProvider>
    );
    const { rerender } = render(tree());
    const draft = screen.getByLabelText("Scoped draft");
    fireEvent.change(draft, { target: { value: "keep this draft" } });
    const ownIds = own.state.patients.map((row) => row.id).join(",");
    const openedIds = opened.state.patients.map((row) => row.id).join(",");
    expect(screen.getByTestId("patient-ids")).toHaveTextContent(ownIds);

    fake.connection = { ...fake.connection, snapshot: { ...fake.connection.snapshot!, payload: opened } };
    rerender(tree());
    expect(screen.getByTestId("patient-ids").textContent).toBe(openedIds);
    expect(screen.getByLabelText("Scoped draft")).toBe(draft);
    expect(draft).toHaveValue("keep this draft");

    fake.connection = { ...fake.connection, snapshot: { ...fake.connection.snapshot!, payload: own } };
    rerender(tree());
    expect(screen.getByTestId("patient-ids").textContent).toBe(ownIds);
    expect(screen.getByLabelText("Scoped draft")).toBe(draft);
    expect(draft).toHaveValue("keep this draft");
    resetWardAccessStoreForTests();
  });
  it.each([true, false])("shows the confirmed shared broadcast outcome (accepted: %s)", (accepted) => {
    const tree = () => (
      <WardFlowProvider>
        <AlertsScreen />
      </WardFlowProvider>
    );
    const { rerender } = render(tree());
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    fireEvent.change(screen.getByLabelText(/^Target scope$/i), { target: { value: "forensic" } });
    const title = screen.getByLabelText(/^Title$/i) as HTMLInputElement;
    const message = screen.getByLabelText(/^Directive$/i) as HTMLTextAreaElement;
    const draft = { title: title.value, message: message.value };
    fireEvent.click(screen.getByLabelText(/I confirm this directive is clinically authorised/i));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));
    expect(fake.connection!.dispatch).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("ward-alerts-broadcast-confirm")).toBeDisabled();
    expect(screen.queryByRole("status", { name: "Broadcast feedback" })).toBeNull();
    expect(screen.queryByRole("alert", { name: "Broadcast feedback" })).toBeNull();
    const dispatched = vi.mocked(fake.connection!.dispatch).mock.calls[0][0] as WardFlowEvent;
    expect(dispatched.type).toBe("DISPATCH_BROADCAST_ALERT");
    const revision = fake.connection!.snapshot!.revision;
    fake.connection = { ...fake.connection!, eventLog: [eventLogEntryFor(dispatched, accepted)] };
    rerender(tree());
    expect(fake.connection.snapshot!.revision).toBe(revision);
    if (accepted) {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("status", { name: "Broadcast feedback" })).toHaveTextContent(
        "shown in this prototype for Frankland Centre Forensic Mental Health only; no external notifications are sent.",
      );
    } else {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("alert", { name: "Broadcast feedback" })).toHaveTextContent(
        "Broadcast was not accepted. Your draft has been kept.",
      );
      expect(title.value).toBe(draft.title);
      expect(message.value).toBe(draft.message);
      expect(screen.getByLabelText(/^Target scope$/i)).toHaveValue("forensic");
      expect(screen.getByTestId("ward-alerts-broadcast-confirm")).toBeEnabled();
    }
  });
  it("keeps the demonstration local when shared mode is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    render(
      <WardFlowProvider>
        <Probe />
        <DataModeDetail />
      </WardFlowProvider>,
    );
    expectNoStandaloneDataModeControl();
    expect(screen.getByTestId("data-mode-detail")).toHaveTextContent("Invented records · Local demonstration");
    expect(screen.queryByText("45")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(String(seedWardFlowStateAt(0).configuration.pullHoldMinutes));
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));
    expect(fake.connection!.dispatch).not.toHaveBeenCalled();
  });
  it("keeps a pinned demonstration local even when shared mode is enabled", () => {
    render(
      <WardFlowProvider initialNow={642}>
        <Probe />
        <WardDataModeSlot />
      </WardFlowProvider>,
    );
    expect(
      screen.getByRole("button", {
        name: "Data mode: Synthetic prototype. Invented records · Local demonstration. Opens the demo menu",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("45")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(String(seedWardFlowStateAt(0).configuration.pullHoldMinutes));
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));
    expect(fake.connection!.dispatch).not.toHaveBeenCalled();
  });
  it("explains live data without switching databases or losing a prototype draft", async () => {
    render(
      <WardFlowProvider>
        <Probe />
        <HospitalRecordsLink />
        {/* The header passes the Demo menu's loader in (ward-bar.tsx), so the pill does not import it. */}
        <WardDataModeSlot menu={loadDemoMenu} />
      </WardFlowProvider>,
    );
    const draft = screen.getByRole("textbox");
    fireEvent.change(draft, { target: { value: "keep prototype draft" } });
    // Exactly one data-mode control, in the header slot. Change 8 (D-77): it opens the Demo menu,
    // and its label still says what the data is.
    const pill = screen.getByRole("button", { name: /^Data mode: Synthetic prototype/ });
    expect(screen.getAllByRole("button", { name: /^Data mode: Synthetic prototype/ })).toHaveLength(1);
    expect(screen.queryByText("Data mode: Synthetic prototype")).toBeNull();
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "true");
    const menu = await screen.findByRole("dialog", { name: "Demo" });
    // Focus moves into the menu, so Tab reaches it from the Board time pill too.
    await vi.waitFor(() => expect(menu).toContainElement(document.activeElement as HTMLElement));
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Hospital records (unavailable)" }));
    expect(screen.getByRole("heading", { name: "Hospital records are not connected" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(fake.connection!.dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Return to prototype" }));
    expect(screen.getByRole("textbox")).toBe(draft);
    expect(draft).toHaveValue("keep prototype draft");
  });
  it("takes the desk from the server's role, and offers a switch only after a choice", () => {
    const access = { role: "ed", scope: { kind: "ed", edId: allEmergencyDepartments()[0]!.id } };
    fake.connection = { ...fake.connection!, access, workingAs: "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d" };
    const tree = () => (
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>
    );
    const { rerender } = render(tree());
    expect(
      screen.getByText(
        `ED mental health clinician, ${allEmergencyDepartments()[0]!.name} · shared synthetic workspace`,
      ),
    ).toBeInTheDocument();
    expect(readWardAccessSnapshot().desk).toEqual(access);
    expect(screen.queryByRole("button", { name: "Switch role" })).toBeNull();
    const switchRole = vi.fn();
    fake.connection = { ...fake.connection!, canSwitch: true, switchRole };
    rerender(tree());
    fireEvent.click(screen.getByRole("button", { name: "Switch role" }));
    expect(switchRole).toHaveBeenCalledOnce();
    resetWardAccessStoreForTests();
  });
  it("drops the local demo's covers once the server's role is taken, so they never widen it", () => {
    const [unitA, unitB] = seedWardFlowStateAt(0).units.map((unit) => unit.id);
    const access = { role: "ward", scope: { kind: "ward", unitIds: [unitA!] } } as const;
    setWardAccess(access);
    giveCover({ recipient: access, scope: { kind: "ward", unitIds: [unitB!] }, now: 0, until: 10_000 });
    expect(readWardAccessSnapshot().access.scope).toEqual({ kind: "ward", unitIds: [unitA, unitB] });
    fake.connection = { ...fake.connection!, access };
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(readWardAccessSnapshot().covers).toEqual([]);
    expect(readWardAccessSnapshot().access).toEqual(access);
    resetWardAccessStoreForTests();
  });
  it("adopts server state without reading or writing browser demo storage", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByText("Coordinator · shared synthetic workspace")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));
    expect(fake.connection!.dispatch).toHaveBeenCalledOnce();
    expect(screen.getByText("45")).toBeInTheDocument();
  });
  it("keeps drafts mounted while a newly committed server revision is adopted", () => {
    const tree = (
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>
    );
    const { rerender } = render(tree);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "keep this draft" } });
    fake.connection = {
      ...fake.connection!,
      snapshot: {
        ...fake.connection!.snapshot!,
        revision: 2,
        payload: {
          ...fake.connection!.snapshot!.payload,
          state: {
            ...fake.connection!.snapshot!.payload.state,
            configuration: { ...fake.connection!.snapshot!.payload.state.configuration, pullHoldMinutes: 60 },
          },
        },
      },
    };
    rerender(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveValue("keep this draft");
    expect(screen.getByText("60")).toBeInTheDocument();
  });
  it("gives keyboard focus back to the control that acted once a shared save ends (audit F-09)", () => {
    const tree = () => (
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>
    );
    const { rerender } = render(tree());
    const button = screen.getByRole("button", { name: "Advance" });
    button.focus();
    fake.connection = { ...fake.connection!, status: "saving" };
    rerender(tree());
    expect(button.closest("[inert]")).not.toBeNull();
    // A browser drops focus from an inert subtree; jsdom does not, so do it here.
    button.blur();
    expect(document.activeElement).toBe(document.body);
    fake.connection = { ...fake.connection!, status: "ready" };
    rerender(tree());
    expect(document.activeElement).toBe(button);
    // Focus the person moved elsewhere in the meantime is left where it is.
    fake.connection = { ...fake.connection!, status: "saving" };
    rerender(tree());
    const draft = screen.getByRole("textbox");
    fake.connection = { ...fake.connection!, status: "ready" };
    draft.focus();
    rerender(tree());
    expect(document.activeElement).toBe(draft);
  });
  it("says what each mode keeps of a referral's files, and links only a file it holds (audit F-01)", () => {
    const panel = <DocumentationPanel draft={EMPTY_DOCUMENTATION} onChange={() => {}} />;
    const { unmount } = render(panel);
    expect(screen.getByText("Synthetic documents only, kept for this session")).toBeInTheDocument();
    unmount();
    render(<WardFlowProvider>{panel}</WardFlowProvider>);
    expect(
      screen.getByText(
        "Synthetic documents only. The shared board keeps the file type and size, not the file or its name",
      ),
    ).toBeInTheDocument();
    const chart = { name: "chart.pdf", mimeType: "application/pdf", sizeBytes: 4 } as const;
    render(
      <ReferralDocumentLinks
        charts={[
          { ...chart, kind: "medication", base64: "JVBERg==" },
          { ...chart, kind: "observation" },
        ]}
      />,
    );
    // H-0049: a chart shows its kind and file type, never a saved file name.
    expect(screen.getByRole("link", { name: "Medication chart · PDF" })).toHaveAttribute(
      "download",
      "Medication chart.pdf",
    );
    expect(screen.queryByRole("link", { name: /Observation chart/ })).toBeNull();
    expect(screen.getByText("Observation chart · PDF (file not shared)")).toBeInTheDocument();
    expect(screen.queryByText(/chart\.pdf/)).toBeNull();
  });
  it("removes the board when coordinator access is revoked", () => {
    const { rerender } = render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    fake.connection = { ...fake.connection!, snapshot: null, status: "not-authorised" };
    rerender(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in with email" })).toBeInTheDocument();
  });
});
