import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const fake = vi.hoisted(() => ({ connection: null as WardSharedConnection | null }));
vi.mock("@/components/ward-management/ward-shared-access", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-shared-access")>();
  return { ...actual, useWardShared: (enabled: boolean) => ({ ...fake.connection!, enabled }) };
});

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { SeclusionScreen } from "@/components/ward-management/restrictive-practice/seclusion-screen";
import { WardObservationControl } from "@/components/ward-management/ward/ward-observation-control";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { TRANSPORT_PROVIDERS, type Referral } from "@/components/ward-management/ward-model";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { communityScopedReferrals } from "@/components/ward-management/ward-referral-visibility";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/*
 * Audit 24-3 (saves and shared mode, 24 Oct 2026), SV-1 to SV-4: a form keeps what was typed until
 * its save is accepted. A failed, refused or unanswered save keeps the form open with its answers
 * and says why at the form itself; an accepted save clears or closes it. Synthetic seed data only.
 */

type Mode = "failed" | "refused" | "pending" | "accepted";
const NOT_SAVED: Mode[] = ["failed", "refused", "pending"];
const FAILED_SAYS = "Save is not confirmed. Reconnect and review the board before trying again.";
const REFUSED_SAYS = "This record changed while you were looking. Your action was not applied.";
const SAYS: Record<Mode, RegExp | null> = {
  failed: /Save is not confirmed\. Reconnect/u,
  refused: /^Not recorded: This record changed while you were looking/u,
  pending: null,
  accepted: null,
};

function outcomeFor(mode: Mode): Promise<WardCommandOutcome> {
  if (mode === "pending") return new Promise<WardCommandOutcome>(() => {});
  if (mode === "accepted") return Promise.resolve({ commandId: "c-1", status: "accepted" });
  return Promise.resolve(
    mode === "failed"
      ? { commandId: "c-1", status: "failed", message: FAILED_SAYS }
      : { commandId: "c-1", status: "refused", message: REFUSED_SAYS },
  );
}

/** A shared board that stays ready and never changes, so only the command's answer can move the form. */
function sharedConnection(dispatch: WardSharedConnection["dispatch"]): WardSharedConnection {
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0)));
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
    dispatch,
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
  } as WardSharedConnection;
}

async function press(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

function expectSaid(testId: string, mode: Mode) {
  const said = SAYS[mode];
  if (said) expect(screen.getByTestId(testId).textContent).toMatch(said);
  else expect(screen.queryByTestId(testId)).toBeNull();
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("SV-1 seclusion, restraint and incident forms (shared mode)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true"));

  function renderScreen(mode: Mode) {
    const dispatch = vi.fn(() => outcomeFor(mode));
    fake.connection = sharedConnection(dispatch);
    render(
      <WardFlowProvider>
        <SeclusionScreen />
      </WardFlowProvider>,
    );
    // Open on a ward with a patient to choose.
    const picker = screen.queryByTestId("seclusion-ward") as HTMLSelectElement | null;
    if (picker)
      for (const option of Array.from(picker.options)) {
        fireEvent.change(picker, { target: { value: option.value } });
        if (within(screen.getByTestId("seclusion-start-patient")).getAllByRole("option").length > 1) break;
      }
    return dispatch;
  }

  const typedTime = () => {
    const minute = (((642 - 20) % 1440) + 1440) % 1440;
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  };

  it.each([...NOT_SAVED, "accepted" as const])("Record start, %s: answers kept until accepted", async (mode) => {
    const dispatch = renderScreen(mode);
    const patient = screen.getByTestId("seclusion-start-patient") as HTMLSelectElement;
    const value = within(patient).getAllByRole("option")[1]!.getAttribute("value")!;
    fireEvent.change(patient, { target: { value } });
    fireEvent.change(screen.getByTestId("seclusion-start-practice"), { target: { value: "seclusion" } });
    fireEvent.change(screen.getByTestId("seclusion-start-time"), { target: { value: typedTime() } });
    await press(screen.getByTestId("seclusion-start"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const kept = mode !== "accepted";
    expect(screen.getByTestId("seclusion-start-patient")).toHaveValue(kept ? value : "");
    expect(screen.getByTestId("seclusion-start-practice")).toHaveValue(kept ? "seclusion" : "");
    expect(screen.getByTestId("seclusion-start-time")).toHaveValue(kept ? typedTime() : "");
    expectSaid("seclusion-start-failure", mode);
    if (mode === "pending") {
      // One save at a time: a second press while the first is out sends nothing.
      await press(screen.getByTestId("seclusion-start"));
      expect(dispatch).toHaveBeenCalledTimes(1);
    }
  });

  it.each([...NOT_SAVED, "accepted" as const])("Record incident, %s: answers kept until accepted", async (mode) => {
    const dispatch = renderScreen(mode);
    const category = screen.getByTestId("seclusion-incident-category") as HTMLSelectElement;
    const value = within(category).getAllByRole("option")[1]!.getAttribute("value")!;
    fireEvent.change(category, { target: { value } });
    fireEvent.change(screen.getByTestId("seclusion-incident-time"), { target: { value: typedTime() } });
    await press(screen.getByTestId("seclusion-incident-record"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const kept = mode !== "accepted";
    expect(screen.getByTestId("seclusion-incident-category")).toHaveValue(kept ? value : "");
    expect(screen.getByTestId("seclusion-incident-time")).toHaveValue(kept ? typedTime() : "");
    expectSaid("seclusion-incident-failure", mode);
  });
});

describe("SV-1 seclusion end form (shared mode)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true"));

  it.each([...NOT_SAVED, "accepted" as const])("Save end time, %s: form and typed time kept", async (mode) => {
    const dispatch = vi.fn(() => outcomeFor(mode));
    fake.connection = sharedConnection(dispatch);
    // The shared board already holds a seclusion in use, started an hour before its clock.
    const state = fake.connection.snapshot!.payload.state as ReturnType<typeof seedWardFlowStateAt>;
    const stay = state.admissions.find((admission) => admission.state === "occupied")!;
    const withEpisode = wardFlowReducer(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      now: 642,
      unitId: stay.unitId,
      actingUnitId: stay.unitId,
      admissionId: stay.id,
      practice: "seclusion",
      startedAt: 642 - 60,
    });
    fake.connection.snapshot!.payload.state = JSON.parse(JSON.stringify(withEpisode));
    render(
      <WardFlowProvider>
        <SeclusionScreen />
      </WardFlowProvider>,
    );
    const picker = screen.queryByTestId("seclusion-ward");
    if (picker) fireEvent.change(picker, { target: { value: stay.unitId } });
    const card = screen.getByTestId("seclusion-ward-card");
    fireEvent.click(within(card).getByTestId("seclusion-episode-end-open"));
    fireEvent.change(within(card).getByTestId("seclusion-episode-end-time"), { target: { value: "10:32" } });
    await press(within(card).getByTestId("seclusion-episode-end"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    if (mode === "accepted") {
      expect(screen.queryByTestId("seclusion-episode-end-time")).toBeNull();
      return;
    }
    expect(screen.getByTestId("seclusion-episode-end-time")).toHaveValue("10:32");
    expectSaid("seclusion-episode-end-failure", mode);
  });
});

describe("SV-2 community transport dialogs (shared mode)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true"));
  const TEAM = COMMUNITY_TEAM_PAGES[0]!;

  function referralNamingTeam(): Referral {
    const state = wardFlowReducer(seedWardFlowStateAt(0), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [{ kind: "community_team", teamName: TEAM.name }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    return state.referrals.at(-1)!;
  }

  function renderTeam(mode: Mode, booked: boolean) {
    const dispatch = vi.fn(() => outcomeFor(mode));
    fake.connection = sharedConnection(dispatch);
    const seed = seedWardFlowStateAt(0);
    const movement = seed.movements.find((m) => m.stage === "pulled" && m.transport === undefined)!;
    if (booked) {
      // The shared board already holds this team's booking, so the cancel dialog is offered.
      const state = fake.connection.snapshot!.payload.state as typeof seed;
      const held = state.movements.find((m) => m.id === movement.id)!;
      const withJob = wardFlowReducer(state, {
        type: "BOOK_TRANSPORT",
        role: "community",
        now: NOW_ANCHOR,
        movementId: held.id,
        actingPlaceId: TEAM.id,
        provider: TRANSPORT_PROVIDERS[0]!,
        escortRequired: false,
        cadNumber: "CAD-1234",
        transportLegalStatus: "voluntary",
        estimatedAt: NOW_ANCHOR + 30,
      });
      fake.connection.snapshot!.payload.state = JSON.parse(JSON.stringify(withJob));
    }
    const referral = referralNamingTeam();
    const admission = {
      id: "AD-TRANSPORT-01",
      unitId: "unit-under-test",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      referralId: referral.id,
      movementId: movement.id,
      patientId: null,
      sex: "Female",
      homeRegion: "Perth Metropolitan",
      tentativeDiagnosis: null,
      state: "pulled",
      pulledAt: NOW_ANCHOR,
      arrivedAt: null,
      awayAtEmergencyDepartmentSince: null,
      expectedDischargeAt: null,
      dischargeDateMoves: 0,
      dischargeDateSetAt: null,
      dischargeDateSetBy: null,
      dischargeConfirmedAt: null,
      dischargeConfirmedBy: null,
      blockReason: null,
      leavingDestination: null,
      leftAt: null,
      followUp: null,
    } as unknown as Admission;
    render(
      <WardFlowProvider>
        <CommunityScreen teamId={TEAM.id} admissions={[admission]} referrals={communityScopedReferrals([referral])} />
      </WardFlowProvider>,
    );
    return { dispatch, id: movement.id };
  }

  it.each([...NOT_SAVED, "accepted" as const])("Confirm booking, %s: dialog and CAD number kept", async (mode) => {
    const { dispatch, id } = renderTeam(mode, false);
    fireEvent.click(screen.getByTestId(`ward-community-book-transport-${id}`));
    const dialog = screen.getByTestId(`ward-community-book-transport-dialog-${id}`);
    fireEvent.change(within(dialog).getByTestId(`ward-community-transport-provider-${id}`), {
      target: { value: TRANSPORT_PROVIDERS[1]! },
    });
    fireEvent.click(within(dialog).getByTestId(`ward-community-transport-escort-yes-${id}`));
    fireEvent.change(within(dialog).getByTestId(`ward-community-transport-cad-${id}`), {
      target: { value: "CAD-7788" },
    });
    fireEvent.click(within(dialog).getByTestId(`ward-community-transport-legal-involuntary-${id}`));
    fireEvent.change(within(dialog).getByTestId(`ward-community-transport-estimated-time-${id}`), {
      target: { value: "14:30" },
    });
    await press(within(dialog).getByTestId(`ward-community-book-transport-confirm-${id}`));
    expect(dispatch).toHaveBeenCalledTimes(1);
    if (mode === "accepted") {
      expect(screen.queryByTestId(`ward-community-book-transport-dialog-${id}`)).toBeNull();
      return;
    }
    expect(screen.getByTestId(`ward-community-transport-cad-${id}`)).toHaveValue("CAD-7788");
    expectSaid(`ward-community-book-transport-failure-${id}`, mode);
  });

  it.each([...NOT_SAVED, "accepted" as const])("Confirm cancel, %s: dialog and reason kept", async (mode) => {
    const { dispatch, id } = renderTeam(mode, true);
    fireEvent.click(screen.getByTestId(`ward-community-cancel-transport-${id}`));
    const dialog = screen.getByTestId(`ward-community-cancel-transport-dialog-${id}`);
    const reason = within(dialog).getByTestId(`ward-community-cancel-transport-reason-${id}`) as HTMLSelectElement;
    const value = within(reason).getAllByRole("option")[1]!.getAttribute("value")!;
    fireEvent.change(reason, { target: { value } });
    await press(within(dialog).getByTestId(`ward-community-cancel-transport-confirm-${id}`));
    expect(dispatch).toHaveBeenCalledTimes(1);
    if (mode === "accepted") {
      expect(screen.queryByTestId(`ward-community-cancel-transport-dialog-${id}`)).toBeNull();
      return;
    }
    expect(screen.getByTestId(`ward-community-cancel-transport-reason-${id}`)).toHaveValue(value);
    expectSaid(`ward-community-cancel-transport-failure-${id}`, mode);
  });
});

describe("SV-3 Ask more wards (referral decision pane)", () => {
  const RAISED_ID = "RF-901";

  function Seed({ unitId }: { unitId: string }) {
    const { now, dispatch } = useWardFlow();
    const seeded = useRef(false);
    useEffect(() => {
      if (seeded.current) return;
      seeded.current = true;
      dispatch({
        type: "RECEIVE_REFERRAL",
        role: "community",
        now,
        ageBand: "Adult",
        destinations: [
          {
            kind: "psychiatric_ward",
            unitId,
            sex: "Male",
            gender: "Male",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Midland" },
        source: "community",
        urgency: 2,
        originSiteCode: "RPH",
        transportNeeded: false,
        ...FIXTURE_HISTORY,
      });
    }, [now, dispatch, unitId]);
    return null;
  }

  function FirstOpenUnit() {
    const { units } = useWardFlow();
    const unit = units.find((candidate) => candidate.cohort === "Adult" && !candidate.isClosed);
    return unit ? <Seed unitId={unit.id} /> : null;
  }

  // The pane gets the provider's own dispatch, except that Ask more wards answers as `mode`.
  function Harness({ mode, calls }: { mode: Mode; calls: string[] }) {
    const { referrals, units, now, dispatch, rejections } = useWardFlow();
    const referral = referrals.find((candidate) => candidate.id === RAISED_ID);
    if (!referral) return null;
    const answered = ((event: Parameters<typeof dispatch>[0]) => {
      if (event.type !== "ASK_MORE_WARDS") return dispatch(event);
      calls.push(event.type);
      return outcomeFor(mode);
    }) as typeof dispatch;
    return (
      <ReferralMatchView
        referral={referral}
        units={units}
        now={now}
        dispatch={answered}
        rejections={rejections}
        phone={null}
      />
    );
  }

  it.each([...NOT_SAVED, "accepted" as const])("Ask, %s: list and tick kept until accepted", async (mode) => {
    const calls: string[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <FirstOpenUnit />
        <Harness mode={mode} calls={calls} />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("ward-referral-ask-more-wards");
    fireEvent.click(within(card).getByRole("button", { name: "Ask more wards" }));
    const first = within(within(card).getByRole("group", { name: "Fits, bed ready" })).getAllByRole("checkbox")[0]!;
    fireEvent.click(first);
    await press(screen.getByRole("button", { name: "Ask 1 ward" }));
    expect(calls).toHaveLength(1);
    if (mode === "accepted") {
      expect(screen.queryByTestId("ward-referral-ask-list")).toBeNull();
      expect(screen.queryByTestId("ward-referral-ask-failure")).toBeNull();
      return;
    }
    expect(screen.getByTestId("ward-referral-ask-list")).toBeInTheDocument();
    expect(within(screen.getByTestId("ward-referral-ask-list")).getAllByRole("checkbox")[0]).toBeChecked();
    expectSaid("ward-referral-ask-failure", mode);
  });
});

describe("SV-4 observation level control (ward bed drawer and ED patient record)", () => {
  it.each([...NOT_SAVED, "accepted" as const])("Record level, %s: control and choices kept", async (mode) => {
    const onSave = vi.fn(() => outcomeFor(mode));
    render(<WardObservationControl observation={GENERAL_OBSERVATION} now={NOW_ANCHOR} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    fireEvent.change(screen.getByTestId("ward-observation-level"), { target: { value: "intermittent" } });
    fireEvent.change(screen.getByTestId("ward-observation-interval"), { target: { value: "30" } });
    await press(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledTimes(1);
    if (mode === "accepted") {
      expect(screen.queryByTestId("ward-observation-save")).toBeNull();
      expect(screen.getByTestId("ward-observation-change")).toBeInTheDocument();
      return;
    }
    expect(screen.getByTestId("ward-observation-level")).toHaveValue("intermittent");
    expect(screen.getByTestId("ward-observation-interval")).toHaveValue("30");
    expectSaid("ward-observation-error", mode);
  });

  it("sends the version seen on opening, so a colleague's later change is refused, not overwritten", async () => {
    const onSave = vi.fn(() => outcomeFor("accepted"));
    const view = render(
      <WardObservationControl observation={GENERAL_OBSERVATION} now={NOW_ANCHOR} editingToken="v1" onSave={onSave} />,
    );
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    view.rerender(
      <WardObservationControl observation={GENERAL_OBSERVATION} now={NOW_ANCHOR} editingToken="v2" onSave={onSave} />,
    );
    fireEvent.change(screen.getByTestId("ward-observation-level"), { target: { value: "intermittent" } });
    await press(screen.getByTestId("ward-observation-save"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ level: "intermittent" }), "v1");
  });
});
